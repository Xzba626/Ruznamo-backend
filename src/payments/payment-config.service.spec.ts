import { BadRequestException } from '@nestjs/common';
import { BillingPeriod, PlanCode } from '@prisma/client';
import { PaymentConfigService } from './payment-config.service';

describe('PaymentConfigService plan availability', () => {
  const prisma = {
    plan: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const service = new PaymentConfigService(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it('returns only DB-active plans with at least one active price', async () => {
    prisma.plan.findMany.mockResolvedValue([
      {
        id: 'plan_std',
        code: PlanCode.STANDARD,
        name: 'Standard',
        nameTj: 'Стандарт',
        prices: [
          {
            billingPeriod: BillingPeriod.MONTHLY,
            amount: { toString: () => '15.00' },
            currency: 'TJS',
          },
        ],
      },
      {
        id: 'plan_pro',
        code: PlanCode.PRO,
        name: 'Pro',
        nameTj: 'Pro',
        prices: [],
      },
    ]);

    const plans = await service.listPurchaseAvailablePlans();

    expect(prisma.plan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
    expect(plans).toHaveLength(1);
    expect(plans[0].code).toBe(PlanCode.STANDARD);
  });

  it('reports Standard ON / Pro OFF from DB state', async () => {
    prisma.plan.findUnique.mockImplementation(async ({ where }: { where: { code: PlanCode; isActive?: boolean } }) => {
      if (where.code === PlanCode.STANDARD && where.isActive === true) {
        return {
          id: 'plan_std',
          code: PlanCode.STANDARD,
          isActive: true,
          prices: [{ billingPeriod: BillingPeriod.MONTHLY }],
        };
      }
      return null;
    });

    await expect(service.isPlanAvailableForPurchase(PlanCode.STANDARD)).resolves.toBe(true);
    await expect(service.isPlanAvailableForPurchase(PlanCode.PRO)).resolves.toBe(false);
  });

  it('rejects purchase when plan is active but billing period price is missing', async () => {
    prisma.plan.findUnique.mockResolvedValue({
      id: 'plan_pro',
      code: PlanCode.PRO,
      isActive: true,
      prices: [],
    });

    await expect(
      service.getPlanPriceForPurchase(PlanCode.PRO, BillingPeriod.YEARLY),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.isPlanPeriodAvailableForPurchase(PlanCode.PRO, BillingPeriod.YEARLY),
    ).resolves.toBe(false);
  });

  it('does not treat Standard as purchasable when prices are missing', async () => {
    prisma.plan.findMany.mockResolvedValue([
      {
        id: 'plan_std',
        code: PlanCode.STANDARD,
        name: 'Standard',
        nameTj: 'Standard',
        prices: [],
      },
    ]);
    prisma.plan.findUnique.mockResolvedValue({
      id: 'plan_std',
      code: PlanCode.STANDARD,
      isActive: true,
      prices: [],
    });

    await expect(service.listPurchaseAvailablePlans()).resolves.toEqual([]);
    await expect(service.isPlanAvailableForPurchase(PlanCode.STANDARD)).resolves.toBe(false);
    await expect(
      service.getPlanPriceForPurchase(PlanCode.STANDARD, BillingPeriod.MONTHLY),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns no purchase plans when the catalog is empty', async () => {
    prisma.plan.findMany.mockResolvedValue([]);
    await expect(service.listPurchaseAvailablePlans()).resolves.toEqual([]);
  });
});
