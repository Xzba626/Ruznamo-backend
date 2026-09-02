import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditActorType, LicenseStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { MobileJwtPayload } from '../auth/mobile-jwt.payload';
import { RecoveryGrantContext, TelegramAuthService } from '../auth/telegram-auth.service';
import { EntitlementService } from '../entitlements/entitlement.service';
import { readMaxDevicesFromFeatures } from '../admin/common/plan-features.util';
import { PrismaService } from '../prisma/prisma.service';
import { DeviceReplacementService } from './device-replacement.service';
import { TelegramLicenseLinkService } from './telegram-license-link.service';

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class LicenseRecoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramAuthService: TelegramAuthService,
    private readonly deviceReplacementService: DeviceReplacementService,
    private readonly telegramLicenseLinkService: TelegramLicenseLinkService,
    private readonly entitlementService: EntitlementService,
    private readonly auditService: AuditService,
  ) {}

  async listHolderLicenses(recoveryGrantId: string, user: MobileJwtPayload) {
    const grant = await this.telegramAuthService.assertValidGrant(recoveryGrantId, user);

    const licenses = await this.prisma.license.findMany({
      where: { holderTelegramAccountId: grant.telegramAccountId },
      orderBy: { createdAt: 'desc' },
      include: {
        plan: {
          select: {
            code: true,
            name: true,
            features: { select: { key: true, value: true } },
          },
        },
        activations: {
          include: {
            device: {
              select: {
                id: true,
                deviceName: true,
                deviceManufacturer: true,
                deviceModel: true,
                revokedAt: true,
              },
            },
          },
        },
      },
    });

    return {
      items: licenses.map((license) => {
        const activeActivations = license.activations.filter((a) => !a.device.revokedAt);
        const maxDevices = readMaxDevicesFromFeatures(license.plan.features) ?? 1;

        return {
          id: license.id,
          status: license.status,
          maskedKey: this.telegramLicenseLinkService.maskKeyPrefix(license.keyPrefix),
          plan: { code: license.plan.code, name: license.plan.name },
          issueSource: license.issueSource,
          activatedAt: license.activatedAt,
          createdAt: license.createdAt,
          expiresAt: license.expiresAt,
          deviceUsage: {
            active: activeActivations.length,
            max: maxDevices,
          },
          isCurrentDeviceActive: activeActivations.some((a) => a.deviceId === user.deviceId),
          activations: activeActivations.map((activation) => ({
            deviceId: activation.deviceId,
            deviceName: activation.device.deviceName,
            deviceManufacturer: activation.device.deviceManufacturer,
            deviceModel: activation.device.deviceModel,
            isCurrentDevice: activation.deviceId === user.deviceId,
          })),
        };
      }),
    };
  }

  async revealLicenseKey(recoveryGrantId: string, licenseId: string, user: MobileJwtPayload) {
    const grant = await this.telegramAuthService.assertValidGrant(recoveryGrantId, user);
    await this.assertLicenseHeldByGrant(grant, licenseId);

    const license = await this.prisma.license.findUnique({ where: { id: licenseId } });
    if (!license) {
      throw new NotFoundException('License not found');
    }

    if (license.status === LicenseStatus.REVOKED || license.revokedAt) {
      throw new ForbiddenException({ code: 'LICENSE_REVOKED', message: 'License has been revoked' });
    }

    const fullKey = await this.findStoredKey(licenseId);
    if (!fullKey) {
      throw new NotFoundException({
        code: 'LICENSE_KEY_UNAVAILABLE',
        message: 'Full license key is not available for recovery; contact support',
      });
    }

    await this.auditService.log({
      actorType: AuditActorType.USER,
      actorId: user.sub,
      action: 'license.key.revealed',
      entityType: 'License',
      entityId: licenseId,
      metadata: {
        recoveryGrantId,
        telegramAccountId: grant.telegramAccountId,
        deviceId: grant.deviceId,
      },
    });

    return {
      licenseId,
      licenseKey: fullKey,
      maskedKey: this.telegramLicenseLinkService.maskKeyPrefix(license.keyPrefix),
    };
  }

  async activateViaTelegram(
    recoveryGrantId: string,
    licenseId: string,
    user: MobileJwtPayload,
    meta: RequestMeta,
  ) {
    const grant = await this.telegramAuthService.assertValidGrant(recoveryGrantId, user);
    await this.assertLicenseHeldByGrant(grant, licenseId);

    const result = await this.prisma.$transaction(async (tx) => {
      const license = await tx.license.findUnique({
        where: { id: licenseId },
        include: { plan: { include: { features: true } } },
      });

      if (!license) {
        throw new NotFoundException('License not found');
      }

      this.assertLicenseActivatable(license);

      await tx.$executeRaw(Prisma.sql`SELECT id FROM "License" WHERE id = ${license.id} FOR UPDATE`);

      const device = await tx.deviceInstallation.findFirst({
        where: { id: user.deviceId!, userId: user.sub, revokedAt: null },
      });

      if (!device) {
        throw new ForbiddenException({ code: 'DEVICE_REVOKED', message: 'Current device is not active' });
      }

      const maxDevices = readMaxDevicesFromFeatures(license.plan.features) ?? 1;

      const existingActivation = await tx.licenseActivation.findUnique({
        where: {
          licenseId_deviceId: { licenseId: license.id, deviceId: device.id },
        },
        include: { device: true },
      });

      if (existingActivation && !existingActivation.device.revokedAt) {
        return { license, device, idempotent: true as const, deviceReplacementRequired: false as const };
      }

      const activeActivations = await tx.licenseActivation.findMany({
        where: { licenseId: license.id, device: { revokedAt: null } },
        include: {
          device: {
            select: {
              id: true,
              deviceName: true,
              deviceManufacturer: true,
              deviceModel: true,
              lastSeenAt: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      if (activeActivations.length >= maxDevices) {
        return {
          license,
          device,
          idempotent: false as const,
          deviceReplacementRequired: true as const,
          activeDevices: activeActivations.map((a) => ({
            deviceId: a.deviceId,
            deviceName: a.device.deviceName,
            deviceManufacturer: a.device.deviceManufacturer,
            deviceModel: a.device.deviceModel,
            lastSeenAt: a.device.lastSeenAt,
          })),
          maxDevices,
        };
      }

      await tx.licenseActivation.create({
        data: { licenseId: license.id, deviceId: device.id },
      });

      const now = new Date();
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
          reason: 'telegram_auth_activation',
          metadata: {
            mobileUserId: user.sub,
            deviceId: device.id,
            recoveryGrantId,
            telegramAccountId: grant.telegramAccountId,
          },
        },
      });

      return { license, device, idempotent: false as const, deviceReplacementRequired: false as const };
    });

    if (result.deviceReplacementRequired) {
      throw new ForbiddenException({
        code: 'DEVICE_REPLACEMENT_REQUIRED',
        message: 'License activation limit reached; device replacement required',
        details: {
          activeCount: result.activeDevices!.length,
          maxDevices: result.maxDevices,
          activeDevices: result.activeDevices,
        },
      });
    }

    await this.auditService.log({
      actorType: AuditActorType.USER,
      actorId: user.sub,
      action: result.idempotent ? 'license.telegram_activation.idempotent' : 'license.telegram_activation.completed',
      entityType: 'License',
      entityId: result.license.id,
      metadata: {
        recoveryGrantId,
        deviceId: result.device.id,
        telegramAccountId: grant.telegramAccountId,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    const entitlements = await this.entitlementService.getSnapshot(user.sub, user.installationId);

    return {
      license: {
        id: result.license.id,
        status: LicenseStatus.ACTIVE,
        keyPrefix: result.license.keyPrefix,
        plan: { code: result.license.plan.code, name: result.license.plan.name },
        startsAt: result.license.startsAt,
        expiresAt: result.license.expiresAt,
        activatedAt: result.license.activatedAt,
      },
      entitlements: this.toPublicEntitlements(entitlements),
    };
  }

  async replaceDeviceViaGrant(
    recoveryGrantId: string,
    licenseId: string,
    oldDeviceId: string,
    user: MobileJwtPayload,
    meta: RequestMeta,
  ) {
    const grant = await this.telegramAuthService.assertValidGrant(recoveryGrantId, user);
    await this.assertLicenseHeldByGrant(grant, licenseId);

    if (!user.deviceId) {
      throw new ForbiddenException({ code: 'DEVICE_REQUIRED', message: 'Active device session required' });
    }

    await this.deviceReplacementService.executeReplacement({
      licenseId,
      newDeviceId: user.deviceId,
      oldDeviceId,
      holderTelegramAccountId: grant.telegramAccountId,
      actorType: AuditActorType.USER,
      actorId: user.sub,
      reason: 'telegram_grant_device_replacement',
      metadata: { recoveryGrantId },
    });

    await this.auditService.log({
      actorType: AuditActorType.USER,
      actorId: user.sub,
      action: 'license.device.replacement_via_telegram_grant',
      entityType: 'License',
      entityId: licenseId,
      metadata: {
        recoveryGrantId,
        oldDeviceId,
        newDeviceId: user.deviceId,
        telegramAccountId: grant.telegramAccountId,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    const entitlements = await this.entitlementService.getSnapshot(user.sub, user.installationId);

    return {
      replaced: true,
      licenseId,
      entitlements: this.toPublicEntitlements(entitlements),
    };
  }

  private async assertLicenseHeldByGrant(grant: RecoveryGrantContext, licenseId: string): Promise<void> {
    const license = await this.prisma.license.findUnique({
      where: { id: licenseId },
      select: { holderTelegramAccountId: true },
    });

    if (!license) {
      throw new NotFoundException('License not found');
    }

    if (license.holderTelegramAccountId !== grant.telegramAccountId) {
      throw new ForbiddenException({
        code: 'NOT_LICENSE_HOLDER',
        message: 'Verified Telegram account does not control this license',
      });
    }
  }

  private assertLicenseActivatable(license: {
    status: LicenseStatus;
    revokedAt: Date | null;
    expiresAt: Date | null;
  }): void {
    if (license.status === LicenseStatus.REVOKED || license.revokedAt) {
      throw new ForbiddenException({ code: 'LICENSE_REVOKED', message: 'License has been revoked' });
    }

    if (
      license.status === LicenseStatus.EXPIRED ||
      (license.expiresAt && license.expiresAt <= new Date())
    ) {
      throw new ForbiddenException({ code: 'LICENSE_EXPIRED', message: 'License has expired' });
    }
  }

  private async findStoredKey(licenseId: string): Promise<string | null> {
    const outbox = await this.prisma.notificationOutbox.findFirst({
      where: {
        type: 'telegram_license_key',
        payload: { path: ['licenseId'], equals: licenseId },
      },
      orderBy: { createdAt: 'desc' },
    });
    const payload = outbox?.payload as { licenseKey?: string } | undefined;
    return payload?.licenseKey ?? null;
  }

  private toPublicEntitlements(snapshot: Awaited<ReturnType<EntitlementService['getSnapshot']>>) {
    return {
      access: snapshot.access,
      source: snapshot.source,
      effectiveStatus: snapshot.effectiveStatus,
      plan: snapshot.plan,
      trial: snapshot.trial,
      license: snapshot.license,
      devices: {
        active: snapshot.devices.activeCount,
        max: snapshot.devices.max,
        currentInstallationActive: snapshot.devices.currentInstallationActive,
      },
      features: snapshot.features,
      evaluatedAt: snapshot.evaluatedAt,
    };
  }
}
