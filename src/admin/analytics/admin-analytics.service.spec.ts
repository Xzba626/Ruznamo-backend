import { Test, TestingModule } from '@nestjs/testing';
import { AdminAnalyticsService } from './admin-analytics.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AdminAnalyticsService', () => {
  let service: AdminAnalyticsService;

  const prisma = {
    deviceInstallation: { count: jest.fn(), groupBy: jest.fn() },
    trialGrant: { count: jest.fn() },
    license: { count: jest.fn(), groupBy: jest.fn() },
    user: { count: jest.fn(), groupBy: jest.fn() },
    order: { groupBy: jest.fn(), count: jest.fn(), aggregate: jest.fn(), findMany: jest.fn() },
    licenseActivation: { count: jest.fn() },
    plan: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.deviceInstallation.count.mockResolvedValue(5);
    prisma.deviceInstallation.groupBy.mockResolvedValue([
      { appVersion: '1.0.1', _count: { _all: 3 } },
      { appVersion: null, _count: { _all: 2 } },
    ]);
    prisma.trialGrant.count.mockResolvedValue(1);
    prisma.license.count.mockResolvedValue(2);
    prisma.user.count.mockResolvedValue(1);
    prisma.order.groupBy.mockResolvedValue([{ status: 'PENDING', _count: { _all: 1 } }]);
    prisma.license.groupBy.mockResolvedValue([{ planId: 'plan_1', _count: { _all: 2 } }]);
    prisma.user.groupBy.mockResolvedValue([{ category: 'TEACHER', _count: { _all: 4 } }]);
    prisma.licenseActivation.count.mockResolvedValue(1);
    prisma.order.count.mockResolvedValue(1);
    prisma.order.aggregate.mockResolvedValue({ _sum: { amount: 100 } });
    prisma.order.findMany.mockResolvedValue([{ billingPeriod: 'MONTHLY', currency: 'TJS', amount: 100 }]);
    prisma.plan.findMany.mockResolvedValue([{ id: 'plan_1', code: 'STANDARD', name: 'Standard' }]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminAnalyticsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(AdminAnalyticsService);
  });

  it('returns aggregate overview without PII fields', async () => {
    const result = await service.getOverview();

    expect(result.totals.devices).toBe(5);
    expect(result.appVersionDistribution[0].appVersion).toBe('1.0.1');
    expect(result).not.toHaveProperty('users');
    expect(result.definitions.activeDevice).toContain('30');
  });

  it('returns sales metrics separating sold vs manual', async () => {
    prisma.license.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(5);
    prisma.license.groupBy.mockResolvedValue([{ planId: 'plan_1', _count: { _all: 3 } }]);
    prisma.licenseActivation.count.mockResolvedValue(2);

    const result = await service.getSales('30d');

    expect(result.sold.total).toBe(3);
    expect(result.manualIssued).toBe(1);
    expect(result.revenue.grossApproved).toBe('100');
    expect(result.definitions.sold).toContain('TELEGRAM_PAYMENT');
  });
});
