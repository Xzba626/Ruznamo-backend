import { BadRequestException } from '@nestjs/common';
import { BillingPeriod, PlanCode } from '@prisma/client';
import { AdminPlansService } from './admin-plans.service';

describe('AdminPlansService', () => {
  const prisma = {
    plan: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    planPrice: { update: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
  };

  const auditService = { log: jest.fn() };
  const planBootstrap = { bootstrapMissingCanonicalPlans: jest.fn() };

  const service = new AdminPlansService(prisma as never, auditService as never, planBootstrap as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => Promise<void>) =>
      callback(prisma),
    );
  });

  it('lists Standard and reports missing Pro Plus', async () => {
    prisma.plan.findMany.mockResolvedValue([
      {
        id: 'plan_std',
        code: PlanCode.STANDARD,
        name: 'Standard',
        nameTj: 'Standard',
        isActive: true,
        sortOrder: 1,
        prices: [],
        features: [{ key: 'max_devices', value: '2' }],
        _count: { licenses: 1, orders: 2 },
      },
    ]);

    const result = await service.listPlans();
    expect(result.plans[0].code).toBe(PlanCode.STANDARD);
    expect(result.plans[0].maxDevices).toBe(2);
    expect(result.plans[0].priceConfigured.monthly).toBe(false);
    expect(result.missingCanonicalCodes).toEqual([PlanCode.PRO, PlanCode.PRO_PLUS]);
  });

  it('persists availability toggle with audit event', async () => {
    prisma.plan.findUnique.mockResolvedValue({
      id: 'plan_pro',
      code: PlanCode.PRO,
      isActive: true,
      prices: [],
    });
    prisma.plan.findMany.mockResolvedValue([]);

    await service.updatePlan('admin_1', 'PRO', { isActive: false });

    expect(prisma.plan.update).toHaveBeenCalledWith({
      where: { id: 'plan_pro' },
      data: { isActive: false },
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'plan.purchaseAvailability.changed',
        metadata: expect.objectContaining({
          plan: PlanCode.PRO,
          previousValue: true,
          newValue: false,
        }),
      }),
    );
  });

  it('creates missing PlanPrice rows instead of rejecting', async () => {
    prisma.plan.findUnique.mockResolvedValue({
      id: 'plan_std',
      code: PlanCode.STANDARD,
      isActive: true,
      prices: [],
    });
    prisma.plan.findMany.mockResolvedValue([]);

    await service.updatePlan('admin_1', 'STANDARD', {
      prices: [{ billingPeriod: BillingPeriod.MONTHLY, amount: '22.00' }],
    });

    expect(prisma.planPrice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          planId: 'plan_std',
          billingPeriod: BillingPeriod.MONTHLY,
          amount: '22.00',
        }),
      }),
    );
  });

  it('rejects unknown plan code', async () => {
    await expect(service.updatePlan('admin_1', 'ENTERPRISE', { isActive: false })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('bootstraps missing canonical plans and writes audit', async () => {
    planBootstrap.bootstrapMissingCanonicalPlans.mockResolvedValue({
      created: [PlanCode.STANDARD, PlanCode.PRO, PlanCode.PRO_PLUS],
      alreadyPresent: [],
      featuresCreated: [],
    });
    prisma.plan.findMany.mockResolvedValue([]);

    await service.bootstrapMissing('admin_1');

    expect(planBootstrap.bootstrapMissingCanonicalPlans).toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'plan.system.bootstrapped' }),
    );
  });
});
