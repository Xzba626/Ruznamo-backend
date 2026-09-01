import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BillingPeriod, PlanCode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isPurchasablePlanCode } from './plan-availability.util';

export interface PlanPriceQuote {
  planId: string;
  planCode: PlanCode;
  planName: string;
  billingPeriod: BillingPeriod;
  amount: string;
  currency: string;
}

export interface PurchasePlanView {
  id: string;
  code: PlanCode;
  name: string;
  nameTj: string | null;
  prices: PlanPriceQuote[];
}

export interface PaymentDisplayConfig {
  cardNumber: string | null;
  recipientName: string | null;
  instructions: string | null;
}

@Injectable()
export class PaymentConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async listPurchaseAvailablePlans(): Promise<PurchasePlanView[]> {
    const plans = await this.prisma.plan.findMany({
      where: {
        isActive: true,
        code: { in: [...[PlanCode.STANDARD, PlanCode.PRO]] },
      },
      include: {
        prices: { where: { isActive: true }, orderBy: { billingPeriod: 'asc' } },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return plans
      .filter((plan) => plan.prices.length > 0)
      .map((plan) => ({
        id: plan.id,
        code: plan.code,
        name: plan.name,
        nameTj: plan.nameTj,
        prices: plan.prices.map((price) => ({
          planId: plan.id,
          planCode: plan.code,
          planName: plan.name,
          billingPeriod: price.billingPeriod,
          amount: price.amount.toString(),
          currency: price.currency,
        })),
      }));
  }

  async isPlanAvailableForPurchase(planCode: PlanCode): Promise<boolean> {
    if (!isPurchasablePlanCode(planCode)) {
      return false;
    }

    const plan = await this.prisma.plan.findUnique({
      where: { code: planCode, isActive: true },
      include: { prices: { where: { isActive: true }, take: 1 } },
    });

    return Boolean(plan && plan.prices.length > 0);
  }

  async listActivePlanPrices(planCode: PlanCode): Promise<PlanPriceQuote[]> {
    const plan = await this.prisma.plan.findUnique({
      where: { code: planCode, isActive: true },
      include: {
        prices: { where: { isActive: true }, orderBy: { billingPeriod: 'asc' } },
      },
    });

    if (!plan) {
      return [];
    }

    return plan.prices.map((price) => ({
      planId: plan.id,
      planCode: plan.code,
      planName: plan.name,
      billingPeriod: price.billingPeriod,
      amount: price.amount.toString(),
      currency: price.currency,
    }));
  }

  async getPlanPriceForPurchase(
    planCode: PlanCode,
    billingPeriod: BillingPeriod,
  ): Promise<PlanPriceQuote> {
    if (!(await this.isPlanAvailableForPurchase(planCode))) {
      throw new BadRequestException('Plan is not available for purchase');
    }

    return this.getPlanPrice(planCode, billingPeriod);
  }

  async getPlanPrice(planCode: PlanCode, billingPeriod: BillingPeriod): Promise<PlanPriceQuote> {
    const plan = await this.prisma.plan.findUnique({
      where: { code: planCode },
      include: {
        prices: { where: { billingPeriod, isActive: true }, take: 1 },
      },
    });

    if (!plan || plan.prices.length === 0) {
      throw new NotFoundException(`${planCode} plan price is not configured for ${billingPeriod}`);
    }

    const price = plan.prices[0];
    return {
      planId: plan.id,
      planCode: plan.code,
      planName: plan.name,
      billingPeriod,
      amount: price.amount.toString(),
      currency: price.currency,
    };
  }

  async getStandardPrice(billingPeriod: BillingPeriod): Promise<PlanPriceQuote> {
    return this.getPlanPrice(PlanCode.STANDARD, billingPeriod);
  }

  async getPaymentDisplayConfig(): Promise<PaymentDisplayConfig> {
    const keys = ['PAYMENT_CARD_NUMBER', 'PAYMENT_RECIPIENT_NAME', 'PAYMENT_INSTRUCTIONS_TJ'];
    const rows = await this.prisma.systemConfig.findMany({ where: { key: { in: keys } } });
    const map = Object.fromEntries(rows.map((row) => [row.key, row.value]));

    return {
      cardNumber: map.PAYMENT_CARD_NUMBER ?? null,
      recipientName: map.PAYMENT_RECIPIENT_NAME ?? null,
      instructions: map.PAYMENT_INSTRUCTIONS_TJ ?? null,
    };
  }
}
