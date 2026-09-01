import { PrismaClient } from '@prisma/client';

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const admins = await prisma.adminUser.findMany({
      select: { email: true, isActive: true, createdAt: true, displayName: true },
    });
    console.log('admin_users_count:', admins.length);
    for (const admin of admins) {
      console.log(`- ${admin.email} active=${admin.isActive} created=${admin.createdAt.toISOString()}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main();
