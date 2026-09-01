import { PrismaClient } from '@prisma/client';

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const admin = await prisma.adminUser.findFirst({ select: { id: true, email: true } });
    if (!admin) {
      console.log(JSON.stringify({ error: 'no admin user' }));
      return;
    }
    const identity = await prisma.adminTelegramIdentity.findUnique({
      where: { adminUserId: admin.id },
    });
    console.log(
      JSON.stringify({
        adminId: admin.id,
        email: admin.email,
        telegramStatus: {
          connected: Boolean(identity),
          isVerified: identity?.isVerified ?? false,
          telegramUserId: identity?.telegramUserId?.toString() ?? null,
        },
      }),
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main();
