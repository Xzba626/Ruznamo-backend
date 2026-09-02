import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { TelegramAuthPurpose } from '@prisma/client';
import { TelegramAuthService } from './telegram-auth.service';

describe('TelegramAuthService', () => {
  const prisma = {
    deviceInstallation: { findFirst: jest.fn() },
    telegramAuthChallenge: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    telegramAccount: { findUnique: jest.fn() },
    telegramRecoveryGrant: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  };
  const configService = { get: jest.fn(() => 'Ruznamo_bot') };
  const tokenHashService = {
    generateOpaqueToken: jest.fn(() => 'opaque-token-abc'),
    hashToken: jest.fn((t: string) => `hash-${t}`),
  };
  const auditService = { log: jest.fn() };
  const telegramLicenseLink = { linkHolderFromVerifiedChallenge: jest.fn() };

  const service = new TelegramAuthService(
    prisma as never,
    configService as never,
    tokenHashService as never,
    auditService as never,
    telegramLicenseLink as never,
  );

  const mobileUser = {
    sub: 'user_1',
    deviceId: 'device_1',
    installationId: 'inst_1',
    type: 'access' as const,
    aud: 'ruznamo-mobile',
  };

  const baseChallenge = {
    id: 'challenge_1',
    tokenHash: 'hash-opaque-token-abc',
    requestingDeviceId: 'device_1',
    requestingMobileUserId: 'user_1',
    purpose: TelegramAuthPurpose.LOGIN,
    telegramAccountId: 'tg_acc_1',
    otpHash: null as string | null,
    otpExpiresAt: null as Date | null,
    attemptCount: 0,
    maxAttempts: 5,
    verifiedAt: null,
    consumedAt: null,
    expiresAt: new Date(Date.now() + 600000),
    createdAt: new Date(),
    telegramAccount: { id: 'tg_acc_1', username: 'holder', firstName: 'Ali' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.deviceInstallation.findFirst.mockResolvedValue({ id: 'device_1' });
  });

  it('creates challenge with opaque deep link only', async () => {
    prisma.telegramAuthChallenge.create.mockResolvedValue({ id: 'challenge_1' });

    const result = await service.createChallenge(mobileUser, TelegramAuthPurpose.RECOVERY);

    expect(result.challengeId).toBe('challenge_1');
    expect(result.deepLink).toContain('auth_');
    expect(result.deepLink).toContain('opaque-token-abc');
    expect(prisma.telegramAuthChallenge.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tokenHash: 'hash-opaque-token-abc',
          purpose: TelegramAuthPurpose.RECOVERY,
        }),
      }),
    );
  });

  it('locks challenge after max wrong OTP attempts', async () => {
    const otpHash = (service as unknown as { hashOtp: (c: string) => string }).hashOtp('123456');
    const challenge = {
      ...baseChallenge,
      otpHash,
      otpExpiresAt: new Date(Date.now() + 60000),
      attemptCount: 4,
    };

    prisma.telegramAuthChallenge.findUnique.mockResolvedValue(challenge);
    prisma.telegramAuthChallenge.update.mockResolvedValue({});

    await expect(service.verifyOtp('challenge_1', '000000', mobileUser)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(prisma.telegramAuthChallenge.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'challenge_1' },
        data: expect.objectContaining({ consumedAt: expect.any(Date) }),
      }),
    );
  });

  it('rejects OTP replay after successful verification', async () => {
    prisma.telegramAuthChallenge.findUnique.mockResolvedValue({
      ...baseChallenge,
      consumedAt: new Date(),
      otpHash: 'deadbeef',
      otpExpiresAt: new Date(Date.now() + 60000),
    });

    await expect(service.verifyOtp('challenge_1', '123456', mobileUser)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('issues recovery grant on correct OTP', async () => {
    const otp = '482731';
    const otpHash = (service as unknown as { hashOtp: (c: string) => string }).hashOtp(otp);
    prisma.telegramAuthChallenge.findUnique.mockResolvedValue({
      ...baseChallenge,
      otpHash,
      otpExpiresAt: new Date(Date.now() + 60000),
    });

    prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        telegramAuthChallenge: { update: jest.fn().mockResolvedValue({}) },
        telegramRecoveryGrant: {
          create: jest.fn().mockResolvedValue({ id: 'grant_1', expiresAt: new Date(Date.now() + 600000) }),
        },
      };
      return cb(tx);
    });

    const result = await service.verifyOtp('challenge_1', otp, mobileUser);

    expect(result.recoveryGrantId).toBe('grant_1');
    expect(result.holderUsername).toBe('@holder');
  });

  it('rejects verify from wrong device session', async () => {
    prisma.telegramAuthChallenge.findUnique.mockResolvedValue({
      ...baseChallenge,
      requestingDeviceId: 'other_device',
    });

    await expect(service.verifyOtp('challenge_1', '123456', mobileUser)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
