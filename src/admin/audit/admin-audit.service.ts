import { Injectable } from '@nestjs/common';
import { AuditActorType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginateMeta } from '../common/dto/pagination.dto';

export interface AuditListQuery {
  page?: number;
  limit?: number;
  action?: string;
  entityType?: string;
  actorId?: string;
}

@Injectable()
export class AdminAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AuditListQuery) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {
      ...(query.action ? { action: { contains: query.action, mode: 'insensitive' } } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const adminIds = items
      .filter((entry) => entry.actorType === AuditActorType.ADMIN && entry.actorId)
      .map((entry) => entry.actorId as string);
    const admins =
      adminIds.length > 0
        ? await this.prisma.adminUser.findMany({
            where: { id: { in: adminIds } },
            select: { id: true, email: true, displayName: true },
          })
        : [];
    const adminMap = new Map(admins.map((admin) => [admin.id, admin]));

    return {
      items: items.map((entry) => ({
        id: entry.id,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        actorType: entry.actorType as AuditActorType,
        actorId: entry.actorId,
        actorEmail:
          entry.actorType === AuditActorType.ADMIN && entry.actorId
            ? (adminMap.get(entry.actorId)?.email ?? null)
            : null,
        ipAddress: entry.ipAddress,
        createdAt: entry.createdAt,
        metadata: entry.metadata,
      })),
      meta: paginateMeta(total, page, limit),
    };
  }
}
