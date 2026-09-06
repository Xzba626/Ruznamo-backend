import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditActorType, UserCategory } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { MobileJwtPayload } from '../auth/mobile-jwt.payload';
import { EntitlementService } from '../entitlements/entitlement.service';
import { buildDeviceMetadataUpdate } from './device-metadata.util';
import { resolveUserCategory } from './resolve-user-category.util';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDeviceMetadataDto } from './dto/register-device-metadata.dto';

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class DevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlementService: EntitlementService,
    private readonly auditService: AuditService,
  ) {}

  async register(user: MobileJwtPayload, dto: RegisterDeviceMetadataDto, meta: RequestMeta) {
    const existing = await this.prisma.deviceInstallation.findUnique({
      where: { installationId: dto.installationId },
    });

    if (existing) {
      if (existing.userId !== user.sub) {
        throw new ConflictException({
          code: 'INSTALLATION_IN_USE',
          message: 'Installation ID belongs to another account',
        });
      }

      if (existing.revokedAt) {
        throw new ForbiddenException({
          code: 'DEVICE_REVOKED',
          message: 'This device installation has been revoked',
        });
      }

      const metadata = buildDeviceMetadataUpdate(dto);
      const profilePatch = this.buildProfilePatch(dto);
      const device = await this.prisma.$transaction(async (tx) => {
        if (Object.keys(profilePatch).length > 0) {
          await tx.user.update({
            where: { id: user.sub },
            data: profilePatch,
          });
        }
        return tx.deviceInstallation.update({
          where: { id: existing.id },
          data: {
            ...metadata,
            deviceName: dto.deviceName ?? metadata.deviceName,
            deviceManufacturer: dto.deviceManufacturer ?? metadata.deviceManufacturer,
            deviceModel: dto.deviceModel ?? metadata.deviceModel,
            androidOsVersion: dto.androidOsVersion ?? metadata.androidOsVersion,
            platform: dto.platform,
            lastSeenAt: new Date(),
            lastSeenIp: meta.ipAddress,
          },
        });
      });

      return this.toDeviceResponse(device);
    }

    await this.entitlementService.assertDeviceRegistrationAllowed(user.sub);

    const metadata = buildDeviceMetadataUpdate(dto);
    const profilePatch = this.buildProfilePatch(dto);
    const device = await this.prisma.$transaction(async (tx) => {
      if (Object.keys(profilePatch).length > 0) {
        await tx.user.update({
          where: { id: user.sub },
          data: profilePatch,
        });
      }
      return tx.deviceInstallation.create({
        data: {
          userId: user.sub,
          installationId: dto.installationId,
          platform: dto.platform,
          ...metadata,
          deviceName: dto.deviceName ?? metadata.deviceName,
          deviceManufacturer: dto.deviceManufacturer,
          deviceModel: dto.deviceModel,
          androidOsVersion: dto.androidOsVersion,
          registrationIp: meta.ipAddress,
          lastSeenIp: meta.ipAddress,
          lastSeenAt: new Date(),
        },
      });
    });

    await this.auditService.log({
      actorType: AuditActorType.USER,
      actorId: user.sub,
      action: 'device.registered',
      entityType: 'DeviceInstallation',
      entityId: device.id,
      metadata: { installationId: dto.installationId },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.toDeviceResponse(device);
  }

  async list(userId: string) {
    const devices = await this.prisma.deviceInstallation.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
    });

    return {
      items: devices.map((device) => this.toDeviceResponse(device)),
    };
  }

  async revoke(user: MobileJwtPayload, deviceId: string, meta: RequestMeta) {
    const device = await this.prisma.deviceInstallation.findFirst({
      where: { id: deviceId, userId: user.sub },
    });

    if (!device) {
      throw new NotFoundException({
        code: 'DEVICE_NOT_FOUND',
        message: 'Device not found',
      });
    }

    if (device.revokedAt) {
      return this.toDeviceResponse(device);
    }

    const revokedAt = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.licenseActivation.updateMany({
        where: { deviceId: device.id, revokedAt: null },
        data: { revokedAt },
      });
      await tx.refreshToken.updateMany({
        where: { deviceId: device.id, revokedAt: null },
        data: { revokedAt },
      });
      return tx.deviceInstallation.findUniqueOrThrow({ where: { id: device.id } });
    });

    await this.auditService.log({
      actorType: AuditActorType.USER,
      actorId: user.sub,
      action: 'device.slots_cleared',
      entityType: 'DeviceInstallation',
      entityId: device.id,
      metadata: { mode: 'soft_revoke_activations_only' },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.toDeviceResponse(updated);
  }

  private buildProfilePatch(dto: RegisterDeviceMetadataDto): {
    displayName?: string;
    category?: UserCategory;
  } {
    const patch: { displayName?: string; category?: UserCategory } = {};
    const name = dto.displayName?.trim();
    if (name) {
      patch.displayName = name.slice(0, 80);
    }
    const category = resolveUserCategory(dto.category, dto.roleId);
    if (category) {
      patch.category = category;
    }
    return patch;
  }

  private toDeviceResponse(device: {
    id: string;
    installationId: string;
    deviceName: string | null;
    platform: string;
    appVersion: string | null;
    lastSeenAt: Date;
    revokedAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: device.id,
      installationId: device.installationId,
      deviceName: device.deviceName,
      platform: device.platform,
      appVersion: device.appVersion,
      status: device.revokedAt ? 'REVOKED' : 'ACTIVE',
      lastSeenAt: device.lastSeenAt,
      createdAt: device.createdAt,
    };
  }
}
