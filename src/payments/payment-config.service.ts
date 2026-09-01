import { Injectable } from '@nestjs/common';
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

export interface PaymentDisplayConfig {
  cardNumber: string | null;
  recipientName: string | null;
  instructions: string | null;
}

@Injectable()
export class PaymentConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getPlanPrice(planCode: PlanCode, billingPeriod: BillingPeriod): Promise<PlanPriceQuote> {
    const plan = await this.prisma.plan.findUnique({
      where: { code: planCode },
      include: {
        prices: { where: { billingPeriod, isActive: true }, take: 1 },
      },
    });

    if (!plan || plan.prices.length === 0) {
      throw new Error(`${planCode} plan price is not configured for ${billingPeriod}`);
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
