import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginateMeta, PaginationQueryDto } from '../common/dto/pagination.dto';

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = query.search
      ? {
          OR: [
            { displayName: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
            { phone: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          trialGrant: { select: { status: true, expiresAt: true } },
          telegramAccount: { select: { telegramId: true, username: true, firstName: true } },
          licenses: {
            where: { status: 'ACTIVE' },
            take: 1,
            select: { id: true, status: true, keyPrefix: true, expiresAt: true },
          },
          _count: { select: { devices: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map((user) => ({
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        phone: user.phone,
        category: user.category,
        status: user.status,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        trial: user.trialGrant,
        telegram: user.telegramAccount
          ? {
              telegramId: user.telegramAccount.telegramId.toString(),
              username: user.telegramAccount.username,
              firstName: user.telegramAccount.firstName,
            }
          : null,
        activeLicense: user.licenses[0] ?? null,
        deviceCount: user._count.devices,
      })),
      meta: paginateMeta(total, page, limit),
    };
  }

  async getById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        trialGrant: true,
        licenses: {
          orderBy: { createdAt: 'desc' },
          include: { plan: { select: { code: true, name: true } } },
        },
        devices: { orderBy: { lastSeenAt: 'desc' } },
        telegramAccount: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      phone: user.phone,
      category: user.category,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      trial: user.trialGrant,
      licenses: user.licenses.map((license) => ({
        id: license.id,
        keyPrefix: license.keyPrefix,
        status: license.status,
        plan: license.plan,
        expiresAt: license.expiresAt,
        activatedAt: license.activatedAt,
      })),
      devices: user.devices.map((device) => ({
        id: device.id,
        installationId: device.installationId,
        deviceName: device.deviceName,
        platform: device.platform,
        appVersion: device.appVersion,
        lastSeenAt: device.lastSeenAt,
        revokedAt: device.revokedAt,
        createdAt: device.createdAt,
      })),
      telegram: user.telegramAccount
        ? {
            telegramId: user.telegramAccount.telegramId.toString(),
            username: user.telegramAccount.username,
            linkedAt: user.telegramAccount.linkedAt,
          }
        : null,
    };
  }
}
