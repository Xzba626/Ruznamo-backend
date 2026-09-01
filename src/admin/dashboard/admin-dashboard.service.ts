import { Injectable } from '@nestjs/common';
import { LicenseStatus, TrialGrantStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      trialUsers,
      activeLicenses,
      expiredLicenses,
      pendingLicenses,
      activeDevices,
      recentAudit,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
      this.prisma.user.count({ where: { status: UserStatus.SUSPENDED } }),
      this.prisma.trialGrant.count({ where: { status: TrialGrantStatus.ACTIVE } }),
      this.prisma.license.count({ where: { status: LicenseStatus.ACTIVE } }),
      this.prisma.license.count({ where: { status: LicenseStatus.EXPIRED } }),
      this.prisma.license.count({ where: { status: LicenseStatus.PENDING } }),
      this.prisma.deviceInstallation.count({ where: { revokedAt: null } }),
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const adminIds = recentAudit
      .filter((entry) => entry.actorType === 'ADMIN' && entry.actorId)
      .map((entry) => entry.actorId as string);
    const admins =
      adminIds.length > 0
        ? await this.prisma.adminUser.findMany({
            where: { id: { in: adminIds } },
            select: { id: true, email: true },
          })
        : [];
    const adminMap = new Map(admins.map((admin) => [admin.id, admin]));

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        suspended: suspendedUsers,
        trial: trialUsers,
      },
      licenses: {
        active: activeLicenses,
        expired: expiredLicenses,
        pending: pendingLicenses,
      },
      devices: { active: activeDevices },
      recentActivity: recentAudit.map((entry) => ({
        id: entry.id,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        actorType: entry.actorType,
        actorEmail:
          entry.actorType === 'ADMIN' && entry.actorId
            ? (adminMap.get(entry.actorId)?.email ?? null)
            : null,
        createdAt: entry.createdAt,
      })),
    };
  }
}
