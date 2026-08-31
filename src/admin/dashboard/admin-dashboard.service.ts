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
        include: { adminUser: { select: { email: true, displayName: true } } },
      }),
    ]);

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
        actorEmail: entry.adminUser?.email ?? null,
        createdAt: entry.createdAt,
      })),
    };
  }
}
