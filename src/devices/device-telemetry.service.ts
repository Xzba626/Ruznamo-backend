import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildDeviceMetadataUpdate, DeviceMetadataInput } from './device-metadata.util';

@Injectable()
export class DeviceTelemetryService {
  constructor(private readonly prisma: PrismaService) {}

  async syncByInstallationId(
    installationId: string,
    input: DeviceMetadataInput,
    ipAddress?: string,
  ): Promise<void> {
    const metadata = buildDeviceMetadataUpdate(input);
    const hasUpdates = Object.values(metadata).some((value) => value !== undefined);
    if (!hasUpdates) {
      return;
    }

    await this.prisma.deviceInstallation.updateMany({
      where: { installationId, revokedAt: null },
      data: {
        ...metadata,
        lastSeenAt: new Date(),
        ...(ipAddress ? { lastSeenIp: ipAddress } : {}),
      },
    });
  }

  async touchLastSeen(deviceId: string, ipAddress?: string): Promise<void> {
    await this.prisma.deviceInstallation.updateMany({
      where: { id: deviceId, revokedAt: null },
      data: {
        lastSeenAt: new Date(),
        ...(ipAddress ? { lastSeenIp: ipAddress } : {}),
      },
    });
  }
}
