import { Injectable } from '@nestjs/common';
import { LicenseIssueSource, LicenseStatus, OrderStatus, Prisma, TrialGrantStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const ACTIVE_DEVICE_DAYS = 30;

export type SalesPeriod = 'today' | '7d' | '30d' | 'month' | 'prev_month';

@Injectable()
export class AdminAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private resolvePeriodRange(period: SalesPeriod): { from: Date; to: Date; label: string } {
    const now = new Date();
    const startOfDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const endOfDay = (d: Date) =>
      new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));

    if (period === 'today') {
      return { from: startOfDay(now), to: endOfDay(now), label: 'today' };
    }
    if (period === '7d') {
      return {
        from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        to: now,
        label: '7d',
      };
    }
    if (period === '30d') {
      return {
        from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        to: now,
        label: '30d',
      };
    }
    if (period === 'month') {
      const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      return { from, to: now, label: 'this_month' };
    }
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));
    return { from, to, label: 'prev_month' };
  }

  async getSales(period: SalesPeriod = '30d') {
    const { from, to, label } = this.resolvePeriodRange(period);

    const soldWhere: Prisma.LicenseWhereInput = {
      issueSource: LicenseIssueSource.TELEGRAM_PAYMENT,
      createdAt: { gte: from, lte: to },
      order: { status: { in: [OrderStatus.COMPLETED, OrderStatus.APPROVED] } },
    };

    const manualWhere: Prisma.LicenseWhereInput = {
      issueSource: LicenseIssueSource.ADMIN_MANUAL,
      createdAt: { gte: from, lte: to },
    };

    const [soldLicenses, manualLicenses, revenueAgg, soldByPlan, periodOrders, activations, unknownLegacy] =
      await Promise.all([
        this.prisma.license.count({ where: soldWhere }),
        this.prisma.license.count({ where: manualWhere }),
        this.prisma.order.aggregate({
          where: {
            status: { in: [OrderStatus.COMPLETED, OrderStatus.APPROVED] },
            approvedAt: { gte: from, lte: to },
          },
          _sum: { amount: true },
        }),
        this.prisma.license.groupBy({
          by: ['planId'],
          where: soldWhere,
          _count: { _all: true },
        }),
        this.prisma.order.findMany({
          where: {
            status: { in: [OrderStatus.COMPLETED, OrderStatus.APPROVED] },
            approvedAt: { gte: from, lte: to },
            license: { issueSource: LicenseIssueSource.TELEGRAM_PAYMENT },
          },
          select: { billingPeriod: true, currency: true, amount: true },
        }),
        this.prisma.licenseActivation.count({ where: { createdAt: { gte: from, lte: to } } }),
        this.prisma.license.count({
          where: {
            issueSource: LicenseIssueSource.UNKNOWN_LEGACY,
            createdAt: { gte: from, lte: to },
          },
        }),
      ]);

    const plans = await this.prisma.plan.findMany({ select: { id: true, code: true, name: true } });
    const planMap = new Map(plans.map((p) => [p.id, p]));

    const billingBreakdown = { MONTHLY: 0, YEARLY: 0 };
    for (const order of periodOrders) {
      if (order.billingPeriod === 'YEARLY') billingBreakdown.YEARLY += 1;
      else billingBreakdown.MONTHLY += 1;
    }

    const currency = periodOrders.find((o) => o.currency)?.currency ?? 'TJS';

    return {
      period: label,
      from: from.toISOString(),
      to: to.toISOString(),
      definitions: {
        sold: 'TELEGRAM_PAYMENT license with completed/approved Order in period',
        manualIssued: 'ADMIN_MANUAL licenses created in period (not counted as sold)',
        revenue: 'Sum of approved/completed Order amounts by approvedAt in period',
        activations: 'LicenseActivation rows created in period (not sales)',
      },
      sold: {
        total: soldLicenses,
        byPlan: soldByPlan.map((row) => ({
          planCode: planMap.get(row.planId)?.code ?? 'UNKNOWN',
          planName: planMap.get(row.planId)?.name ?? 'Unknown',
          count: row._count._all,
        })),
        byBillingPeriod: billingBreakdown,
      },
      manualIssued: manualLicenses,
      unknownLegacy,
      revenue: {
        grossApproved: revenueAgg._sum.amount?.toString() ?? '0',
        currency,
      },
      activity: {
        activations,
        activeLicenses: await this.prisma.license.count({
          where: {
            status: LicenseStatus.ACTIVE,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
        }),
      },
      sourceBreakdown: {
        telegramPayment: soldLicenses,
        adminManual: manualLicenses,
        unknownLegacy,
      },
      generatedAt: new Date().toISOString(),
    };
  }

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
