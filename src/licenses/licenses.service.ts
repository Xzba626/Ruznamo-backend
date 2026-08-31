import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditActorType,
  LicenseStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { MobileJwtPayload } from '../auth/mobile-jwt.payload';
import { EntitlementService } from '../entitlements/entitlement.service';
import { LicenseKeyService } from '../security/license-key.service';
import { PrismaService } from '../prisma/prisma.service';

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

    const license = await this.prisma.license.findUnique({
      where: { keyHash },
      include: {
        plan: { include: { features: true } },
        activations: true,
      },
    });

    if (!license) {
      throw new NotFoundException({
        code: 'LICENSE_INVALID',
        message: 'License key is invalid',
      });
    }

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

    if (license.userId && license.userId !== user.sub) {
      throw new ForbiddenException({
        code: 'LICENSE_ALREADY_ACTIVATED',
        message: 'License is already assigned to another account',
      });
    }

    const device = await this.prisma.deviceInstallation.findFirst({
      where: { id: user.deviceId, userId: user.sub, revokedAt: null },
    });

    if (!device) {
      throw new ForbiddenException({
        code: 'DEVICE_REVOKED',
        message: 'Current device is not active',
      });
    }

    const maxDevices = this.readMaxDevices(license.plan.features);
    const uniqueDeviceCount = new Set(license.activations.map((a) => a.deviceId)).size;
    const alreadyOnDevice = license.activations.some((a) => a.deviceId === device.id);

    if (!alreadyOnDevice && uniqueDeviceCount >= maxDevices) {
      throw new ForbiddenException({
        code: 'LICENSE_ACTIVATION_LIMIT',
        message: 'License activation limit reached',
      });
    }

    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const updatedLicense = await tx.license.update({
        where: { id: license.id },
        data: {
          userId: user.sub,
          status: LicenseStatus.ACTIVE,
          activatedAt: license.activatedAt ?? now,
          startsAt: license.startsAt ?? now,
        },
      });

      if (!alreadyOnDevice) {
        await tx.licenseActivation.create({
          data: {
            licenseId: license.id,
            deviceId: device.id,
          },
        });
      }

      await tx.licenseEvent.create({
        data: {
          licenseId: license.id,
          fromStatus: license.status,
          toStatus: LicenseStatus.ACTIVE,
          reason: 'mobile_activation',
          metadata: { userId: user.sub, deviceId: device.id },
        },
      });

      return updatedLicense;
    });

    await this.auditService.log({
      actorType: AuditActorType.USER,
      actorId: user.sub,
      action: 'license.activated',
      entityType: 'License',
      entityId: license.id,
      metadata: { keyPrefix: license.keyPrefix },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    const entitlements = await this.entitlementService.getSnapshot(user.sub, user.installationId);

    return {
      license: {
        id: result.id,
        status: result.status,
        keyPrefix: license.keyPrefix,
        plan: { code: license.plan.code, name: license.plan.name },
        startsAt: result.startsAt,
        expiresAt: result.expiresAt,
        activatedAt: result.activatedAt,
      },
      entitlements: this.toPublicEntitlements(entitlements),
    };
  }

  async getMyLicenses(userId: string) {
    const licenses = await this.prisma.license.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        plan: { select: { code: true, name: true } },
        activations: {
          include: {
            device: {
              select: {
                id: true,
                installationId: true,
                deviceName: true,
                revokedAt: true,
              },
            },
          },
        },
      },
    });

    return {
      items: licenses.map((license) => ({
        id: license.id,
        status: license.status,
        keyPrefix: license.keyPrefix,
        plan: license.plan,
        startsAt: license.startsAt,
        expiresAt: license.expiresAt,
        activatedAt: license.activatedAt,
        activations: license.activations.map((activation) => ({
          id: activation.id,
          deviceId: activation.deviceId,
          installationId: activation.device.installationId,
          deviceName: activation.device.deviceName,
          deviceStatus: activation.device.revokedAt ? 'REVOKED' : 'ACTIVE',
          createdAt: activation.createdAt,
        })),
      })),
    };
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
      },
      features: snapshot.features,
      evaluatedAt: snapshot.evaluatedAt,
    };
  }
}
