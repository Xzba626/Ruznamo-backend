jest.mock('@nestjs/jwt', () => ({
  JwtService: jest.fn().mockImplementation(() => ({
    signAsync: jest.fn().mockResolvedValue('access-token'),
  })),
}));

import { ForbiddenException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Platform, TrialGrantStatus, UserCategory, UserStatus } from '@prisma/client';
import { AuthService } from './auth.service';
import { TokenHashService } from '../security/token-hash.service';
import { AuditService } from '../audit/audit.service';

describe('AuthService', () => {
  const installationId = '11111111-1111-4111-8111-111111111111';

  const prisma = {
    systemConfig: { findUnique: jest.fn() },
    deviceInstallation: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
    user: { create: jest.fn() },
    trialGrant: { create: jest.fn() },
    refreshToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const tokenHashService = {
    generateOpaqueToken: jest.fn().mockReturnValue('refresh-plain'),
    hashToken: jest.fn().mockReturnValue('refresh-hash'),
  };

  const jwtService = {
    signAsync: jest.fn().mockResolvedValue('access-token'),
  };

  const configService = {
    get: jest.fn((key: string, fallback?: string) => {
      const map: Record<string, string> = {
        'jwt.accessExpiresIn': '15m',
        'jwt.refreshExpiresIn': '30d',
        'jwt.accessSecret': 'test-secret',
        'jwt.accessAudience': 'ruznamo-mobile',
      };
      return map[key] ?? fallback;
    }),
  };

  const auditService = { log: jest.fn() };
  const deviceTelemetry = {
    syncByInstallationId: jest.fn(),
    touchLastSeen: jest.fn(),
  };

  const service = new AuthService(
    prisma as never,
    tokenHashService as unknown as TokenHashService,
    jwtService as never,
    configService as unknown as ConfigService,
    auditService as unknown as AuditService,
    deviceTelemetry as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.systemConfig.findUnique.mockResolvedValue({ value: '24' });
  });

  it('rejects registration during maintenance mode', async () => {
    prisma.systemConfig.findUnique.mockResolvedValueOnce({ value: 'true' });

    await expect(
      service.registerDevice(
        {
          installationId,
          platform: Platform.ANDROID,
          appVersion: '1.0.0',
        },
        {},
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('creates user, device and trial for new installation', async () => {
    prisma.deviceInstallation.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => Promise<unknown>) =>
      callback({
        user: {
          create: jest.fn().mockResolvedValue({
            id: 'usr_1',
            displayName: null,
            category: UserCategory.PERSONAL,
            status: UserStatus.ACTIVE,
            createdAt: new Date(),
          }),
        },
        deviceInstallation: {
          create: jest.fn().mockResolvedValue({
            id: 'dev_1',
            installationId,
            revokedAt: null,
          }),
        },
        trialGrant: {
          create: jest.fn().mockResolvedValue({
            id: 'trial_1',
            status: TrialGrantStatus.ACTIVE,
            expiresAt: new Date(Date.now() + 86400000),
          }),
        },
        systemConfig: { findUnique: jest.fn().mockResolvedValue({ value: '24' }) },
      } as never),
    );
    prisma.refreshToken.create.mockResolvedValue({ id: 'rt_1' });

    const result = await service.registerDevice(
      {
        installationId,
        platform: Platform.ANDROID,
        appVersion: '1.0.0',
      },
      {},
    );

    expect(result.user.id).toBe('usr_1');
    expect(result.device.installationId).toBe(installationId);
    expect(result.trial?.status).toBe(TrialGrantStatus.ACTIVE);
    expect(result.tokens.accessToken).toBe('access-token');
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'trial.granted' }),
    );
  });

  it('restores existing installation without creating duplicate trial', async () => {
    prisma.deviceInstallation.findUnique.mockResolvedValue({
      id: 'dev_1',
      userId: 'usr_1',
      installationId,
      revokedAt: null,
      user: {
        id: 'usr_1',
        displayName: null,
        category: UserCategory.PERSONAL,
        status: UserStatus.ACTIVE,
        createdAt: new Date(),
        trialGrant: {
          status: TrialGrantStatus.ACTIVE,
          expiresAt: new Date(Date.now() + 3600000),
        },
      },
    });
    prisma.deviceInstallation.update.mockResolvedValue({
      id: 'dev_1',
      installationId,
      revokedAt: null,
    });
    prisma.refreshToken.create.mockResolvedValue({ id: 'rt_2' });

    const result = await service.registerDevice(
      {
        installationId,
        platform: Platform.ANDROID,
        appVersion: '1.0.1',
      },
      {},
    );

    expect(result.user.id).toBe('usr_1');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'mobile.login' }),
    );
  });

  it('rotates refresh token and links device session', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt_old',
      userId: 'usr_1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 3600000),
      user: { status: UserStatus.ACTIVE },
      device: {
        id: 'dev_1',
        installationId,
        revokedAt: null,
      },
    });
    prisma.refreshToken.create.mockResolvedValue({ id: 'rt_new' });

    const tokens = await service.refresh('refresh-plain', {});

    expect(tokens.refreshToken).toBe('refresh-plain');
    expect(prisma.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rt_old' },
        data: expect.objectContaining({ replacedBy: 'rt_new' }),
      }),
    );
  });

  it('rejects expired refresh token', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt_old',
      userId: 'usr_1',
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
      user: { status: UserStatus.ACTIVE },
      device: { id: 'dev_1', installationId, revokedAt: null },
    });

    await expect(service.refresh('refresh-plain', {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects revoked refresh token', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt_old',
      userId: 'usr_1',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
      user: { status: UserStatus.ACTIVE },
      device: { id: 'dev_1', installationId, revokedAt: null },
    });

    await expect(service.refresh('refresh-plain', {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects revoked device registration (global device block)', async () => {
    prisma.deviceInstallation.findUnique.mockResolvedValue({
      id: 'dev_1',
      userId: 'usr_1',
      installationId,
      revokedAt: new Date(),
      user: { status: UserStatus.ACTIVE, trialGrant: null },
    });

    await expect(
      service.registerDevice(
        {
          installationId,
          platform: Platform.ANDROID,
          appVersion: '1.0.0',
        },
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
