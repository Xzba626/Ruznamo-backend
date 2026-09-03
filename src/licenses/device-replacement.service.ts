import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditActorType, LicenseActivationRevokeReason, LicenseStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { MobileJwtPayload } from '../auth/mobile-jwt.payload';
import { readMaxDevicesFromFeatures } from '../admin/common/plan-features.util';
import { LicenseKeyService } from '../security/license-key.service';
import { PrismaService } from '../prisma/prisma.service';
import { activeActivationsForLicense, ACTIVE_LICENSE_ACTIVATION_WHERE } from './active-license-activation';
import { buildReplacementStartPayload, generateOpaqueToken } from './license-link-token.util';

const REPLACEMENT_CHALLENGE_TTL_MS = 15 * 60 * 1000;
/** Conservative anti-sharing: at most one holder-initiated replacement per license per 24h. */
const REPLACEMENT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class DeviceReplacementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly licenseKeyService: LicenseKeyService,
    private readonly auditService: AuditService,
  ) {}

  async createChallenge(user: MobileJwtPayload, licenseKey: string) {
    const normalized = this.licenseKeyService.normalizeKey(licenseKey);
    const keyHash = this.licenseKeyService.hashKey(normalized);

    const license = await this.prisma.license.findUnique({
      where: { keyHash },
      include: {
        plan: { include: { features: true } },
        activations: {
          where: ACTIVE_LICENSE_ACTIVATION_WHERE,
          include: { device: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!license) {
      throw new NotFoundException({ code: 'LICENSE_INVALID', message: 'License key is invalid' });
    }

    if (license.status === LicenseStatus.REVOKED || license.revokedAt) {
      throw new ForbiddenException({ code: 'LICENSE_REVOKED', message: 'License revoked' });
    }

    const device = await this.prisma.deviceInstallation.findFirst({
      where: { id: user.deviceId, userId: user.sub, revokedAt: null },
    });
    if (!device) {
      throw new ForbiddenException({ code: 'DEVICE_REVOKED', message: 'Current device is not active' });
    }

    const existingOnDevice = license.activations.find((a) => a.deviceId === device.id);
    if (existingOnDevice) {
      throw new BadRequestException({
        code: 'ALREADY_ACTIVATED_ON_DEVICE',
        message: 'License is already active on this device',
      });
    }

    const maxDevices = readMaxDevicesFromFeatures(license.plan.features) ?? 1;
    if (license.activations.length < maxDevices) {
      throw new BadRequestException({
        code: 'REPLACEMENT_NOT_REQUIRED',
        message: 'Device slot available; activate normally',
      });
    }

    const oldActivation = license.activations[0];
    if (!oldActivation) {
      throw new BadRequestException('No active device to replace');
    }

    await this.assertReplacementCooldown(license.id);

    const token = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + REPLACEMENT_CHALLENGE_TTL_MS);

    await this.prisma.deviceReplacementChallenge.create({
      data: {
        token,
        licenseId: license.id,
        newDeviceId: device.id,
        oldDeviceId: oldActivation.deviceId,
        mobileUserId: user.sub,
        expiresAt,
      },
    });

    const botUsername = this.configService.get<string>('telegram.botUsername', 'Ruznamo_bot');
    const startPayload = buildReplacementStartPayload(token);

    return {
      token,
      expiresAt,
      deepLink: `https://t.me/${botUsername.replace(/^@/, '')}?start=${startPayload}`,
      oldDevice: {
        name: oldActivation.device.deviceName,
        manufacturer: oldActivation.device.deviceManufacturer,
        model: oldActivation.device.deviceModel,
        lastSeenAt: oldActivation.device.lastSeenAt,
      },
      newDevice: {
        name: device.deviceName,
        manufacturer: device.deviceManufacturer,
        model: device.deviceModel,
      },
    };
  }

  async getChallengePreview(token: string) {
    const challenge = await this.loadValidChallenge(token);
    const license = await this.prisma.license.findUnique({
      where: { id: challenge.licenseId },
      include: {
        plan: { select: { name: true, code: true } },
        holderTelegramAccount: { select: { username: true, firstName: true } },
      },
    });
    const [oldDevice, newDevice] = await Promise.all([
      this.prisma.deviceInstallation.findUnique({ where: { id: challenge.oldDeviceId } }),
      this.prisma.deviceInstallation.findUnique({ where: { id: challenge.newDeviceId } }),
    ]);

    return {
      licenseId: challenge.licenseId,
      plan: license?.plan,
      expiresAt: license?.expiresAt,
      keyPrefix: license?.keyPrefix,
      oldDevice,
      newDevice,
      hasHolder: Boolean(license?.holderTelegramAccountId),
    };
  }

  async confirmReplacement(token: string, holderTelegramAccountId: string) {
    const challenge = await this.loadValidChallenge(token);

    const license = await this.prisma.license.findUnique({
      where: { id: challenge.licenseId },
    });

    if (!license) {
      throw new NotFoundException('License not found');
    }

    if (license.holderTelegramAccountId !== holderTelegramAccountId) {
      throw new ForbiddenException({
        code: 'NOT_LICENSE_HOLDER',
        message: 'Only the holder Telegram account may approve replacement',
      });
    }

    const result = await this.executeReplacement({
      licenseId: challenge.licenseId,
      newDeviceId: challenge.newDeviceId,
      oldDeviceId: challenge.oldDeviceId,
      holderTelegramAccountId,
      actorType: AuditActorType.TELEGRAM_BOT,
      actorId: holderTelegramAccountId,
      reason: 'device_replacement_approved',
      consumeChallengeId: challenge.id,
    });

    return result;
  }

  async executeReplacement(params: {
    licenseId: string;
    newDeviceId: string;
    oldDeviceId: string;
    holderTelegramAccountId: string;
    actorType: AuditActorType;
    actorId: string;
    reason?: string;
    metadata?: Record<string, unknown>;
    consumeChallengeId?: string;
  }): Promise<{ replaced: boolean; licenseId: string }> {
    const license = await this.prisma.license.findUnique({
      where: { id: params.licenseId },
      include: { plan: { include: { features: true } } },
    });

    if (!license) {
      throw new NotFoundException('License not found');
    }

    if (license.holderTelegramAccountId !== params.holderTelegramAccountId) {
      throw new ForbiddenException({
        code: 'NOT_LICENSE_HOLDER',
        message: 'Only the holder Telegram account may approve replacement',
      });
    }

    await this.assertReplacementCooldown(license.id);

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`SELECT id FROM "License" WHERE id = ${license.id} FOR UPDATE`);

      const activeCount = await tx.licenseActivation.count({
        where: activeActivationsForLicense(license.id),
      });
      const maxDevices = readMaxDevicesFromFeatures(license.plan.features) ?? 1;

      const newDeviceActivation = await tx.licenseActivation.findUnique({
        where: {
          licenseId_deviceId: { licenseId: license.id, deviceId: params.newDeviceId },
        },
        include: { device: true },
      });

      if (newDeviceActivation && !newDeviceActivation.revokedAt && !newDeviceActivation.device.revokedAt) {
        throw new BadRequestException('New device already activated');
      }

      if (activeCount < maxDevices) {
        if (newDeviceActivation) {
          await tx.licenseActivation.update({
            where: { id: newDeviceActivation.id },
            data: { revokedAt: null, revokeReason: null },
          });
        } else {
          await tx.licenseActivation.create({
            data: { licenseId: license.id, deviceId: params.newDeviceId },
          });
        }
      } else {
        await tx.licenseActivation.updateMany({
          where: { licenseId: license.id, deviceId: params.oldDeviceId, revokedAt: null },
          data: {
            revokedAt: now,
            revokeReason: LicenseActivationRevokeReason.DEVICE_REPLACEMENT,
          },
        });
        if (newDeviceActivation) {
          await tx.licenseActivation.update({
            where: { id: newDeviceActivation.id },
            data: { revokedAt: null, revokeReason: null },
          });
        } else {
          await tx.licenseActivation.create({
            data: { licenseId: license.id, deviceId: params.newDeviceId },
          });
        }
      }

      await tx.license.update({
        where: { id: license.id },
        data: {
          status: LicenseStatus.ACTIVE,
          activatedAt: license.activatedAt ?? now,
          startsAt: license.startsAt ?? now,
        },
      });

      await tx.licenseEvent.create({
        data: {
          licenseId: license.id,
          fromStatus: license.status,
          toStatus: LicenseStatus.ACTIVE,
          reason: params.reason ?? 'device_replacement_approved',
          metadata: {
            oldDeviceId: params.oldDeviceId,
            newDeviceId: params.newDeviceId,
            holderTelegramAccountId: params.holderTelegramAccountId,
            ...params.metadata,
          },
        },
      });

      if (params.consumeChallengeId) {
        await tx.deviceReplacementChallenge.update({
          where: { id: params.consumeChallengeId },
          data: { consumedAt: now },
        });
      }
    });

    await this.auditService.log({
      actorType: params.actorType,
      actorId: params.actorId,
      action: 'license.device.replacement_completed',
      entityType: 'License',
      entityId: license.id,
      metadata: {
        oldDeviceId: params.oldDeviceId,
        newDeviceId: params.newDeviceId,
      },
    });

    return { replaced: true, licenseId: license.id };
  }

  private async loadValidChallenge(token: string) {
    const challenge = await this.prisma.deviceReplacementChallenge.findUnique({ where: { token } });
    if (!challenge) {
      throw new NotFoundException({ code: 'REPLACEMENT_CHALLENGE_INVALID', message: 'Token not found' });
    }
    if (challenge.consumedAt) {
      throw new BadRequestException({ code: 'REPLACEMENT_CHALLENGE_USED', message: 'Token already used' });
    }
    if (challenge.expiresAt <= new Date()) {
      throw new BadRequestException({ code: 'REPLACEMENT_CHALLENGE_EXPIRED', message: 'Token expired' });
    }
    return challenge;
  }

  private async assertReplacementCooldown(licenseId: string) {
    const since = new Date(Date.now() - REPLACEMENT_COOLDOWN_MS);
    const recent = await this.prisma.licenseEvent.findFirst({
      where: {
        licenseId,
        reason: { in: ['device_replacement_approved', 'holder_device_revoked'] },
        createdAt: { gte: since },
      },
    });
    if (recent) {
      throw new ForbiddenException({
        code: 'REPLACEMENT_COOLDOWN',
        message: 'Device replacement is temporarily limited; contact support if urgent',
      });
    }
  }
}
