import { PrismaClient } from '@prisma/client';

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const counts = {
      AdminTelegramIdentity: await prisma.adminTelegramIdentity.count(),
      AdminTelegramLinkToken: await prisma.adminTelegramLinkToken.count(),
      TelegramProcessedUpdate: await prisma.telegramProcessedUpdate.count(),
    };
    console.log(JSON.stringify(counts, null, 2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ error: message }));
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
