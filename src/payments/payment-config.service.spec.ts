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

  it('returns only active purchasable plans with prices', async () => {
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
    ]);

    const plans = await service.listPurchaseAvailablePlans();

    expect(plans).toHaveLength(1);
    expect(plans[0].code).toBe(PlanCode.STANDARD);
  });

  it('reports Standard ON / Pro OFF correctly', async () => {
    prisma.plan.findUnique.mockImplementation(async ({ where }: { where: { code: PlanCode; isActive?: boolean } }) => {
      if (where.code === PlanCode.STANDARD) {
        return { id: 'plan_std', code: PlanCode.STANDARD, isActive: true, prices: [{ billingPeriod: BillingPeriod.MONTHLY }] };
      }
      return null;
    });

    await expect(service.isPlanAvailableForPurchase(PlanCode.STANDARD)).resolves.toBe(true);
    await expect(service.isPlanAvailableForPurchase(PlanCode.PRO)).resolves.toBe(false);
  });

  it('rejects purchase price lookup for disabled plan', async () => {
    prisma.plan.findUnique.mockResolvedValue(null);

    await expect(
      service.getPlanPriceForPurchase(PlanCode.PRO, BillingPeriod.YEARLY),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
