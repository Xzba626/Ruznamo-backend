import { Injectable } from '@nestjs/common';
import { LicenseIssueSource, LicenseStatus, OrderStatus, Prisma, TrialGrantStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { formatAppVersionLabel } from '../../devices/device-metadata.util';

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
      definitions: this.metricDefinitionsRu(),
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
        by: ['appVersionCode', 'appVersionName', 'appVersion'],
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
      definitions: this.metricDefinitionsRu(),
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
        .map((row) => {
          const label =
            formatAppVersionLabel({
              appVersionName: row.appVersionName,
              appVersionCode: row.appVersionCode,
              appVersion: row.appVersion,
            }) ?? 'UNKNOWN';
          return {
            appVersion: label,
            versionCode: row.appVersionCode,
            count: row._count._all,
          };
        })
        .sort((a, b) => b.count - a.count),
      generatedAt: now.toISOString(),
    };
  }

  private metricDefinitionsRu() {
    return [
      {
        key: 'activeDevices',
        title: 'Активные устройства (30 дн.)',
        meaning: 'Устройства с lastSeenAt за последние 30 дней и без revokedAt.',
        formula: 'COUNT(DeviceInstallation WHERE revokedAt IS NULL AND lastSeenAt >= now()-30d)',
        source: 'DeviceInstallation.lastSeenAt',
        refresh: 'При каждом запросе страницы',
      },
      {
        key: 'activeLicenses',
        title: 'Активные лицензии',
        meaning: 'Лицензии со статусом ACTIVE и неистёкшим expiresAt.',
        formula: 'COUNT(License WHERE status=ACTIVE AND (expiresAt IS NULL OR expiresAt > now()))',
        source: 'License.status, License.expiresAt',
        refresh: 'При каждом запросе',
      },
      {
        key: 'soldLicenses',
        title: 'Проданные лицензии (Telegram)',
        meaning: 'Лицензии TELEGRAM_PAYMENT с подтверждённым заказом в выбранном периоде.',
        formula: 'COUNT(License issueSource=TELEGRAM_PAYMENT + Order APPROVED/COMPLETED)',
        source: 'License, Order',
        refresh: 'По выбранному периоду продаж',
      },
      {
        key: 'manualIssued',
        title: 'Ручные лицензии',
        meaning: 'Лицензии ADMIN_MANUAL, созданные администратором без Telegram-заказа.',
        formula: 'COUNT(License issueSource=ADMIN_MANUAL)',
        source: 'License.issueSource',
        refresh: 'По выбранному периоду',
      },
      {
        key: 'revenue',
        title: 'Выручка',
        meaning: 'Сумма подтверждённых заказов по approvedAt в периоде.',
        formula: 'SUM(Order.amount WHERE status IN (APPROVED, COMPLETED))',
        source: 'Order.amount, Order.approvedAt',
        refresh: 'По выбранному периоду',
      },
      {
        key: 'activations',
        title: 'Активации устройств',
        meaning: 'Новые LicenseActivation — это не продажи, а привязка устройства к лицензии.',
        formula: 'COUNT(LicenseActivation.createdAt in period)',
        source: 'LicenseActivation',
        refresh: 'По выбранному периоду',
      },
    ];
  }
}
