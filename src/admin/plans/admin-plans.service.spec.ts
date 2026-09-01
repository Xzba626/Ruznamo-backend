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
    planPrice: { update: jest.fn() },
    $transaction: jest.fn(),
  };

  const auditService = { log: jest.fn() };

  const service = new AdminPlansService(prisma as never, auditService as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => Promise<void>) =>
      callback(prisma),
    );
  });

  it('lists Standard and Pro plans', async () => {
    prisma.plan.findMany.mockResolvedValue([
      {
        id: 'plan_std',
        code: PlanCode.STANDARD,
        name: 'Standard',
        nameTj: 'Стандарт',
        isActive: true,
        sortOrder: 1,
        prices: [],
        _count: { licenses: 1, orders: 2 },
      },
    ]);

    const plans = await service.listPlans();
    expect(plans[0].code).toBe(PlanCode.STANDARD);
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

  it('rejects unknown plan code', async () => {
    await expect(service.updatePlan('admin_1', 'ENTERPRISE', { isActive: false })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
