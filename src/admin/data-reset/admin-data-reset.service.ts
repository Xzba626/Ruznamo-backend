import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuditActorType, DataResetScope, Prisma, SystemSecurityCredentialType } from '@prisma/client';
import { randomBytes } from 'crypto';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ResetPasswordService } from '../../security/reset-password.service';

export const DATA_RESET_CONFIRMATION_PHRASE = 'УДАЛИТЬ ВСЕ ДАННЫЕ';

/** Operation-specific confirmation phrases (owner-visible). */
export const DATA_RESET_CONFIRMATION_BY_SCOPE: Record<DataResetScope, string> = {
  TEST_DATA_CLEANUP: 'УДАЛИТЬ ТЕСТОВЫЕ ДАННЫЕ',
  USER_DATA_RESET: 'УДАЛИТЬ ПОЛЬЗОВАТЕЛЬСКИЕ ДАННЫЕ',
  FACTORY_RESET: 'УДАЛИТЬ ВСЕ ДАННЫЕ',
};

export function confirmationPhraseForScope(scope: DataResetScope): string {
  return DATA_RESET_CONFIRMATION_BY_SCOPE[scope] ?? DATA_RESET_CONFIRMATION_PHRASE;
}

const PREVIEW_TTL_MS = 10 * 60 * 1000;

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

export interface DataResetCounts {
  users: number;
  devices: number;
  telegramAccounts: number;
  licenses: number;
  activations: number;
  orders: number;
  receipts: number;
  supportConversations: number;
  recoverySessions: number;
  refreshTokens: number;
  trialGrants: number;
}

export interface TestDataDryRunRow {
  table: string;
  id: string;
  reason: string;
  label?: string;
}

export const USER_DATA_RESET_PRESERVED = [
  'database_schema_and_migrations',
  'admin_accounts',
  'admin_telegram_authority',
  'data_reset_password',
  'plans_and_prices',
  'payment_methods',
  'app_config_and_versions',
  'app_releases',
  'system_security_credentials',
  'protected_system_audit_logs',
] as const;

@Injectable()
export class AdminDataResetService {
  private readonly failedAttempts = new Map<string, { count: number; lockedUntil: number }>();
  private readonly previewTokens = new Map<
    string,
    { adminId: string; scope: DataResetScope; expiresAt: number }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly resetPasswordService: ResetPasswordService,
    private readonly auditService: AuditService,
  ) {}

  async getResetPasswordStatus() {
    const credential = await this.prisma.systemSecurityCredential.findUnique({
      where: { type: SystemSecurityCredentialType.DATA_RESET },
    });
    return {
      configured: Boolean(credential),
      passwordChangedAt: credential?.passwordChangedAt?.toISOString() ?? null,
    };
  }

  async setInitialResetPassword(adminId: string, newPassword: string, confirmPassword: string) {
    const existing = await this.prisma.systemSecurityCredential.findUnique({
      where: { type: SystemSecurityCredentialType.DATA_RESET },
    });
    if (existing) {
      throw new ConflictException({
        code: 'RESET_PASSWORD_ALREADY_SET',
        message: 'Data reset password is already configured',
      });
    }
    if (newPassword !== confirmPassword) {
      throw new BadRequestException({ code: 'PASSWORD_MISMATCH', message: 'Passwords do not match' });
    }

    let passwordHash: string;
    try {
      passwordHash = await this.resetPasswordService.hash(newPassword);
    } catch (error) {
      throw new BadRequestException({
        code: error instanceof Error ? error.message : 'RESET_PASSWORD_INVALID',
        message: 'Reset password does not meet security requirements',
      });
    }

    const now = new Date();
    await this.prisma.systemSecurityCredential.create({
      data: {
        type: SystemSecurityCredentialType.DATA_RESET,
        passwordHash,
        passwordChangedAt: now,
      },
    });

    await this.auditService.log({
      actorType: AuditActorType.ADMIN,
      actorId: adminId,
      action: 'system.reset_password.initialized',
      entityType: 'SystemSecurityCredential',
      entityId: SystemSecurityCredentialType.DATA_RESET,
    });

    return { configured: true, passwordChangedAt: now.toISOString() };
  }

  async changeResetPassword(
    adminId: string,
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
  ) {
    const credential = await this.prisma.systemSecurityCredential.findUnique({
      where: { type: SystemSecurityCredentialType.DATA_RESET },
    });
    if (!credential) {
      throw new BadRequestException({
        code: 'RESET_PASSWORD_NOT_CONFIGURED',
        message: 'Data reset password is not configured yet',
      });
    }
    if (newPassword !== confirmPassword) {
      throw new BadRequestException({ code: 'PASSWORD_MISMATCH', message: 'Passwords do not match' });
    }

    const valid = await this.resetPasswordService.verify(currentPassword, credential.passwordHash);
    if (!valid) {
      throw new UnauthorizedException({
        code: 'INVALID_RESET_PASSWORD',
        message: 'Current reset password is incorrect',
      });
    }

    const passwordHash = await this.resetPasswordService.hash(newPassword).catch((error) => {
      throw new BadRequestException({
        code: error instanceof Error ? error.message : 'RESET_PASSWORD_INVALID',
        message: 'Reset password does not meet security requirements',
      });
    });
    const now = new Date();
    await this.prisma.systemSecurityCredential.update({
      where: { id: credential.id },
      data: { passwordHash, passwordChangedAt: now },
    });

    await this.auditService.log({
      actorType: AuditActorType.ADMIN,
      actorId: adminId,
      action: 'system.reset_password.changed',
      entityType: 'SystemSecurityCredential',
      entityId: credential.id,
    });

    return { configured: true, passwordChangedAt: now.toISOString() };
  }

  async dryRun(scope: DataResetScope, adminId?: string) {
    const previewId = this.issuePreviewToken(scope, adminId ?? 'anonymous');
    if (scope === DataResetScope.TEST_DATA_CLEANUP) {
      const result = await this.dryRunTestCleanup();
      return {
        ...result,
        previewId,
        previewExpiresAt: new Date(Date.now() + PREVIEW_TTL_MS).toISOString(),
        confirmationPhrase: confirmationPhraseForScope(scope),
      };
    }
    if (scope === DataResetScope.USER_DATA_RESET) {
      const counts = await this.countUserOperationalData();
      const samples = await this.describeUserOperationalSamples();
      return {
        scope,
        dryRun: true,
        counts,
        preserved: [...USER_DATA_RESET_PRESERVED],
        samples,
        generatedAt: new Date().toISOString(),
        previewId,
        previewExpiresAt: new Date(Date.now() + PREVIEW_TTL_MS).toISOString(),
        confirmationPhrase: confirmationPhraseForScope(scope),
      };
    }
    if (scope === DataResetScope.FACTORY_RESET) {
      const counts = await this.countUserOperationalData();
      const samples = await this.describeUserOperationalSamples();
      return {
        scope,
        dryRun: true,
        counts,
        preserved: [
          'database_schema_and_migrations',
          'admin_accounts',
          'admin_telegram_authority',
          'data_reset_password',
          'system_security_credentials',
          'app_releases',
          'protected_system_audit_logs',
        ],
        additionalImpact: {
          plansAndPricing: 'Will reset to bootstrap defaults',
          paymentMethods: 'Will reset to bootstrap defaults',
          appConfig: 'Will reset to bootstrap defaults',
        },
        samples,
        generatedAt: new Date().toISOString(),
        previewId,
        previewExpiresAt: new Date(Date.now() + PREVIEW_TTL_MS).toISOString(),
        confirmationPhrase: confirmationPhraseForScope(scope),
      };
    }
    throw new BadRequestException({ code: 'INVALID_RESET_SCOPE', message: 'Unknown reset scope' });
  }

  async execute(params: {
    adminId: string;
    scope: DataResetScope;
    resetPassword: string;
    confirmationPhrase: string;
    previewId: string;
    ipAddress?: string;
  }) {
    const expectedPhrase = confirmationPhraseForScope(params.scope);
    if (params.confirmationPhrase.trim() !== expectedPhrase) {
      throw new BadRequestException({
        code: 'CONFIRMATION_PHRASE_MISMATCH',
        message: 'Confirmation phrase does not match for this operation',
      });
    }

    this.consumePreviewToken(params.previewId, params.adminId, params.scope);

    await this.verifyResetPassword(params.adminId, params.resetPassword);

    const lockKey = 'DATA_RESET_IN_PROGRESS';
    const existingLock = await this.prisma.systemConfig.findUnique({ where: { key: lockKey } });
    if (existingLock?.value === 'true') {
      throw new ConflictException({
        code: 'RESET_IN_PROGRESS',
        message: 'Another reset operation is already in progress',
      });
    }

    await this.prisma.systemConfig.upsert({
      where: { key: lockKey },
      create: { key: lockKey, value: 'true' },
      update: { value: 'true' },
    });

    const startedAt = new Date();
    const beforeCounts = await this.countUserOperationalData();

    try {
      if (params.scope === DataResetScope.TEST_DATA_CLEANUP) {
        await this.applyTestCleanup();
      } else if (params.scope === DataResetScope.USER_DATA_RESET) {
        await this.applyUserDataReset();
      } else if (params.scope === DataResetScope.FACTORY_RESET) {
        await this.applyUserDataReset();
        await this.applyFactoryBootstrap();
      } else {
        throw new BadRequestException({ code: 'INVALID_RESET_SCOPE', message: 'Unknown reset scope' });
      }

      const afterCounts = await this.countUserOperationalData();

      await this.auditService.log({
        actorType: AuditActorType.ADMIN,
        actorId: params.adminId,
        action: 'system.data_reset.completed',
        entityType: 'DataReset',
        entityId: params.scope,
        metadata: {
          scope: params.scope,
          startedAt: startedAt.toISOString(),
          completedAt: new Date().toISOString(),
          beforeCounts,
          afterCounts,
          success: true,
        } as unknown as Prisma.InputJsonValue,
        ipAddress: params.ipAddress,
      });

      return {
        success: true,
        scope: params.scope,
        beforeCounts,
        afterCounts,
        completedAt: new Date().toISOString(),
      };
    } catch (error) {
      await this.auditService.log({
        actorType: AuditActorType.ADMIN,
        actorId: params.adminId,
        action: 'system.data_reset.failed',
        entityType: 'DataReset',
        entityId: params.scope,
        metadata: {
          scope: params.scope,
          startedAt: startedAt.toISOString(),
          error: error instanceof Error ? error.message : 'unknown',
        },
        ipAddress: params.ipAddress,
      });
      throw error;
    } finally {
      await this.prisma.systemConfig.upsert({
        where: { key: lockKey },
        create: { key: lockKey, value: 'false' },
        update: { value: 'false' },
      });
    }
  }

  private issuePreviewToken(scope: DataResetScope, adminId: string): string {
    const previewId = randomBytes(24).toString('base64url');
    this.previewTokens.set(previewId, {
      adminId,
      scope,
      expiresAt: Date.now() + PREVIEW_TTL_MS,
    });
    return previewId;
  }

  private consumePreviewToken(previewId: string, adminId: string, scope: DataResetScope): void {
    const token = this.previewTokens.get(previewId);
    this.previewTokens.delete(previewId);
    if (!token) {
      throw new BadRequestException({
        code: 'PREVIEW_REQUIRED',
        message: 'Fresh preliminary preview is required before execute',
      });
    }
    if (token.expiresAt < Date.now()) {
      throw new BadRequestException({
        code: 'PREVIEW_EXPIRED',
        message: 'Preliminary preview expired; run preview again',
      });
    }
    if (token.adminId !== adminId || token.scope !== scope) {
      throw new BadRequestException({
        code: 'PREVIEW_SCOPE_MISMATCH',
        message: 'Preview does not match the selected operation or admin',
      });
    }
  }

  private async verifyResetPassword(adminId: string, password: string): Promise<void> {
    const key = `admin:${adminId}`;
    const now = Date.now();
    const state = this.failedAttempts.get(key);
    if (state && state.lockedUntil > now) {
      throw new ForbiddenException({
        code: 'RESET_PASSWORD_LOCKED',
        message: 'Too many failed reset password attempts',
      });
    }

    const credential = await this.prisma.systemSecurityCredential.findUnique({
      where: { type: SystemSecurityCredentialType.DATA_RESET },
    });
    if (!credential) {
      throw new BadRequestException({
        code: 'RESET_PASSWORD_NOT_CONFIGURED',
        message: 'Configure data reset password before executing reset',
      });
    }

    const valid = await this.resetPasswordService.verify(password, credential.passwordHash);
    if (!valid) {
      const count = (state?.count ?? 0) + 1;
      const lockedUntil = count >= 5 ? now + 15 * 60 * 1000 : 0;
      this.failedAttempts.set(key, { count, lockedUntil });
      throw new UnauthorizedException({
        code: 'INVALID_RESET_PASSWORD',
        message: 'Invalid data reset password',
      });
    }

    this.failedAttempts.delete(key);
  }

  async countUserOperationalData(): Promise<DataResetCounts> {
    const [
      users,
      devices,
      telegramAccounts,
      licenses,
      activations,
      orders,
      receipts,
      supportConversations,
      recoverySessions,
      refreshTokens,
      trialGrants,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.deviceInstallation.count(),
      this.prisma.telegramAccount.count(),
      this.prisma.license.count(),
      this.prisma.licenseActivation.count(),
      this.prisma.order.count(),
      this.prisma.receipt.count(),
      this.prisma.supportConversation.count(),
      this.prisma.telegramRecoveryGrant.count(),
      this.prisma.refreshToken.count(),
      this.prisma.trialGrant.count(),
    ]);

    return {
      users,
      devices,
      telegramAccounts,
      licenses,
      activations,
      orders,
      receipts,
      supportConversations,
      recoverySessions,
      refreshTokens,
      trialGrants,
    };
  }

  private async dryRunTestCleanup() {
    const selection = await this.buildTestSelection();
    const rows = await this.describeTestSelection(selection);
    return {
      scope: DataResetScope.TEST_DATA_CLEANUP,
      dryRun: true,
      counts: {
        users: selection.userIds.length,
        devices: selection.deviceIds.length,
        telegramAccounts: selection.telegramAccountIds.length,
        licenses: selection.licenseIds.length,
        activations: selection.activationIds.length,
        orders: selection.orderIds.length,
        receipts: 0,
        supportConversations: 0,
        recoverySessions: 0,
        refreshTokens: 0,
        trialGrants: selection.trialIds.length,
      },
      preserved: [
        'non_test_users',
        'non_test_devices',
        'admin_accounts',
        'plans_and_prices',
        'payment_methods',
        'app_releases',
        'system_config',
      ],
      samples: rows.slice(0, 100),
      generatedAt: new Date().toISOString(),
    };
  }

  private async describeUserOperationalSamples(): Promise<TestDataDryRunRow[]> {
    const [users, devices, licenses, orders, telegrams] = await Promise.all([
      this.prisma.user.findMany({
        take: 25,
        orderBy: { createdAt: 'desc' },
        select: { id: true, displayName: true, email: true },
      }),
      this.prisma.deviceInstallation.findMany({
        take: 25,
        orderBy: { lastSeenAt: 'desc' },
        select: {
          id: true,
          deviceManufacturer: true,
          deviceModel: true,
          deviceName: true,
          installationId: true,
        },
      }),
      this.prisma.license.findMany({
        take: 25,
        orderBy: { createdAt: 'desc' },
        select: { id: true, keyPrefix: true, status: true },
      }),
      this.prisma.order.findMany({
        take: 25,
        orderBy: { createdAt: 'desc' },
        select: { id: true, status: true },
      }),
      this.prisma.telegramAccount.findMany({
        take: 25,
        orderBy: { createdAt: 'desc' },
        select: { id: true, telegramId: true, username: true },
      }),
    ]);

    const rows: TestDataDryRunRow[] = [];
    for (const user of users) {
      rows.push({
        table: 'User',
        id: user.id,
        reason: 'USER_DATA_RESET',
        label: user.displayName || user.email || user.id.slice(0, 10),
      });
    }
    for (const device of devices) {
      const hardware = [device.deviceManufacturer, device.deviceModel].filter(Boolean).join(' ');
      rows.push({
        table: 'DeviceInstallation',
        id: device.id,
        reason: 'USER_DATA_RESET',
        label: hardware || device.deviceName || device.installationId.slice(0, 12),
      });
    }
    for (const license of licenses) {
      rows.push({
        table: 'License',
        id: license.id,
        reason: 'USER_DATA_RESET',
        label: `${license.keyPrefix}… (${license.status})`,
      });
    }
    for (const order of orders) {
      rows.push({
        table: 'Order',
        id: order.id,
        reason: 'USER_DATA_RESET',
        label: `${order.id.slice(0, 10)}… · ${order.status}`,
      });
    }
    for (const tg of telegrams) {
      rows.push({
        table: 'TelegramAccount',
        id: tg.id,
        reason: 'USER_DATA_RESET',
        label: tg.username ? `@${tg.username}` : `id:${tg.telegramId.toString()}`,
      });
    }
    return rows;
  }

  private async buildTestSelection() {
    const users = await this.prisma.user.findMany({
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
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);

    const devices = await this.prisma.deviceInstallation.findMany({
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
      select: { id: true },
    });
    const deviceIds = devices.map((d) => d.id);

    const telegramAccounts = userIds.length
      ? await this.prisma.telegramAccount.findMany({
          where: { userId: { in: userIds } },
          select: { id: true },
        })
      : [];

    const orders = userIds.length
      ? await this.prisma.order.findMany({ where: { userId: { in: userIds } }, select: { id: true } })
      : [];
    const orderIds = orders.map((o) => o.id);

    const licenses = [
      ...(userIds.length
        ? await this.prisma.license.findMany({ where: { userId: { in: userIds } }, select: { id: true } })
        : []),
      ...(orderIds.length
        ? await this.prisma.license.findMany({
            where: { orderId: { in: orderIds } },
            select: { id: true },
          })
        : []),
    ];
    const licenseIds = [...new Set(licenses.map((l) => l.id))];

    const activations = licenseIds.length
      ? await this.prisma.licenseActivation.findMany({
          where: { OR: [{ licenseId: { in: licenseIds } }, { deviceId: { in: deviceIds } }] },
          select: { id: true },
        })
      : [];

    const trials = userIds.length
      ? await this.prisma.trialGrant.findMany({
          where: { userId: { in: userIds } },
          select: { id: true },
        })
      : [];

    return {
      userIds,
      deviceIds,
      telegramAccountIds: telegramAccounts.map((t) => t.id),
      orderIds,
      licenseIds,
      activationIds: activations.map((a) => a.id),
      trialIds: trials.map((t) => t.id),
    };
  }

  private async describeTestSelection(selection: Awaited<ReturnType<typeof this.buildTestSelection>>) {
    const rows: TestDataDryRunRow[] = [];
    const users = await this.prisma.user.findMany({
      where: { id: { in: selection.userIds.slice(0, 20) } },
      select: { id: true, displayName: true, email: true },
    });
    for (const user of users) {
      rows.push({
        table: 'User',
        id: user.id,
        reason: 'Matched test email/display pattern',
        label: user.displayName || user.email || user.id.slice(0, 10),
      });
    }
    const devices = await this.prisma.deviceInstallation.findMany({
      where: { id: { in: selection.deviceIds.slice(0, 20) } },
      select: {
        id: true,
        deviceManufacturer: true,
        deviceModel: true,
        deviceName: true,
        installationId: true,
      },
    });
    for (const device of devices) {
      const hardware = [device.deviceManufacturer, device.deviceModel].filter(Boolean).join(' ');
      rows.push({
        table: 'DeviceInstallation',
        id: device.id,
        reason: 'Matched test device/installation pattern',
        label: hardware || device.deviceName || device.installationId.slice(0, 12),
      });
    }
    return rows;
  }

  private async applyTestCleanup() {
    const selection = await this.buildTestSelection();
    await this.prisma.$transaction(async (tx) => {
      if (selection.activationIds.length) {
        await tx.licenseActivation.deleteMany({ where: { id: { in: selection.activationIds } } });
      }
      if (selection.trialIds.length) {
        await tx.trialGrant.deleteMany({ where: { id: { in: selection.trialIds } } });
      }
      if (selection.licenseIds.length) {
        await tx.licenseEvent.deleteMany({ where: { licenseId: { in: selection.licenseIds } } });
        await tx.licenseHolderHistory.deleteMany({
          where: { licenseId: { in: selection.licenseIds } },
        });
        await tx.license.deleteMany({ where: { id: { in: selection.licenseIds } } });
      }
      if (selection.orderIds.length) {
        await tx.receipt.deleteMany({ where: { orderId: { in: selection.orderIds } } });
        await tx.order.deleteMany({ where: { id: { in: selection.orderIds } } });
      }
      if (selection.telegramAccountIds.length) {
        await tx.telegramAccount.deleteMany({ where: { id: { in: selection.telegramAccountIds } } });
      }
      if (selection.deviceIds.length) {
        await tx.refreshToken.deleteMany({ where: { deviceId: { in: selection.deviceIds } } });
        await tx.deviceInstallation.deleteMany({ where: { id: { in: selection.deviceIds } } });
      }
      if (selection.userIds.length) {
        await tx.refreshToken.deleteMany({ where: { userId: { in: selection.userIds } } });
        await tx.user.deleteMany({ where: { id: { in: selection.userIds } } });
      }
    });
  }

  private async applyUserDataReset() {
    await this.prisma.$transaction(async (tx) => {
      await tx.supportMessage.deleteMany();
      await tx.supportRelayMapping.deleteMany();
      await tx.supportConversation.deleteMany();
      await tx.telegramRecoveryGrant.deleteMany();
      await tx.telegramAuthChallenge.deleteMany();
      await tx.telegramLicenseLinkChallenge.deleteMany();
      await tx.deviceReplacementChallenge.deleteMany();
      await tx.licenseActivation.deleteMany();
      await tx.licenseEvent.deleteMany();
      await tx.licenseHolderHistory.deleteMany();
      await tx.license.deleteMany();
      await tx.receipt.deleteMany();
      await tx.order.deleteMany();
      await tx.telegramLinkToken.deleteMany();
      await tx.telegramBotSession.deleteMany();
      await tx.refreshToken.deleteMany();
      await tx.trialGrant.deleteMany();
      await tx.notificationOutbox.deleteMany();
      await tx.idempotencyRecord.deleteMany();
      await tx.telegramAccount.deleteMany();
      await tx.deviceInstallation.deleteMany();
      await tx.user.deleteMany();
      await tx.auditLog.deleteMany({
        where: {
          NOT: {
            action: { startsWith: 'system.' },
          },
        },
      });
    });
  }

  private async applyFactoryBootstrap() {
    await this.prisma.paymentMethod.deleteMany();
    await this.prisma.planFeature.deleteMany();
    await this.prisma.planPrice.deleteMany();
    await this.prisma.plan.deleteMany();
    await this.prisma.appVersion.deleteMany();
    await this.prisma.systemConfig.deleteMany({
      where: {
        key: { notIn: ['DATA_RESET_IN_PROGRESS'] },
      },
    });
  }
}
