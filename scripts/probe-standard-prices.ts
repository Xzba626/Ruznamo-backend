/**
 * Read Standard PlanPrice from DB (production or local via DATABASE_URL).
 * Usage: npx ts-node scripts/probe-standard-prices.ts
 */
import { BillingPeriod, PlanCode } from '@prisma/client';
import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const plan = await prisma.plan.findUnique({
      where: { code: PlanCode.STANDARD },
      include: {
        prices: { where: { isActive: true }, orderBy: { billingPeriod: 'asc' } },
        features: { where: { key: 'max_devices' } },
      },
    });

    if (!plan) {
      console.log('Standard plan not found');
      process.exit(1);
    }

    const monthly = plan.prices.find((p) => p.billingPeriod === BillingPeriod.MONTHLY);
    const yearly = plan.prices.find((p) => p.billingPeriod === BillingPeriod.YEARLY);
    const maxDevices = plan.features[0]?.value ?? 'unknown';

    console.log('=== PRODUCTION / DB Standard PlanPrice ===');
    console.log(`MONTHLY = ${monthly?.amount?.toString() ?? 'MISSING'} ${monthly?.currency ?? ''}`);
    console.log(`YEARLY  = ${yearly?.amount?.toString() ?? 'MISSING'} ${yearly?.currency ?? ''}`);
    console.log(`max_devices = ${maxDevices}`);
    console.log('');
    console.log('REQUIRED: MONTHLY = 20 TJS, YEARLY = 250 TJS, max_devices = 2');

    const monthlyOk = monthly?.amount?.toString() === '20';
    const yearlyOk = yearly?.amount?.toString() === '250';
    console.log('');
    console.log(`MONTHLY OK: ${monthlyOk}`);
    console.log(`YEARLY OK:  ${yearlyOk}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
