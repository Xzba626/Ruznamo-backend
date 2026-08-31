import { Injectable, NotFoundException } from '@nestjs/common';
import { LicenseStatus, Prisma } from '@prisma/client';
import { AuditActorType } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { paginateMeta, PaginationQueryDto } from '../common/dto/pagination.dto';

@Injectable()
export class AdminLicensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.LicenseWhereInput = query.search
      ? {
          OR: [
            { keyPrefix: { contains: query.search, mode: 'insensitive' } },
            { user: { email: { contains: query.search, mode: 'insensitive' } } },
            { user: { displayName: { contains: query.search, mode: 'insensitive' } } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.license.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          plan: { select: { code: true, name: true } },
          user: { select: { id: true, displayName: true, email: true } },
          _count: { select: { activations: true } },
        },
      }),
      this.prisma.license.count({ where }),
    ]);

    return {
      items: items.map((license) => ({
        id: license.id,
        keyPrefix: license.keyPrefix,
        status: license.status,
        plan: license.plan,
        user: license.user,
        activationCount: license._count.activations,
        startsAt: license.startsAt,
        expiresAt: license.expiresAt,
        activatedAt: license.activatedAt,
        revokedAt: license.revokedAt,
        createdAt: license.createdAt,
      })),
      meta: paginateMeta(total, page, limit),
    };
  }

  async getById(id: string) {
    const license = await this.prisma.license.findUnique({
      where: { id },
      include: {
        plan: true,
        user: { select: { id: true, displayName: true, email: true, status: true } },
        activations: { include: { device: true } },
        events: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });

    if (!license) {
      throw new NotFoundException('License not found');
    }

    return {
      id: license.id,
      keyPrefix: license.keyPrefix,
      status: license.status,
      plan: license.plan,
      user: license.user,
      startsAt: license.startsAt,
      expiresAt: license.expiresAt,
      activatedAt: license.activatedAt,
      revokedAt: license.revokedAt,
      createdAt: license.createdAt,
      activations: license.activations.map((a) => ({
        id: a.id,
        deviceId: a.deviceId,
        installationId: a.device.installationId,
        deviceName: a.device.deviceName,
        createdAt: a.createdAt,
      })),
      events: license.events,
    };
  }

  async revoke(id: string, adminId: string, reason?: string) {
    const license = await this.prisma.license.findUnique({ where: { id } });
    if (!license) {
      throw new NotFoundException('License not found');
    }

    if (license.status === LicenseStatus.REVOKED) {
      return { id, status: license.status };
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.license.update({
        where: { id },
        data: { status: LicenseStatus.REVOKED, revokedAt: new Date() },
      });
      await tx.licenseEvent.create({
        data: {
          licenseId: id,
          fromStatus: license.status,
          toStatus: LicenseStatus.REVOKED,
          reason: reason ?? 'admin_revoke',
        },
      });
      return result;
    });

    await this.auditService.log({
      actorType: AuditActorType.ADMIN,
      actorId: adminId,
      action: 'admin.license.revoke',
      entityType: 'License',
      entityId: id,
    });

    return { id: updated.id, status: updated.status };
  }
}
