import { PrismaClient } from '@prisma/client';

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const plans = await prisma.plan.findMany({
      where: { isActive: true, code: { in: ['STANDARD', 'PRO'] } },
      include: { prices: { where: { isActive: true }, orderBy: { billingPeriod: 'asc' } } },
    });

    console.log(
      JSON.stringify(
        plans.map((plan) => ({
          code: plan.code,
          prices: plan.prices.map((price) => ({
            billingPeriod: price.billingPeriod,
            amount: price.amount.toString(),
            currency: price.currency,
          })),
        })),
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main();
