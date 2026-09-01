import { PrismaClient } from '@prisma/client';

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const dbUrl = process.env.DATABASE_URL ?? '';
    let host = 'unknown';
    try {
      host = new URL(dbUrl.replace('postgresql://', 'http://')).hostname;
    } catch {
      /* ignore */
    }

    const counts = {
      User: await prisma.user.count(),
      AdminUser: await prisma.adminUser.count(),
      DeviceInstallation: await prisma.deviceInstallation.count(),
      License: await prisma.license.count(),
      TelegramAccount: await prisma.telegramAccount.count(),
      Order: await prisma.order.count(),
      Receipt: await prisma.receipt.count(),
      AuditLog: await prisma.auditLog.count(),
    };

    const devices = await prisma.deviceInstallation.findMany({
      select: {
        id: true,
        deviceName: true,
        installationId: true,
        platform: true,
        revokedAt: true,
        createdAt: true,
        user: { select: { displayName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const users = await prisma.user.findMany({
      select: { id: true, displayName: true, email: true, phone: true, createdAt: true },
      take: 10,
    });

    const telegramAccounts = await prisma.telegramAccount.findMany({
      select: { telegramId: true, username: true, userId: true },
      take: 10,
    });

    console.log(JSON.stringify({ host, counts, devices, users, telegramAccounts }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

void main();
