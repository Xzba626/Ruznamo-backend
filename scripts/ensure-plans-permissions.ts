/**
 * Idempotent: ensure plans:read and plans:update permissions exist and are granted to ADMIN + SUPER_ADMIN.
 */
import { AdminRoleCode, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

const PLAN_PERMISSIONS = [
  { code: 'plans:read', name: 'Read subscription plans' },
  { code: 'plans:update', name: 'Update subscription plans' },
] as const;

async function main(): Promise<void> {
  const roles = await prisma.role.findMany({
    where: { code: { in: [AdminRoleCode.ADMIN, AdminRoleCode.SUPER_ADMIN] } },
  });

  if (!apply) {
    console.log(
      JSON.stringify(
        {
          mode: 'DRY_RUN',
          permissionsToUpsert: PLAN_PERMISSIONS.map((p) => p.code),
          roleGrants: roles.map((r) => r.code),
          warning: 'Pass --apply to mutate',
        },
        null,
        2,
      ),
    );
    return;
  }

  for (const perm of PLAN_PERMISSIONS) {
    const row = await prisma.permission.upsert({
      where: { code: perm.code },
      update: { name: perm.name },
      create: perm,
    });

    for (const role of roles) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: row.id },
        },
        update: {},
        create: { roleId: role.id, permissionId: row.id },
      });
    }
  }

  console.log(JSON.stringify({ mode: 'APPLY', status: 'ok' }, null, 2));
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
