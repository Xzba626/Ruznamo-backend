import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditActorType,
  LicenseActivationRevokeReason,
  LicenseIssueSource,
  LicenseStatus,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { MobileJwtPayload } from '../auth/mobile-jwt.payload';
import { PrismaService } from '../prisma/prisma.service';
import { readMaxDevicesFromFeatures } from '../admin/common/plan-features.util';
import { activeActivationsForLicense } from './active-license-activation';
import {
  buildLicenseLinkStartPayload,
  generateOpaqueToken,
} from './license-link-token.util';

const LINK_CHALLENGE_TTL_MS = 15 * 60 * 1000;

export interface LinkChallengeResult {
  deepLink: string;
  expiresAt: Date;
  token: string;
}

@Injectable()
export class TelegramLicenseLinkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async createChallenge(user: MobileJwtPayload, licenseId: string): Promise<LinkChallengeResult> {
    const activation = await this.prisma.licenseActivation.findFirst({
      where: {
        licenseId,
        deviceId: user.deviceId,
        device: { userId: user.sub, revokedAt: null },
      },
      include: {
        license: {
          include: { plan: { select: { name: true, code: true } } },
        },
        device: true,
      },
    });

    if (!activation) {
      throw new ForbiddenException({
        code: 'LICENSE_NOT_ACTIVE_ON_DEVICE',
        message: 'License is not active on this device',
      });
    }

    this.assertLicenseLinkable(activation.license);

    const token = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + LINK_CHALLENGE_TTL_MS);

    await this.prisma.telegramLicenseLinkChallenge.create({
      data: {
        token,
        licenseId,
        deviceId: user.deviceId!,
        mobileUserId: user.sub,
        expiresAt,
      },
    });

    await this.auditService.log({
      actorType: AuditActorType.USER,
      actorId: user.sub,
      action: 'license.telegram_link.challenge_created',
      entityType: 'License',
      entityId: licenseId,
      metadata: { deviceId: user.deviceId },
    });

    const botUsername = this.configService.get<string>('telegram.botUsername', 'Ruznamo_bot');
    const startPayload = buildLicenseLinkStartPayload(token);

    return {
      token,
      expiresAt,
      deepLink: `https://t.me/${botUsername.replace(/^@/, '')}?start=${startPayload}`,
    };
  }

  async getChallengePreview(token: string) {
    const challenge = await this.loadValidChallenge(token);
    const license = await this.prisma.license.findUnique({
      where: { id: challenge.licenseId },
      include: {
        plan: { select: { name: true, code: true } },
        holderTelegramAccount: { select: { id: true, username: true, firstName: true } },
        activations: {
          where: { deviceId: challenge.deviceId },
          include: {
            device: {
              select: {
                deviceName: true,
                deviceManufacturer: true,
                deviceModel: true,
                appVersion: true,
              },
            },
          },
        },
      },
    });

    if (!license) {
      throw new NotFoundException('License not found');
    }

    const device = license.activations[0]?.device;

    return {
      licenseId: license.id,
      plan: license.plan,
      expiresAt: license.expiresAt,
      keyPrefix: license.keyPrefix,
      issueSource: license.issueSource,
      hasHolder: Boolean(license.holderTelegramAccountId),
      holderUsername: license.holderTelegramAccount?.username ?? null,
      device: device
        ? {
            deviceName: device.deviceName,
            manufacturer: device.deviceManufacturer,
            model: device.deviceModel,
            appVersion: device.appVersion,
          }
        : null,
    };
  }

  async confirmLink(token: string, telegramAccountId: string, actorTelegramUserId: bigint) {
    const challenge = await this.loadValidChallenge(token);

    const telegramAccount = await this.prisma.telegramAccount.findUnique({
      where: { id: telegramAccountId },
    });

    if (!telegramAccount || telegramAccount.telegramId !== actorTelegramUserId) {
      throw new ForbiddenException({
        code: 'TELEGRAM_IDENTITY_MISMATCH',
        message: 'Telegram sender does not match resolved account',
      });
    }

    const license = await this.prisma.license.findUnique({
      where: { id: challenge.licenseId },
      include: {
        activations: {
          where: { deviceId: challenge.deviceId, revokedAt: null, device: { revokedAt: null } },
        },
      },
    });

    if (!license || license.activations.length === 0) {
      throw new BadRequestException({
        code: 'DEVICE_ACTIVATION_MISSING',
        message: 'Device activation no longer valid for this link',
      });
    }

    this.assertLicenseLinkable(license);

    if (license.holderTelegramAccountId === telegramAccountId) {
      await this.consumeChallenge(challenge.id);
      return { linked: true, alreadyLinked: true, licenseId: license.id };
    }

    if (license.holderTelegramAccountId && license.holderTelegramAccountId !== telegramAccountId) {
      throw new ForbiddenException({
        code: 'LICENSE_HOLDER_CONFLICT',
        message: 'License is already controlled by another Telegram account',
      });
    }

    if (license.issueSource === LicenseIssueSource.TELEGRAM_PAYMENT) {
      if (
        license.purchaserTelegramAccountId &&
        license.purchaserTelegramAccountId !== telegramAccountId
      ) {
        throw new ForbiddenException({
          code: 'TELEGRAM_PURCHASE_OWNER_REQUIRED',
          message: 'This license must be linked by the purchasing Telegram account or via support',
        });
      }
    }

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.license.update({
        where: { id: license.id },
        data: {
          holderTelegramAccountId: telegramAccountId,
          holderLinkedAt: now,
          ...(license.purchaserTelegramAccountId
            ? {}
            : license.issueSource === LicenseIssueSource.ADMIN_MANUAL
              ? {}
              : {}),
        },
      });

      await tx.licenseHolderHistory.create({
        data: {
          licenseId: license.id,
          fromTelegramAccountId: license.holderTelegramAccountId,
          toTelegramAccountId: telegramAccountId,
          reason:
            license.issueSource === LicenseIssueSource.ADMIN_MANUAL
              ? 'MANUAL_LICENSE_TELEGRAM_CLAIMED'
              : 'TELEGRAM_LINK_CONFIRMED',
          actorType: AuditActorType.TELEGRAM_BOT,
          actorId: telegramAccountId,
        },
      });

      await tx.licenseEvent.create({
        data: {
          licenseId: license.id,
          fromStatus: license.status,
          toStatus: license.status,
          reason: 'telegram_holder_linked',
          metadata: {
            telegramAccountId,
            deviceId: challenge.deviceId,
            mobileUserId: challenge.mobileUserId,
          },
        },
      });

      await tx.telegramLicenseLinkChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: now },
      });
    });

    await this.auditService.log({
      actorType: AuditActorType.TELEGRAM_BOT,
      actorId: telegramAccountId,
      action: 'license.telegram_holder.linked',
      entityType: 'License',
      entityId: license.id,
      metadata: { deviceId: challenge.deviceId },
    });

    return { linked: true, alreadyLinked: false, licenseId: license.id };
  }

  async revokeDeviceAsHolder(
    holderTelegramAccountId: string,
    licenseId: string,
    deviceId: string,
  ): Promise<{
    licenseId: string;
    deviceId: string;
    devicesUsedBefore: number;
    devicesUsedAfter: number;
    deviceLimit: number;
  }> {
    const license = await this.prisma.license.findUnique({
      where: { id: licenseId },
      include: { plan: { include: { features: true } } },
    });
    if (!license) {
      throw new NotFoundException('License not found');
    }
    if (license.holderTelegramAccountId !== holderTelegramAccountId) {
      throw new ForbiddenException({
        code: 'NOT_LICENSE_HOLDER',
        message: 'Only the holder Telegram account may revoke devices',
      });
    }

    const activation = await this.prisma.licenseActivation.findFirst({
      where: { licenseId, deviceId, revokedAt: null },
      include: { device: true },
    });

    if (!activation || activation.device.revokedAt) {
      throw new BadRequestException('Device is not active on this license');
    }

    const devicesUsedBefore = await this.prisma.licenseActivation.count({
      where: activeActivationsForLicense(licenseId),
    });
    const deviceLimit = readMaxDevicesFromFeatures(license.plan.features) ?? 1;
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.licenseActivation.update({
        where: { id: activation.id },
        data: {
          revokedAt: now,
          revokeReason: LicenseActivationRevokeReason.HOLDER_DISCONNECT,
        },
      });
      await tx.licenseEvent.create({
        data: {
          licenseId,
          fromStatus: license.status,
          toStatus: license.status,
          reason: 'holder_device_revoked',
          metadata: { deviceId, holderTelegramAccountId, activationId: activation.id },
        },
      });
    });

    const devicesUsedAfter = Math.max(0, devicesUsedBefore - 1);

    await this.auditService.log({
      actorType: AuditActorType.TELEGRAM_BOT,
      actorId: holderTelegramAccountId,
      action: 'license.device.revoked_by_holder',
      entityType: 'LicenseActivation',
      entityId: activation.id,
      metadata: { licenseId, deviceId, devicesUsedBefore, devicesUsedAfter, deviceLimit },
    });

    return {
      licenseId,
      deviceId,
      devicesUsedBefore,
      devicesUsedAfter,
      deviceLimit,
    };
  }

  private async loadValidChallenge(token: string) {
    const challenge = await this.prisma.telegramLicenseLinkChallenge.findUnique({
      where: { token },
    });

    if (!challenge) {
      throw new NotFoundException({ code: 'LINK_CHALLENGE_INVALID', message: 'Link token not found' });
    }
    if (challenge.consumedAt) {
      throw new BadRequestException({ code: 'LINK_CHALLENGE_USED', message: 'Link token already used' });
    }
    if (challenge.expiresAt <= new Date()) {
      throw new BadRequestException({ code: 'LINK_CHALLENGE_EXPIRED', message: 'Link token expired' });
    }

    return challenge;
  }

  private async consumeChallenge(id: string) {
    await this.prisma.telegramLicenseLinkChallenge.update({
      where: { id },
      data: { consumedAt: new Date() },
    });
  }

  private assertLicenseLinkable(license: {
    status: LicenseStatus;
    revokedAt: Date | null;
    expiresAt: Date | null;
  }): void {
    if (license.status === LicenseStatus.REVOKED || license.revokedAt) {
      throw new ForbiddenException({ code: 'LICENSE_REVOKED', message: 'License revoked' });
    }
    if (license.expiresAt && license.expiresAt <= new Date()) {
      throw new ForbiddenException({ code: 'LICENSE_EXPIRED', message: 'License expired' });
    }
  }

  maskKeyPrefix(prefix: string): string {
    if (prefix.length <= 4) return `${prefix}••••`;
    return `${prefix.toUpperCase()}••••${prefix.slice(-4)}`;
  }

  async linkHolderFromVerifiedChallenge(params: {
    licenseId: string;
    holderTelegramAccountId: string;
    deviceId: string;
    mobileUserId: string;
  }): Promise<{ linked: boolean; alreadyLinked: boolean; licenseId: string }> {
    const license = await this.prisma.license.findUnique({
      where: { id: params.licenseId },
      include: {
        activations: {
          where: { deviceId: params.deviceId, revokedAt: null, device: { revokedAt: null } },
        },
      },
    });

    if (!license || license.activations.length === 0) {
      throw new BadRequestException({
        code: 'DEVICE_ACTIVATION_MISSING',
        message: 'Device activation no longer valid for this license',
      });
    }

    this.assertLicenseLinkable(license);

    if (license.holderTelegramAccountId === params.holderTelegramAccountId) {
      return { linked: true, alreadyLinked: true, licenseId: license.id };
    }

    if (license.holderTelegramAccountId && license.holderTelegramAccountId !== params.holderTelegramAccountId) {
      throw new ForbiddenException({
        code: 'LICENSE_HOLDER_CONFLICT',
        message: 'License is already controlled by another Telegram account',
      });
    }

    if (license.issueSource === LicenseIssueSource.TELEGRAM_PAYMENT) {
      if (
        license.purchaserTelegramAccountId &&
        license.purchaserTelegramAccountId !== params.holderTelegramAccountId
      ) {
        throw new ForbiddenException({
          code: 'TELEGRAM_PURCHASE_OWNER_REQUIRED',
          message: 'This license must be linked by the purchasing Telegram account or via support',
        });
      }
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.license.update({
        where: { id: license.id },
        data: {
          holderTelegramAccountId: params.holderTelegramAccountId,
          holderLinkedAt: now,
        },
      });

      await tx.licenseHolderHistory.create({
        data: {
          licenseId: license.id,
          fromTelegramAccountId: license.holderTelegramAccountId,
          toTelegramAccountId: params.holderTelegramAccountId,
          reason: 'TELEGRAM_OTP_LINK_ACCOUNT',
          actorType: AuditActorType.USER,
          actorId: params.mobileUserId,
        },
      });

      await tx.licenseEvent.create({
        data: {
          licenseId: license.id,
          fromStatus: license.status,
          toStatus: license.status,
          reason: 'telegram_holder_linked_via_otp',
          metadata: {
            telegramAccountId: params.holderTelegramAccountId,
            deviceId: params.deviceId,
            mobileUserId: params.mobileUserId,
          },
        },
      });
    });

    await this.auditService.log({
      actorType: AuditActorType.USER,
      actorId: params.mobileUserId,
      action: 'license.telegram_holder.linked_via_otp',
      entityType: 'License',
      entityId: license.id,
      metadata: { deviceId: params.deviceId },
    });

    return { linked: true, alreadyLinked: false, licenseId: license.id };
  }
}
