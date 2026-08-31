/**
 * One-time OWNER bootstrap — creates the first SUPER_ADMIN (OWNER).
 *
 * Usage: npm run admin:bootstrap
 *
 * Requires DATABASE_URL (and DIRECT_URL for migrations) in .env or environment.
 */
import { AdminRoleCode } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { PrismaClient } from '@prisma/client';

const MIN_PASSWORD_LENGTH = 12;
const BCRYPT_ROUNDS = 12;

async function promptHidden(question: string): Promise<string> {
  const rl = readline.createInterface({ input, output });
  const answer = await rl.question(question);
  rl.close();
  return answer;
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();

  try {
    const superAdminRole = await prisma.role.findUnique({
      where: { code: AdminRoleCode.SUPER_ADMIN },
    });

    if (!superAdminRole) {
      console.error('SUPER_ADMIN role not found. Run: npm run prisma:seed');
      process.exit(1);
    }

    const existingOwner = await prisma.adminUserRole.findFirst({
      where: { roleId: superAdminRole.id },
    });

    if (existingOwner) {
      console.error(
        'An OWNER (SUPER_ADMIN) already exists. Bootstrap is allowed only once.',
      );
      console.error('To create additional admins, use a future admin management API.');
      process.exit(1);
    }

    const username = (await promptHidden('Admin username (login email): ')).trim().toLowerCase();
    if (!username || username.length < 3) {
      console.error('Username must be at least 3 characters.');
      process.exit(1);
    }

    const password = await promptHidden(`Admin password (min ${MIN_PASSWORD_LENGTH} chars): `);
    const confirm = await promptHidden('Confirm password: ');

    if (password !== confirm) {
      console.error('Passwords do not match.');
      process.exit(1);
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      console.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const admin = await prisma.adminUser.create({
      data: {
        email: username,
        passwordHash,
        displayName: 'Owner',
        isActive: true,
        roles: {
          create: {
            roleId: superAdminRole.id,
          },
        },
      },
    });

    console.log('');
    console.log('OWNER admin created successfully.');
    console.log(`  id:    ${admin.id}`);
    console.log(`  email: ${admin.email}`);
    console.log(`  role:  SUPER_ADMIN (OWNER)`);
    console.log('');
    console.log('Next: POST /api/v1/admin/auth/login');
    console.log('Never commit passwords or share them in chat logs.');
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error('Bootstrap failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
