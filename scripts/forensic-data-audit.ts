/**
 * Read-only production data forensic audit.
 * Does NOT mutate data. Safe to run against production.
 */
import {
  LicenseStatus,
  OrderStatus,
  PrismaClient,
  TrialGrantStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

function jsonReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
}

function print(data: unknown): void {
  console.log(JSON.stringify(data, jsonReplacer, 2));
}

async function main(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL ?? '';
  let host = 'unknown';
  try {
    host = new URL(dbUrl.replace('postgresql://', 'http://')).hostname;
  } catch {
    /* ignore */
  }

  const now = new Date();

  const counts = {
    User: await prisma.user.count(),
    AdminUser: await prisma.adminUser.count(),
    DeviceInstallation: await prisma.deviceInstallation.count(),
    License: await prisma.license.count(),
    LicenseActivation: await prisma.licenseActivation.count(),
    TelegramAccount: await prisma.telegramAccount.count(),
    Order: await prisma.order.count(),
    Receipt: await prisma.receipt.count(),
    TrialGrant: await prisma.trialGrant.count(),
    AuditLog: await prisma.auditLog.count(),
  };

  const ordersByStatus = await prisma.order.groupBy({
    by: ['status'],
    _count: { _all: true },
  });

  const licensesByStatus = await prisma.license.groupBy({
    by: ['status'],
    _count: { _all: true },
  });

  const appVersions = await prisma.deviceInstallation.groupBy({
    by: ['appVersion'],
    where: { revokedAt: null },
    _count: { _all: true },
  });

  const appVersionConfig = await prisma.appVersion.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: 'desc' },
  });

  const categoryDist = await prisma.user.groupBy({
    by: ['category'],
    _count: { _all: true },
  });

  // License journey: orders with license + activations
  const ordersWithLicense = await prisma.order.findMany({
    where: { license: { isNot: null } },
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          telegramAccount: { select: { telegramId: true, username: true } },
        },
      },
      license: {
        include: {
          activations: {
            include: {
              device: {
                select: {
                  id: true,
                  installationId: true,
                  deviceName: true,
                  appVersion: true,
                  userId: true,
                  lastSeenAt: true,
                },
              },
            },
          },
        },
      },
      plan: { select: { code: true } },
    },
  });

  const licenseJourneys = ordersWithLicense.map((order) => ({
    orderId: order.id,
    orderStatus: order.status,
    plan: order.plan.code,
    purchaserUserId: order.user.id,
    purchaserDisplayName: order.user.displayName,
    telegramId: order.user.telegramAccount?.telegramId?.toString() ?? null,
    telegramUsername: order.user.telegramAccount?.username ?? null,
    licenseId: order.license?.id ?? null,
    licenseStatus: order.license?.status ?? null,
    licenseKeyPrefix: order.license?.keyPrefix ?? null,
    activationCount: order.license?.activations.length ?? 0,
    activations: (order.license?.activations ?? []).map((a) => ({
      activationId: a.id,
      activatedAt: a.createdAt,
      deviceId: a.device.id,
      installationIdMasked:
        a.device.installationId.length > 10
          ? `${a.device.installationId.slice(0, 4)}…${a.device.installationId.slice(-4)}`
          : a.device.installationId,
      deviceName: a.device.deviceName,
      appVersion: a.device.appVersion,
      mobileUserId: a.device.userId,
      sameUserAsPurchaser: a.device.userId === order.user.id,
    })),
  }));

  // Test data heuristics (classification only — no deletion)
  const testDevicePatterns = await prisma.deviceInstallation.findMany({
    where: {
      OR: [
        { deviceName: { contains: 'test', mode: 'insensitive' } },
        { deviceName: { contains: 'emulator', mode: 'insensitive' } },
        { installationId: { startsWith: 'test-' } },
        { installationId: { startsWith: 'demo-' } },
      ],
    },
    select: { id: true, deviceName: true, installationId: true, createdAt: true },
    take: 50,
  });

  const testUsers = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: 'test', mode: 'insensitive' } },
        { email: { contains: 'example.com', mode: 'insensitive' } },
        { displayName: { contains: 'test', mode: 'insensitive' } },
      ],
    },
    select: { id: true, email: true, displayName: true, createdAt: true },
    take: 50,
  });

  const auditTestActions = await prisma.auditLog.count({
    where: {
      OR: [
        { action: { contains: 'test', mode: 'insensitive' } },
        { entityType: { contains: 'Test', mode: 'insensitive' } },
      ],
    },
  });

  const activeDevices30d = await prisma.deviceInstallation.count({
    where: {
      revokedAt: null,
      lastSeenAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
    },
  });

  const activeLicenses = await prisma.license.count({
    where: {
      status: LicenseStatus.ACTIVE,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
  });

  const activeTrials = await prisma.trialGrant.count({
    where: { status: TrialGrantStatus.ACTIVE, expiresAt: { gt: now } },
  });

  print({
    host,
    generatedAt: now.toISOString(),
    counts,
    ordersByStatus,
    licensesByStatus,
    categoryDist,
    appVersionsFromDevices: appVersions,
    appVersionConfig,
    operationalMetrics: {
      activeDevices30d,
      activeLicenses,
      activeTrials,
    },
    licenseJourneys,
    testDataClassification: {
      likelyTestDevices: { count: testDevicePatterns.length, sample: testDevicePatterns },
      likelyTestUsers: { count: testUsers.length, sample: testUsers },
      auditLogsWithTestPattern: auditTestActions,
      note: 'Classification is heuristic only. Review before any deletion.',
    },
  });
}

void main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
