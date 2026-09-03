import { ConfigService } from '@nestjs/config';
import { AdminTelegramIdentityStatus } from '@prisma/client';
import { AdminTelegramService } from './admin-telegram.service';
import { AuditService } from '../../audit/audit.service';
import { PasswordService } from '../../security/password.service';

describe('AdminTelegramService', () => {
  const prisma = {
    adminTelegramLinkToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    adminTelegramIdentity: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      upsert: jest.fn(),
    },
    adminTelegramRebindChallenge: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    adminTelegramRevokedId: {
      upsert: jest.fn(),
    },
    adminUser: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const configService = {
    get: jest.fn((key: string, fallback?: unknown) => {
      if (key === 'telegram.botUsername') return 'ruznamo_bot';
      return fallback;
    }),
  };

  const auditService = {
    log: jest.fn(),
  };

  const passwordService = {
    verify: jest.fn(),
    hash: jest.fn(),
  };

  const service = new AdminTelegramService(
    prisma as never,
    configService as unknown as ConfigService,
    auditService as unknown as AuditService,
    passwordService as unknown as PasswordService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<void>) => fn(prisma));
  });

  it('rejects expired link token', async () => {
    prisma.adminTelegramLinkToken.findUnique.mockResolvedValue({
      id: 'tok_1',
      adminUserId: 'adm_1',
      code: 'RZ-ABC123',
      usedAt: null,
      expiresAt: new Date(Date.now() - 60_000),
    });

    const result = await service.tryCompleteLinkFromBot({ code: 'RZ-ABC123', telegramUserId: 123n });
    expect(result).toEqual({ ok: false, reason: 'expired' });
  });

  it('rejects reused link token', async () => {
    prisma.adminTelegramLinkToken.findUnique.mockResolvedValue({
      id: 'tok_1',
      adminUserId: 'adm_1',
      code: 'RZ-ABC123',
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    const result = await service.tryCompleteLinkFromBot({ code: 'RZ-ABC123', telegramUserId: 123n });
    expect(result).toEqual({ ok: false, reason: 'invalid' });
  });

  it('binds telegram user id on valid token without env whitelist', async () => {
    prisma.adminTelegramLinkToken.findUnique.mockResolvedValue({
      id: 'tok_1',
      adminUserId: 'adm_1',
      code: 'RZ-ABC123',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.adminTelegramIdentity.findUnique.mockResolvedValue(null);

    const result = await service.tryCompleteLinkFromBot({
      code: 'RZ-ABC123',
      telegramUserId: 999999999n,
      username: 'new_admin',
      firstName: 'Admin',
    });

    expect(result).toEqual({ ok: true });
    expect(prisma.adminTelegramLinkToken.update).toHaveBeenCalled();
    expect(prisma.adminTelegramIdentity.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ telegramUserId: 999999999n, isVerified: true }),
      }),
    );
  });

  it('treats unlinked telegram user as unauthorized', async () => {
    prisma.adminTelegramIdentity.findFirst.mockResolvedValue(null);
    await expect(service.isVerifiedTelegramUser(42n)).resolves.toBe(false);
  });

  it('treats verified active telegram user as authorized', async () => {
    prisma.adminTelegramIdentity.findFirst.mockResolvedValue({
      isVerified: true,
      status: AdminTelegramIdentityStatus.ACTIVE,
    });
    await expect(service.isVerifiedTelegramUser(42n)).resolves.toBe(true);
  });
});
