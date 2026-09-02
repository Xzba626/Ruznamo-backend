import { ForbiddenException } from '@nestjs/common';
import { LicenseStatus, PlanCode } from '@prisma/client';
import { LicenseRecoveryService } from './license-recovery.service';

describe('LicenseRecoveryService', () => {
  const prisma = {
    license: { findMany: jest.fn(), findUnique: jest.fn() },
    notificationOutbox: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  };
  const telegramAuthService = {
    assertValidGrant: jest.fn(),
  };
  const deviceReplacementService = { executeReplacement: jest.fn() };
  const telegramLicenseLinkService = { maskKeyPrefix: jest.fn((p: string) => `${p}••••`) };
  const entitlementService = { getSnapshot: jest.fn() };
  const auditService = { log: jest.fn() };

  const service = new LicenseRecoveryService(
    prisma as never,
    telegramAuthService as never,
    deviceReplacementService as never,
    telegramLicenseLinkService as never,
    entitlementService as never,
    auditService as never,
  );

  const mobileUser = {
    sub: 'user_b',
    deviceId: 'device_b',
    installationId: 'inst_b',
    type: 'access' as const,
    aud: 'ruznamo-mobile',
  };

  const grant = {
    grantId: 'grant_1',
    challengeId: 'challenge_1',
    telegramAccountId: 'tg_holder_b',
    deviceId: 'device_b',
    mobileUserId: 'user_b',
    purpose: 'LOGIN' as const,
    expiresAt: new Date(Date.now() + 600000),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    telegramAuthService.assertValidGrant.mockResolvedValue(grant);
  });

  it('returns only licenses held by verified Telegram account', async () => {
    prisma.license.findMany.mockResolvedValue([
      {
        id: 'lic_1',
        status: LicenseStatus.ACTIVE,
        keyPrefix: 'ABCD1234',
        issueSource: 'TELEGRAM_PAYMENT',
        activatedAt: new Date(),
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        plan: { code: PlanCode.STANDARD, name: 'Standard', features: [{ key: 'max_devices', value: '2' }] },
        activations: [],
      },
      {
        id: 'lic_2',
        status: LicenseStatus.ACTIVE,
        keyPrefix: 'EFGH5678',
        issueSource: 'TELEGRAM_PAYMENT',
        activatedAt: new Date(),
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        plan: { code: PlanCode.PRO, name: 'Pro', features: [{ key: 'max_devices', value: '2' }] },
        activations: [
          {
            deviceId: 'device_b',
            device: { id: 'device_b', deviceName: 'Samsung', deviceManufacturer: 'Samsung', deviceModel: 'S21', revokedAt: null },
          },
        ],
      },
    ]);

    const result = await service.listHolderLicenses('grant_1', mobileUser);

    expect(prisma.license.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { holderTelegramAccountId: 'tg_holder_b' },
      }),
    );
    expect(result.items).toHaveLength(2);
    expect(result.items[0].maskedKey).toContain('••••');
    expect(result.items[1].isCurrentDeviceActive).toBe(true);
  });

  it('denies key reveal when holder was reassigned away', async () => {
    prisma.license.findUnique.mockResolvedValue({
      holderTelegramAccountId: 'tg_other',
    });

    await expect(
      service.revealLicenseKey('grant_1', 'lic_1', mobileUser),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('reveals key without logging plaintext in audit metadata', async () => {
    prisma.license.findUnique.mockResolvedValue({
      holderTelegramAccountId: 'tg_holder_b',
      status: LicenseStatus.ACTIVE,
      revokedAt: null,
      keyPrefix: 'ABCD1234',
    });
    prisma.notificationOutbox.findFirst.mockResolvedValue({
      payload: { licenseKey: 'FULL-KEY-SECRET' },
    });

    const result = await service.revealLicenseKey('grant_1', 'lic_1', mobileUser);

    expect(result.licenseKey).toBe('FULL-KEY-SECRET');
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'license.key.revealed',
        metadata: expect.not.objectContaining({ licenseKey: expect.anything() }),
      }),
    );
  });

  it('returns DEVICE_REPLACEMENT_REQUIRED when slots are full', async () => {
    prisma.license.findUnique.mockResolvedValue({ holderTelegramAccountId: 'tg_holder_b' });

    prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        license: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'lic_1',
            status: LicenseStatus.ACTIVE,
            revokedAt: null,
            expiresAt: new Date(Date.now() + 86400000),
            activatedAt: new Date(),
            startsAt: new Date(),
            keyPrefix: 'ABCD',
            plan: { code: PlanCode.STANDARD, name: 'Standard', features: [{ key: 'max_devices', value: '2' }] },
          }),
        },
        $executeRaw: jest.fn(),
        deviceInstallation: {
          findFirst: jest.fn().mockResolvedValue({ id: 'device_b' }),
        },
        licenseActivation: {
          findUnique: jest.fn().mockResolvedValue(null),
          findMany: jest.fn().mockResolvedValue([
            {
              deviceId: 'device_old_1',
              device: {
                id: 'device_old_1',
                deviceName: 'Huawei',
                deviceManufacturer: 'Huawei',
                deviceModel: 'AKA',
                lastSeenAt: new Date(),
              },
            },
            {
              deviceId: 'device_old_2',
              device: {
                id: 'device_old_2',
                deviceName: 'Samsung',
                deviceManufacturer: 'Samsung',
                deviceModel: 'S21',
                lastSeenAt: new Date(),
              },
            },
          ]),
        },
      };
      return cb(tx);
    });

    await expect(
      service.activateViaTelegram('grant_1', 'lic_1', mobileUser, {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
