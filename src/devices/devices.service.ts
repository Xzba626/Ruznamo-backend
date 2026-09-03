import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditActorType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { MobileJwtPayload } from '../auth/mobile-jwt.payload';
import { EntitlementService } from '../entitlements/entitlement.service';
import { buildDeviceMetadataUpdate } from './device-metadata.util';
import { revokeDeviceInstallation } from './revoke-device-installation';
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
      const device = await this.prisma.deviceInstallation.update({
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

      return this.toDeviceResponse(device);
    }

    await this.entitlementService.assertDeviceRegistrationAllowed(user.sub);

    const metadata = buildDeviceMetadataUpdate(dto);
    const device = await this.prisma.deviceInstallation.create({
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
      await revokeDeviceInstallation(tx, device.id, revokedAt);
      return tx.deviceInstallation.findUniqueOrThrow({ where: { id: device.id } });
    });

    await this.auditService.log({
      actorType: AuditActorType.USER,
      actorId: user.sub,
      action: 'device.revoked',
      entityType: 'DeviceInstallation',
      entityId: device.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.toDeviceResponse(updated);
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
