jest.mock('@nestjs/jwt', () => ({
  JwtService: jest.fn().mockImplementation(() => ({
    signAsync: jest.fn().mockResolvedValue('access-token'),
  })),
}));

import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminAuthService } from './admin-auth.service';
import { PasswordService } from '../../security/password.service';
import { TokenHashService } from '../../security/token-hash.service';
import { AuditService } from '../../audit/audit.service';

describe('AdminAuthService', () => {
  const prisma = {
    adminUser: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    adminRefreshToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const passwordService = {
    verify: jest.fn(),
    hash: jest.fn(),
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
        'jwt.adminAudience': 'ruznamo-admin',
      };
      return map[key] ?? fallback;
    }),
  };

  const auditService = {
    log: jest.fn(),
  };

  const service = new AdminAuthService(
    prisma as never,
    passwordService as unknown as PasswordService,
    tokenHashService as unknown as TokenHashService,
    jwtService as never,
    configService as unknown as ConfigService,
    auditService as unknown as AuditService,
  );

  const adminRecord = {
    id: 'adm_1',
    email: 'owner@ruznamo.local',
    passwordHash: 'hash',
    displayName: 'Owner',
    isActive: true,
    createdAt: new Date(),
    lastLoginAt: null,
    roles: [
      {
        role: {
          code: 'SUPER_ADMIN',
          permissions: [{ permission: { code: 'dashboard:read' } }],
        },
      },
    ],
    telegramIdentity: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('logs in with valid credentials', async () => {
    prisma.adminUser.findUnique.mockResolvedValue(adminRecord);
    passwordService.verify.mockResolvedValue(true);
    prisma.adminRefreshToken.create.mockResolvedValue({ id: 'rt_1' });
    prisma.adminUser.update.mockResolvedValue(adminRecord);

    const result = await service.login('owner@ruznamo.local', 'password-123456', {});

    expect(result.tokens.accessToken).toBe('access-token');
    expect(result.tokens.refreshToken).toBe('refresh-plain');
    expect(result.admin.roles).toContain('SUPER_ADMIN');
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'admin.login.success' }),
    );
  });

  it('rejects invalid password with generic message', async () => {
    prisma.adminUser.findUnique.mockResolvedValue(adminRecord);
    passwordService.verify.mockResolvedValue(false);

    await expect(service.login('owner@ruznamo.local', 'bad', {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects unknown username with generic message', async () => {
    prisma.adminUser.findUnique.mockResolvedValue(null);

    await expect(service.login('missing@local', 'password-123456', {})).rejects.toThrow(
      'Invalid username or password',
    );
  });
});
