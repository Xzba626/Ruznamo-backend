import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const orders = await prisma.order.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      plan: { select: { code: true, name: true } },
      user: {
        select: {
          id: true,
          displayName: true,
          email: true,
          telegramAccount: { select: { telegramId: true, username: true, firstName: true } },
        },
      },
      receipts: { select: { id: true }, take: 1 },
      license: { select: { id: true, keyPrefix: true, status: true } },
    },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        count: orders.length,
        sample: orders.map((o) => ({
          id: o.id,
          status: o.status,
          plan: o.plan.code,
          paymentMethodName: o.paymentMethodName,
          hasReceipt: o.receipts.length > 0,
        })),
      },
      (_, v) => (typeof v === 'bigint' ? v.toString() : v),
      2,
    ),
  );
}

void main()
  .catch((error) => {
    console.error('ORDER_LIST_PROBE_FAIL', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
