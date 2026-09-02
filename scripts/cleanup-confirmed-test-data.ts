/**
 * Safe test-data cleanup — DRY-RUN by default.
 * Requires explicit --apply to mutate. SUPERADMIN review required before --apply on production.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

const TEST_EMAIL_PATTERNS = ['@example.com', '@test.', 'test@', '+test'];
const TEST_DISPLAY_PATTERNS = ['test user', 'demo user', 'e2e', 'testuser'];
const TEST_DEVICE_NAME_PATTERNS = [
  'emulator',
  'test device',
  'android emulator',
  'test android',
  'local test',
  'production test',
];
const TEST_INSTALLATION_PREFIXES = ['test-', 'demo-', 'e2e-'];
const TEST_INSTALLATION_IDS = [
  '550e8400-e29b-41d4-a716-446655440000',
  'a1b2c3d4-e5f6-4789-a012-3456789abcde',
  'b2c3d4e5-f6a7-4890-b123-456789abcdef',
  'c3d4e5f6-a7b8-4a01-8234-567890abcdef',
];

type Selection = {
  users: string[];
  devices: string[];
  telegramAccounts: string[];
  orders: string[];
  licenses: string[];
  activations: string[];
  trials: string[];
  auditLogs: string[];
};

async function findTestUsers(): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        ...TEST_EMAIL_PATTERNS.map((pattern) => ({
          email: { contains: pattern, mode: 'insensitive' as const },
        })),
        ...TEST_DISPLAY_PATTERNS.map((pattern) => ({
          displayName: { contains: pattern, mode: 'insensitive' as const },
        })),
      ],
    },
    select: { id: true, email: true, displayName: true },
  });

  return users.map((user) => user.id);
}

async function findTestDevices(): Promise<string[]> {
  const devices = await prisma.deviceInstallation.findMany({
    where: {
      OR: [
        ...TEST_DEVICE_NAME_PATTERNS.map((pattern) => ({
          deviceName: { contains: pattern, mode: 'insensitive' as const },
        })),
        ...TEST_INSTALLATION_PREFIXES.map((prefix) => ({
          installationId: { startsWith: prefix },
        })),
        ...TEST_INSTALLATION_IDS.map((installationId) => ({ installationId })),
      ],
    },
    select: { id: true, installationId: true, deviceName: true },
  });

  return devices.map((device) => device.id);
}

async function buildSelection(): Promise<Selection> {
  const userIds = await findTestUsers();
  const deviceIds = await findTestDevices();

  const telegramAccounts = userIds.length
    ? await prisma.telegramAccount.findMany({
        where: { userId: { in: userIds } },
        select: { id: true },
      })
    : [];

  const orders = userIds.length
    ? await prisma.order.findMany({
        where: { userId: { in: userIds } },
        select: { id: true },
      })
    : [];

  const orderIds = orders.map((order) => order.id);

  const licenses = [
    ...(userIds.length
      ? await prisma.license.findMany({ where: { userId: { in: userIds } }, select: { id: true } })
      : []),
    ...(orderIds.length
      ? await prisma.license.findMany({ where: { orderId: { in: orderIds } }, select: { id: true } })
      : []),
  ];

  const licenseIds = [...new Set(licenses.map((license) => license.id))];

  const activations = licenseIds.length
    ? await prisma.licenseActivation.findMany({
        where: { OR: [{ licenseId: { in: licenseIds } }, { deviceId: { in: deviceIds } }] },
        select: { id: true },
      })
    : [];

  const trials = userIds.length
    ? await prisma.trialGrant.findMany({ where: { userId: { in: userIds } }, select: { id: true } })
    : [];

  const auditLogs = await prisma.auditLog.findMany({
    where: {
      OR: [
        { action: { contains: '.test.', mode: 'insensitive' } },
        { entityType: { contains: 'Test', mode: 'insensitive' } },
      ],
    },
    select: { id: true },
    take: 500,
  });

  return {
    users: userIds,
    devices: deviceIds,
    telegramAccounts: telegramAccounts.map((row) => row.id),
    orders: orderIds,
    licenses: licenseIds,
    activations: activations.map((row) => row.id),
    trials: trials.map((row) => row.id),
    auditLogs: auditLogs.map((row) => row.id),
  };
}

function totalSelected(selection: Selection): number {
  return Object.values(selection).reduce((sum, ids) => sum + ids.length, 0);
}

async function applyDeletion(selection: Selection): Promise<void> {
  await prisma.$transaction(async (tx) => {
    if (selection.activations.length) {
      await tx.licenseActivation.deleteMany({ where: { id: { in: selection.activations } } });
    }
    if (selection.trials.length) {
      await tx.trialGrant.deleteMany({ where: { id: { in: selection.trials } } });
    }
    if (selection.licenses.length) {
      await tx.licenseEvent.deleteMany({ where: { licenseId: { in: selection.licenses } } });
      await tx.license.deleteMany({ where: { id: { in: selection.licenses } } });
    }
    if (selection.orders.length) {
      await tx.receipt.deleteMany({ where: { orderId: { in: selection.orders } } });
      await tx.order.deleteMany({ where: { id: { in: selection.orders } } });
    }
    if (selection.telegramAccounts.length) {
      await tx.telegramAccount.deleteMany({ where: { id: { in: selection.telegramAccounts } } });
    }
    if (selection.devices.length) {
      await tx.refreshToken.deleteMany({ where: { deviceId: { in: selection.devices } } });
      await tx.deviceInstallation.deleteMany({ where: { id: { in: selection.devices } } });
    }
    if (selection.users.length) {
      await tx.refreshToken.deleteMany({ where: { userId: { in: selection.users } } });
      await tx.user.deleteMany({ where: { id: { in: selection.users } } });
    }
    if (selection.auditLogs.length) {
      await tx.auditLog.deleteMany({ where: { id: { in: selection.auditLogs } } });
    }
  });
}

async function main(): Promise<void> {
  const selection = await buildSelection();
  const total = totalSelected(selection);

  console.log(
    JSON.stringify(
      {
        mode: apply ? 'APPLY' : 'DRY_RUN',
        criteria: {
          emailPatterns: TEST_EMAIL_PATTERNS,
          displayNamePatterns: TEST_DISPLAY_PATTERNS,
          deviceNamePatterns: TEST_DEVICE_NAME_PATTERNS,
          installationIdPrefixes: TEST_INSTALLATION_PREFIXES,
          auditActionPatterns: ['.test.', 'Test entityType'],
        },
        counts: {
          users: selection.users.length,
          devices: selection.devices.length,
          telegramAccounts: selection.telegramAccounts.length,
          orders: selection.orders.length,
          licenses: selection.licenses.length,
          activations: selection.activations.length,
          trials: selection.trials.length,
          auditLogs: selection.auditLogs.length,
          total,
        },
        sampleIds: {
          users: selection.users.slice(0, 5),
          devices: selection.devices.slice(0, 5),
          orders: selection.orders.slice(0, 5),
        },
        warning:
          total === 0
            ? 'Nothing matched — no mutation.'
            : apply
              ? 'Mutation executed.'
              : 'DRY_RUN only. Pass --apply after human review.',
      },
      null,
      2,
    ),
  );

  if (!apply || total === 0) {
    return;
  }

  await applyDeletion(selection);
}

void main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
