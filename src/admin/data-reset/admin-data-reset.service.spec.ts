import { BadRequestException } from '@nestjs/common';
import { DataResetScope } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  AdminDataResetService,
  confirmationPhraseForScope,
  FACTORY_RESET_PRESERVED,
  USER_DATA_RESET_PRESERVED,
} from './admin-data-reset.service';

describe('AdminDataResetService confirmation + preview', () => {
  const prisma = {
    user: { count: jest.fn(), findMany: jest.fn() },
    deviceInstallation: { count: jest.fn(), findMany: jest.fn() },
    telegramAccount: { count: jest.fn(), findMany: jest.fn() },
    license: { count: jest.fn(), findMany: jest.fn() },
    licenseActivation: { count: jest.fn(), findMany: jest.fn() },
    order: { count: jest.fn(), findMany: jest.fn() },
    receipt: { count: jest.fn() },
    supportConversation: { count: jest.fn() },
    telegramRecoveryGrant: { count: jest.fn() },
    refreshToken: { count: jest.fn() },
    trialGrant: { count: jest.fn() },
    systemConfig: { findUnique: jest.fn(), upsert: jest.fn() },
    systemSecurityCredential: { findUnique: jest.fn() },
  };

  const resetPasswordService = {
    verify: jest.fn(),
    hash: jest.fn(),
  };

  const auditService = { log: jest.fn() };
  const planBootstrap = { bootstrapMissingCanonicalPlans: jest.fn() };

  let service: AdminDataResetService;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(prisma).forEach((table) => {
      Object.values(table).forEach((fn) => {
        if (typeof fn === 'function' && 'mockResolvedValue' in fn) {
          (fn as jest.Mock).mockResolvedValue(0);
        }
      });
    });
    prisma.user.findMany.mockResolvedValue([]);
    prisma.deviceInstallation.findMany.mockResolvedValue([]);
    prisma.telegramAccount.findMany.mockResolvedValue([]);
    prisma.license.findMany.mockResolvedValue([]);
    prisma.licenseActivation.findMany.mockResolvedValue([]);
    prisma.order.findMany.mockResolvedValue([]);
    service = new AdminDataResetService(
      prisma as never,
      resetPasswordService as never,
      auditService as never,
      planBootstrap as never,
    );
  });

  it('uses operation-specific confirmation phrases', () => {
    expect(confirmationPhraseForScope(DataResetScope.USER_DATA_RESET)).toBe(
      'УДАЛИТЬ ПОЛЬЗОВАТЕЛЬСКИЕ ДАННЫЕ',
    );
    expect(confirmationPhraseForScope(DataResetScope.TEST_DATA_CLEANUP)).toBe(
      'УДАЛИТЬ ТЕСТОВЫЕ ДАННЫЕ',
    );
    expect(confirmationPhraseForScope(DataResetScope.FACTORY_RESET)).toBe('УДАЛИТЬ ВСЕ ДАННЫЕ');
  });

  it('preserves admin telegram authority in USER_DATA_RESET list', () => {
    expect(USER_DATA_RESET_PRESERVED).toContain('admin_telegram_authority');
    expect(USER_DATA_RESET_PRESERVED).toContain('plans_and_prices');
    expect(USER_DATA_RESET_PRESERVED).toContain('plan_features');
    expect(USER_DATA_RESET_PRESERVED).toContain('app_releases');
  });

  it('FACTORY_RESET contract preserves plans and recovers missing canonical catalog', () => {
    expect(FACTORY_RESET_PRESERVED).toContain('plans_and_prices');
    expect(FACTORY_RESET_PRESERVED).toContain('plan_features');
  });

  it('issues preview token on dry-run and rejects execute without matching preview', async () => {
    const preview = await service.dryRun(DataResetScope.USER_DATA_RESET, 'admin_1');
    expect(preview.previewId).toBeTruthy();
    expect(preview.confirmationPhrase).toBe('УДАЛИТЬ ПОЛЬЗОВАТЕЛЬСКИЕ ДАННЫЕ');

    await expect(
      service.execute({
        adminId: 'admin_1',
        scope: DataResetScope.USER_DATA_RESET,
        resetPassword: 'unused',
        confirmationPhrase: 'УДАЛИТЬ ПОЛЬЗОВАТЕЛЬСКИЕ ДАННЫЕ',
        previewId: 'not-a-real-preview-token',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects wrong confirmation phrase before password check', async () => {
    const preview = await service.dryRun(DataResetScope.USER_DATA_RESET, 'admin_1');
    await expect(
      service.execute({
        adminId: 'admin_1',
        scope: DataResetScope.USER_DATA_RESET,
        resetPassword: 'unused',
        confirmationPhrase: 'УДАЛИТЬ ВСЕ ДАННЫЕ',
        previewId: preview.previewId!,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'CONFIRMATION_PHRASE_MISMATCH' }),
    });
  });

  it('rejects stale/mismatched scope preview', async () => {
    const preview = await service.dryRun(DataResetScope.USER_DATA_RESET, 'admin_1');
    await expect(
      service.execute({
        adminId: 'admin_1',
        scope: DataResetScope.FACTORY_RESET,
        resetPassword: 'unused',
        confirmationPhrase: 'УДАЛИТЬ ВСЕ ДАННЫЕ',
        previewId: preview.previewId!,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PREVIEW_SCOPE_MISMATCH' }),
    });
  });
});

describe('AdminDataResetService plan wipe regression', () => {
  it('USER_DATA_RESET implementation never deletes Plan / PlanPrice / PlanFeature', () => {
    const src = readFileSync(join(__dirname, 'admin-data-reset.service.ts'), 'utf8');
    const userFn = src.slice(
      src.indexOf('private async applyUserDataReset'),
      src.indexOf('private async applyFactoryBootstrap'),
    );
    expect(userFn).not.toMatch(/plan\.deleteMany/);
    expect(userFn).not.toMatch(/planPrice\.deleteMany/);
    expect(userFn).not.toMatch(/planFeature\.deleteMany/);
  });

  it('FACTORY_RESET no longer deletes plans and bootstraps missing canonical catalog', () => {
    const src = readFileSync(join(__dirname, 'admin-data-reset.service.ts'), 'utf8');
    const factoryFn = src.slice(src.indexOf('private async applyFactoryBootstrap'));
    expect(factoryFn).not.toMatch(/plan\.deleteMany/);
    expect(factoryFn).not.toMatch(/planPrice\.deleteMany/);
    expect(factoryFn).not.toMatch(/planFeature\.deleteMany/);
    expect(factoryFn).toMatch(/bootstrapMissingCanonicalPlans/);
  });
});
