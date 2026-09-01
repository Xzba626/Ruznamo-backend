import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BillingPeriod, PlanCode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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

  /**
   * Commercially available plans:
   * Plan.isActive = true AND at least one PlanPrice with isActive = true.
   * No hardcoded plan whitelist — DB is authoritative.
   */
  async listPurchaseAvailablePlans(): Promise<PurchasePlanView[]> {
    const plans = await this.prisma.plan.findMany({
      where: { isActive: true },
      include: {
        prices: { where: { isActive: true }, orderBy: { billingPeriod: 'asc' } },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return plans
      .filter((plan) => plan.prices.length > 0)
      .map((plan) => this.toPurchasePlanView(plan));
  }

  async isPlanAvailableForPurchase(planCode: PlanCode): Promise<boolean> {
    const plan = await this.prisma.plan.findUnique({
      where: { code: planCode, isActive: true },
      include: { prices: { where: { isActive: true }, take: 1 } },
    });

    return Boolean(plan && plan.prices.length > 0);
  }

  async isPlanPeriodAvailableForPurchase(
    planCode: PlanCode,
    billingPeriod: BillingPeriod,
  ): Promise<boolean> {
    const plan = await this.prisma.plan.findUnique({
      where: { code: planCode, isActive: true },
      include: {
        prices: { where: { billingPeriod, isActive: true }, take: 1 },
      },
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

    return plan.prices.map((price) => this.toPriceQuote(plan, price));
  }

  async getPlanPriceForPurchase(
    planCode: PlanCode,
    billingPeriod: BillingPeriod,
  ): Promise<PlanPriceQuote> {
    const plan = await this.prisma.plan.findUnique({
      where: { code: planCode, isActive: true },
      include: {
        prices: { where: { billingPeriod, isActive: true }, take: 1 },
      },
    });

    if (!plan || plan.prices.length === 0) {
      throw new BadRequestException('Plan is not available for purchase');
    }

    return this.toPriceQuote(plan, plan.prices[0]);
  }

  /** Historical / admin use — does not enforce commercial availability. */
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

    return this.toPriceQuote(plan, plan.prices[0]);
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

  private toPriceQuote(
    plan: { id: string; code: PlanCode; name: string },
    price: { billingPeriod: BillingPeriod; amount: { toString(): string }; currency: string },
  ): PlanPriceQuote {
    return {
      planId: plan.id,
      planCode: plan.code,
      planName: plan.name,
      billingPeriod: price.billingPeriod,
      amount: price.amount.toString(),
      currency: price.currency,
    };
  }

  private toPurchasePlanView(plan: {
    id: string;
    code: PlanCode;
    name: string;
    nameTj: string | null;
    prices: Array<{
      billingPeriod: BillingPeriod;
      amount: { toString(): string };
      currency: string;
    }>;
  }): PurchasePlanView {
    return {
      id: plan.id,
      code: plan.code,
      name: plan.name,
      nameTj: plan.nameTj,
      prices: plan.prices.map((price) => this.toPriceQuote(plan, price)),
    };
  }
}
