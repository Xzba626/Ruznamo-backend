import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginateMeta, PaginationQueryDto } from '../common/dto/pagination.dto';

@Injectable()
export class AdminDevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.DeviceInstallationWhereInput = query.search
      ? {
          OR: [
            { installationId: { contains: query.search, mode: 'insensitive' } },
            { deviceName: { contains: query.search, mode: 'insensitive' } },
            { user: { email: { contains: query.search, mode: 'insensitive' } } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.deviceInstallation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { lastSeenAt: 'desc' },
        include: {
          user: { select: { id: true, displayName: true, email: true, status: true } },
        },
      }),
      this.prisma.deviceInstallation.count({ where }),
    ]);

    return {
      items: items.map((device) => ({
        id: device.id,
        installationId: device.installationId,
        deviceName: device.deviceName,
        platform: device.platform,
        appVersion: device.appVersion,
        lastSeenAt: device.lastSeenAt,
        revokedAt: device.revokedAt,
        isActive: device.revokedAt === null,
        createdAt: device.createdAt,
        user: device.user,
      })),
      meta: paginateMeta(total, page, limit),
    };
  }
}
