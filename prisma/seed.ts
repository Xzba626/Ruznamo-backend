import {
  AdminRoleCode,
  BillingPeriod,
  FeatureValueType,
  PlanCode,
  Platform,
  PrismaClient,
} from '@prisma/client';

const prisma = new PrismaClient();

const PERMISSIONS = [
  { code: 'users:read', name: 'Read users' },
  { code: 'users:update', name: 'Update users' },
  { code: 'users:suspend', name: 'Suspend users' },
  { code: 'users:activate', name: 'Activate users' },
  { code: 'licenses:read', name: 'Read licenses' },
  { code: 'licenses:create', name: 'Create licenses' },
  { code: 'licenses:revoke', name: 'Revoke licenses' },
  { code: 'licenses:extend', name: 'Extend licenses' },
  { code: 'orders:read', name: 'Read orders' },
  { code: 'orders:approve', name: 'Approve orders' },
  { code: 'orders:reject', name: 'Reject orders' },
  { code: 'receipts:read', name: 'Read receipts' },
  { code: 'devices:read', name: 'Read devices' },
  { code: 'dashboard:read', name: 'Read dashboard' },
  { code: 'config:read', name: 'Read configuration' },
  { code: 'config:update', name: 'Update configuration' },
  { code: 'audit:read', name: 'Read audit logs' },
] as const;

const ROLE_PERMISSIONS: Record<AdminRoleCode, string[]> = {
  SUPER_ADMIN: PERMISSIONS.map((p) => p.code),
  ADMIN: [
    'users:read',
    'users:update',
    'users:suspend',
    'users:activate',
    'licenses:read',
    'licenses:create',
    'licenses:revoke',
    'licenses:extend',
    'orders:read',
    'orders:approve',
    'orders:reject',
    'receipts:read',
    'devices:read',
    'dashboard:read',
    'config:read',
    'audit:read',
  ],
  SUPPORT: [
    'users:read',
    'licenses:read',
    'orders:read',
    'receipts:read',
    'devices:read',
    'dashboard:read',
    'audit:read',
  ],
};

const SYSTEM_CONFIG = [
  { key: 'CONFIG_VERSION', value: '1' },
  { key: 'TRIAL_DURATION_HOURS', value: '24' },
  {
    key: 'PAYMENT_INSTRUCTIONS_TJ',
    value:
      'Барои пардохт 15 TJS (моҳ) ё 150 TJS (сол) ба ҳисоби зерин маблағ гузоред ва чеки пардохтро дар ин бот ирсол кунед.',
  },
  { key: 'MAINTENANCE_MODE', value: 'false' },
  { key: 'MAINTENANCE_MESSAGE_TJ', value: '' },
  { key: 'PAYMENT_CARD_NUMBER', value: '' },
  { key: 'PAYMENT_RECIPIENT_NAME', value: '' },
  { key: 'ANNOUNCEMENT_ENABLED', value: 'false' },
  { key: 'ANNOUNCEMENT_TITLE', value: '' },
  { key: 'ANNOUNCEMENT_MESSAGE', value: '' },
  { key: 'ANNOUNCEMENT_TYPE', value: 'INFO' },
] as const;

async function seedPermissionsAndRoles() {
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: { name: permission.name },
      create: permission,
    });
  }

  for (const [roleCode, permissionCodes] of Object.entries(ROLE_PERMISSIONS) as [
    AdminRoleCode,
    string[],
  ][]) {
    const role = await prisma.role.upsert({
      where: { code: roleCode },
      update: { name: roleCode.replace('_', ' ') },
      create: {
        code: roleCode,
        name: roleCode.replace('_', ' '),
      },
    });

    const permissions = await prisma.permission.findMany({
      where: { code: { in: permissionCodes } },
    });

    for (const permission of permissions) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
  }
}

async function seedStandardPlan() {
  const plan = await prisma.plan.upsert({
    where: { code: PlanCode.STANDARD },
    update: {
      name: 'Standard',
      nameTj: 'Стандарт',
      isActive: true,
      sortOrder: 1,
    },
    create: {
      code: PlanCode.STANDARD,
      name: 'Standard',
      nameTj: 'Стандарт',
      isActive: true,
      sortOrder: 1,
    },
  });

  await prisma.plan.upsert({
    where: { code: PlanCode.PRO },
    update: {
      name: 'Pro',
      nameTj: 'Pro',
      isActive: true,
      sortOrder: 2,
    },
    create: {
      code: PlanCode.PRO,
      name: 'Pro',
      nameTj: 'Pro',
      isActive: true,
      sortOrder: 2,
    },
  });

  const proPlan = await prisma.plan.findUnique({ where: { code: PlanCode.PRO } });
  if (proPlan) {
    const proFeatures = [
      { key: 'planning_horizon_days', value: '90', valueType: FeatureValueType.INT },
      { key: 'max_devices', value: '2', valueType: FeatureValueType.INT },
      { key: 'cloud_sync', value: 'true', valueType: FeatureValueType.BOOL },
      { key: 'advanced_analytics', value: 'true', valueType: FeatureValueType.BOOL },
    ] as const;

    for (const feature of proFeatures) {
      await prisma.planFeature.upsert({
        where: {
          planId_key: {
            planId: proPlan.id,
            key: feature.key,
          },
        },
        update: {
          value: feature.value,
          valueType: feature.valueType,
        },
        create: {
          planId: proPlan.id,
          key: feature.key,
          value: feature.value,
          valueType: feature.valueType,
        },
      });
    }
  }

  await prisma.plan.upsert({
    where: { code: PlanCode.PRO_PLUS },
    update: { isActive: false },
    create: {
      code: PlanCode.PRO_PLUS,
      name: 'Pro Plus',
      nameTj: 'Pro Plus',
      isActive: false,
      sortOrder: 3,
    },
  });

  const prices = [
    { billingPeriod: BillingPeriod.MONTHLY, amount: '15.00' },
    { billingPeriod: BillingPeriod.YEARLY, amount: '150.00' },
  ] as const;

  for (const price of prices) {
    await prisma.planPrice.upsert({
      where: {
        planId_billingPeriod: {
          planId: plan.id,
          billingPeriod: price.billingPeriod,
        },
      },
      update: {
        amount: price.amount,
        currency: 'TJS',
        isActive: true,
      },
      create: {
        planId: plan.id,
        billingPeriod: price.billingPeriod,
        amount: price.amount,
        currency: 'TJS',
        isActive: true,
      },
    });
  }

  const features = [
    { key: 'planning_horizon_days', value: '28', valueType: FeatureValueType.INT },
    { key: 'max_devices', value: '1', valueType: FeatureValueType.INT },
    { key: 'cloud_sync', value: 'false', valueType: FeatureValueType.BOOL },
    { key: 'advanced_analytics', value: 'false', valueType: FeatureValueType.BOOL },
  ] as const;

  for (const feature of features) {
    await prisma.planFeature.upsert({
      where: {
        planId_key: {
          planId: plan.id,
          key: feature.key,
        },
      },
      update: {
        value: feature.value,
        valueType: feature.valueType,
      },
      create: {
        planId: plan.id,
        key: feature.key,
        value: feature.value,
        valueType: feature.valueType,
      },
    });
  }
}

async function seedSystemConfig() {
  for (const entry of SYSTEM_CONFIG) {
    await prisma.systemConfig.upsert({
      where: { key: entry.key },
      update: { value: entry.value },
      create: { key: entry.key, value: entry.value },
    });
  }
}

async function seedAppVersion() {
  const existing = await prisma.appVersion.findFirst({
    where: { platform: Platform.ANDROID, isActive: true },
  });

  if (!existing) {
    await prisma.appVersion.create({
      data: {
        platform: Platform.ANDROID,
        latestVersion: '1.0.0',
        minimumSupportedVersion: '1.0.0',
        forceUpdate: false,
        isActive: true,
      },
    });
  }
}

async function main() {
  await seedPermissionsAndRoles();
  await seedStandardPlan();
  await seedSystemConfig();
  await seedAppVersion();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
