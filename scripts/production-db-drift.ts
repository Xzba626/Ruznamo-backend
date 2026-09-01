/**
 * Read-only production DB drift probe. No secrets printed.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function jsonReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  return value;
}

async function main(): Promise<void> {
  const host = (() => {
    try {
      return new URL((process.env.DATABASE_URL ?? '').replace('postgresql://', 'http://')).hostname;
    } catch {
      return 'unknown';
    }
  })();

  const counts = {
    User: await prisma.user.count(),
    TelegramAccount: await prisma.telegramAccount.count(),
    DeviceInstallation: await prisma.deviceInstallation.count(),
    TrialGrant: await prisma.trialGrant.count(),
    Plan: await prisma.plan.count(),
    PlanPrice: await prisma.planPrice.count(),
    Order: await prisma.order.count(),
    Receipt: await prisma.receipt.count(),
    License: await prisma.license.count(),
    LicenseActivation: await prisma.licenseActivation.count(),
    PaymentMethod: await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'PaymentMethod'
    `.then((rows) => (rows[0]?.count ?? 0n) > 0n ? prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*)::bigint AS count FROM "PaymentMethod"` : [{ count: 0n }]).then((r) => Number(r[0]?.count ?? 0)),
    TelegramProcessedUpdate: await prisma.telegramProcessedUpdate.count(),
    AdminUser: await prisma.adminUser.count(),
    AuditLog: await prisma.auditLog.count(),
  };

  const migrations = await prisma.$queryRaw<
    Array<{ migration_name: string; finished_at: Date | null }>
  >`SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY finished_at`;

  const orderColumns = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Order'
    ORDER BY column_name
  `;

  const plans = await prisma.plan.findMany({
    select: { code: true, isActive: true, name: true },
    orderBy: { sortOrder: 'asc' },
  });

  let orderQueryError: string | null = null;
  try {
    await prisma.order.findMany({ take: 1 });
  } catch (error) {
    orderQueryError =
      error instanceof Error ? `${(error as { code?: string }).code ?? 'ERR'}: ${error.message}` : 'unknown';
  }

  const repoMigrations = [
    '20260830101500_init',
    '20260830181500_admin_auth',
    '20260831133000_audit_log_polymorphic_actor',
    '20260831120000_mobile_refresh_device',
    '20260831180000_telegram_payment_flow',
    '20260901120000_telegram_account_language',
    '20260901180000_payment_methods_and_telegram_nav',
    '20260901200000_pro_plan_commercial_disable',
  ];

  const applied = new Set(migrations.map((m) => m.migration_name));
  const missing = repoMigrations.filter((name) => !applied.has(name));

  console.log(
    JSON.stringify(
      {
        host,
        counts,
        plans,
        orderColumns: orderColumns.map((c) => c.column_name),
        orderQueryError,
        appliedMigrationCount: migrations.length,
        missingMigrations: missing,
        lastMigrations: migrations.slice(-3).map((m) => ({
          name: m.migration_name,
          finished_at: m.finished_at,
        })),
      },
      jsonReplacer,
      2,
    ),
  );
}

void main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
