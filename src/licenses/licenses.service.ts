import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditActorType, LicenseStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { MobileJwtPayload } from '../auth/mobile-jwt.payload';
import { EntitlementService } from '../entitlements/entitlement.service';
import { LicenseKeyService } from '../security/license-key.service';
import { PrismaService } from '../prisma/prisma.service';
import { activeActivationsForLicense } from './active-license-activation';

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class LicensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly licenseKeyService: LicenseKeyService,
    private readonly entitlementService: EntitlementService,
    private readonly auditService: AuditService,
  ) {}

  async activate(user: MobileJwtPayload, licenseKey: string, meta: RequestMeta) {
    const normalized = this.licenseKeyService.normalizeKey(licenseKey);
    const keyHash = this.licenseKeyService.hashKey(normalized);

    const result = await this.prisma.$transaction(async (tx) => {
      const license = await tx.license.findUnique({
        where: { keyHash },
        include: {
          plan: { include: { features: true } },
        },
      });

      if (!license) {
        throw new NotFoundException({
          code: 'LICENSE_INVALID',
          message: 'License key is invalid',
        });
      }

      // Serialize concurrent activations for the same license (multi-device limit).
      await tx.$executeRaw(Prisma.sql`SELECT id FROM "License" WHERE id = ${license.id} FOR UPDATE`);

      this.assertLicenseActivatable(license);

      const device = await tx.deviceInstallation.findFirst({
        where: { id: user.deviceId, userId: user.sub, revokedAt: null },
      });

      if (!device) {
        throw new ForbiddenException({
          code: 'DEVICE_REVOKED',
          message: 'Current device is not active',
        });
      }

      const maxDevices = this.readMaxDevices(license.plan.features);

      const existingActivation = await tx.licenseActivation.findUnique({
        where: {
          licenseId_deviceId: {
            licenseId: license.id,
            deviceId: device.id,
          },
        },
      });

      if (existingActivation) {
        if (existingActivation.revokedAt) {
          throw new ForbiddenException({
            code: 'LICENSE_RECOVERY_REQUIRED',
            message:
              'This license was disconnected from this device. Recover access via Telegram holder verification.',
            details: {
              licenseId: license.id,
              telegramVerificationRequired: true,
            },
          });
        }
        return { license, device, idempotent: true as const };
      }

      const activeActivationCount = await tx.licenseActivation.count({
        where: activeActivationsForLicense(license.id),
      });

      if (activeActivationCount >= maxDevices) {
        throw new ForbiddenException({
          code: 'DEVICE_REPLACEMENT_REQUIRED',
          message: 'License activation limit reached; device replacement required',
          details: {
            activeCount: activeActivationCount,
            maxDevices,
            telegramLinkRequired: !license.holderTelegramAccountId,
          },
        });
      }

      try {
        await tx.licenseActivation.create({
          data: {
            licenseId: license.id,
            deviceId: device.id,
          },
        });
      } catch (error) {
        if (this.isUniqueViolation(error)) {
          const racedActivation = await tx.licenseActivation.findUnique({
            where: {
              licenseId_deviceId: {
                licenseId: license.id,
                deviceId: device.id,
              },
            },
          });
          if (racedActivation) {
            if (racedActivation.revokedAt) {
              throw new ForbiddenException({
                code: 'LICENSE_RECOVERY_REQUIRED',
                message:
                  'This license was disconnected from this device. Recover access via Telegram holder verification.',
              });
            }
            return { license, device, idempotent: true as const };
          }
          throw new ForbiddenException({
            code: 'LICENSE_ACTIVATION_LIMIT',
            message: 'License activation limit reached',
          });
        }
        throw error;
      }

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
          reason: 'mobile_activation',
          metadata: {
            mobileUserId: user.sub,
            deviceId: device.id,
            purchaserUserId: license.userId,
          },
        },
      });

      return { license, device, idempotent: false as const };
    });

    await this.auditService.log({
      actorType: AuditActorType.USER,
      actorId: user.sub,
      action: result.idempotent ? 'license.activation.idempotent' : 'license.activated',
      entityType: 'License',
      entityId: result.license.id,
      metadata: {
        keyPrefix: result.license.keyPrefix,
        deviceId: result.device.id,
        purchaserUserId: result.license.userId,
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

  async getMyLicenses(userId: string, currentDeviceId?: string) {
    const activations = await this.prisma.licenseActivation.findMany({
      where: {
        device: { userId, revokedAt: null },
        revokedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        license: {
          include: {
            plan: {
              select: {
                code: true,
                name: true,
                features: { select: { key: true, value: true } },
              },
            },
            holderTelegramAccount: {
              select: { username: true, firstName: true },
            },
            activations: {
              include: {
                device: {
                  select: {
                    id: true,
                    installationId: true,
                    deviceName: true,
                    deviceManufacturer: true,
                    deviceModel: true,
                    revokedAt: true,
                  },
                },
              },
            },
          },
        },
        device: {
          select: {
            id: true,
            installationId: true,
            deviceName: true,
            revokedAt: true,
          },
        },
      },
    });

    const licenseMap = new Map<string, (typeof activations)[number]['license']>();
    for (const activation of activations) {
      if (!licenseMap.has(activation.license.id)) {
        licenseMap.set(activation.license.id, activation.license);
      }
    }

    return {
      items: [...licenseMap.values()].map((license) => {
        const activeActivations = license.activations.filter(
          (a) => !a.revokedAt && !a.device.revokedAt,
        );
        const maxDevices = this.readMaxDevices(license.plan.features ?? []);
        const holder = license.holderTelegramAccount;

        return {
          id: license.id,
          status: license.status,
          keyPrefix: license.keyPrefix,
          plan: { code: license.plan.code, name: license.plan.name },
          issueSource: license.issueSource,
          startsAt: license.startsAt,
          expiresAt: license.expiresAt,
          activatedAt: license.activatedAt,
          deviceUsage: {
            active: activeActivations.length,
            max: maxDevices,
          },
          telegram: {
            linked: Boolean(license.holderTelegramAccountId),
            holderDisplayName: holder?.firstName ?? null,
            holderUsername: holder?.username ? `@${holder.username.replace(/^@/, '')}` : null,
            linkedAt: license.holderLinkedAt,
          },
          activations: license.activations.map((activation) => ({
            id: activation.id,
            deviceId: activation.deviceId,
            installationId: activation.device.installationId,
            deviceName: activation.device.deviceName,
            deviceManufacturer: activation.device.deviceManufacturer,
            deviceModel: activation.device.deviceModel,
            deviceStatus: activation.device.revokedAt ? 'REVOKED' : 'ACTIVE',
            isCurrentDevice: currentDeviceId != null && activation.deviceId === currentDeviceId,
            createdAt: activation.createdAt,
          })),
        };
      }),
    };
  }

  private assertLicenseActivatable(license: {
    status: LicenseStatus;
    revokedAt: Date | null;
    expiresAt: Date | null;
  }): void {
    if (license.status === LicenseStatus.REVOKED || license.revokedAt) {
      throw new ForbiddenException({
        code: 'LICENSE_REVOKED',
        message: 'License has been revoked',
      });
    }

    if (
      license.status === LicenseStatus.EXPIRED ||
      (license.expiresAt && license.expiresAt <= new Date())
    ) {
      throw new ForbiddenException({
        code: 'LICENSE_EXPIRED',
        message: 'License has expired',
      });
    }
  }

  private readMaxDevices(features: Array<{ key: string; value: string }>): number {
    const value = features.find((feature) => feature.key === 'max_devices')?.value ?? '1';
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      throw new BadRequestException({
        code: 'PLAN_MISCONFIGURED',
        message: 'Plan device limit is not configured',
      });
    }
    return parsed;
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

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
