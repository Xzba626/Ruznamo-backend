import { Injectable } from '@nestjs/common';
import { LicenseStatus, OrderStatus, TrialGrantStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const ACTIVE_DEVICE_DAYS = 30;

@Injectable()
export class AdminAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const now = new Date();
    const activeDeviceSince = new Date(now.getTime() - ACTIVE_DEVICE_DAYS * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalDevices,
      activeDevices,
      trialUsers,
      activeLicenses,
      paidUsers,
      ordersByStatus,
      planDistribution,
      categoryDistribution,
      appVersionDistribution,
      nullCategoryCount,
      recentInstallations,
      recentActivations,
      recentOrders,
    ] = await Promise.all([
      this.prisma.deviceInstallation.count({ where: { revokedAt: null } }),
      this.prisma.deviceInstallation.count({
        where: { revokedAt: null, lastSeenAt: { gte: activeDeviceSince } },
      }),
      this.prisma.trialGrant.count({ where: { status: TrialGrantStatus.ACTIVE, expiresAt: { gt: now } } }),
      this.prisma.license.count({
        where: { status: LicenseStatus.ACTIVE, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      }),
      this.prisma.user.count({
        where: {
          licenses: {
            some: {
              status: LicenseStatus.ACTIVE,
              orderId: { not: null },
              OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            },
          },
        },
      }),
      this.prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.license.groupBy({
        by: ['planId'],
        where: { status: { in: [LicenseStatus.ACTIVE, LicenseStatus.PENDING] } },
        _count: { _all: true },
      }),
      this.prisma.user.groupBy({ by: ['category'], _count: { _all: true } }),
      this.prisma.deviceInstallation.groupBy({
        by: ['appVersion'],
        where: { revokedAt: null },
        _count: { _all: true },
      }),
      this.prisma.user.count({ where: { category: 'PERSONAL' } }),
      this.prisma.deviceInstallation.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.licenseActivation.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.order.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    ]);

    const plans = await this.prisma.plan.findMany({ select: { id: true, code: true, name: true } });
    const planMap = new Map(plans.map((plan) => [plan.id, plan]));

    const totalUsers = categoryDistribution.reduce((sum, row) => sum + row._count._all, 0);

    return {
      definitions: {
        activeDevice: `lastSeenAt within ${ACTIVE_DEVICE_DAYS} days, not revoked`,
        activeLicense: 'status ACTIVE and not expired',
        trial: 'TrialGrant ACTIVE with expiresAt > now',
        paidUser: 'user with ACTIVE license linked to a completed order',
      },
      totals: {
        devices: totalDevices,
        activeDevices,
        trialUsers,
        activeLicenses,
        paidUsers,
        users: totalUsers,
      },
      trends30d: {
        newInstallations: recentInstallations,
        licenseActivations: recentActivations,
        orders: recentOrders,
      },
      ordersByStatus: ordersByStatus.map((row) => ({
        status: row.status,
        count: row._count._all,
      })),
      planDistribution: planDistribution.map((row) => ({
        planCode: planMap.get(row.planId)?.code ?? 'UNKNOWN',
        planName: planMap.get(row.planId)?.name ?? 'Unknown',
        count: row._count._all,
      })),
      categoryDistribution: categoryDistribution.map((row) => ({
        category: row.category,
        count: row._count._all,
        percentage: totalUsers > 0 ? Math.round((row._count._all / totalUsers) * 1000) / 10 : 0,
      })),
      categoryDataQuality: {
        totalUsers,
        defaultPersonalCount: nullCategoryCount,
        note: 'PERSONAL is the schema default; may include unset onboarding choices.',
      },
      appVersionDistribution: appVersionDistribution
        .map((row) => ({
          appVersion: row.appVersion ?? 'unknown',
          count: row._count._all,
        }))
        .sort((a, b) => b.count - a.count),
      generatedAt: now.toISOString(),
    };
  }
}
