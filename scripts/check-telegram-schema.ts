import { PrismaClient } from '@prisma/client';

async function checkTable(prisma: PrismaClient, label: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    const result = await fn();
    console.log(`${label}: OK (${JSON.stringify(result)})`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`${label}: FAIL — ${message.split('\n')[0]}`);
  }
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const migrations = await prisma.$queryRaw<Array<{ migration_name: string; finished_at: Date | null }>>`
      SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY finished_at
    `;
    console.log('Applied migrations:', migrations.map((m) => m.migration_name).join(', '));

    await checkTable(prisma, 'TelegramAccount', () => prisma.telegramAccount.count());
    await checkTable(prisma, 'Order', () => prisma.order.count());
    await checkTable(prisma, 'TelegramProcessedUpdate', () => prisma.telegramProcessedUpdate.count());
    await checkTable(prisma, 'AdminTelegramIdentity', () => prisma.adminTelegramIdentity.count());
    await checkTable(prisma, 'NotificationOutbox', () => prisma.notificationOutbox.count());

    const chatIdCol = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'TelegramAccount' AND column_name = 'chatId'
    `;
    console.log(`TelegramAccount.chatId column: ${chatIdCol.length > 0 ? 'EXISTS' : 'MISSING'}`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
