import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const planPerms = await prisma.permission.findMany({
    where: { code: { startsWith: 'plans:' } },
  });
  const adminRole = await prisma.role.findUnique({
    where: { code: 'ADMIN' },
    include: { permissions: { include: { permission: true } } },
  });
  const superRole = await prisma.role.findUnique({
    where: { code: 'SUPER_ADMIN' },
    include: { permissions: { include: { permission: true } } },
  });

  console.log(
    JSON.stringify(
      {
        planPermissionsInDb: planPerms.map((p) => p.code),
        adminPlanPermissions:
          adminRole?.permissions
            .map((r) => r.permission.code)
            .filter((c) => c.startsWith('plans:')) ?? [],
        superAdminPermissionCount: superRole?.permissions.length ?? 0,
      },
      null,
      2,
    ),
  );
}

void main()
  .finally(() => prisma.$disconnect());
