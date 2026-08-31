import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminTelegramService } from './admin-telegram.service';
import { AuditService } from '../../audit/audit.service';

describe('AdminTelegramService', () => {
  const prisma = {
    adminTelegramLinkToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    adminTelegramIdentity: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    adminUser: {
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const configService = {
    get: jest.fn((key: string, fallback?: unknown) => {
      if (key === 'telegram.adminTelegramIds') return [];
      if (key === 'telegram.adminBotUsername') return 'ruznamo_admin_bot';
      return fallback;
    }),
  };

  const auditService = {
    log: jest.fn(),
  };

  const service = new AdminTelegramService(
    prisma as never,
    configService as unknown as ConfigService,
    auditService as unknown as AuditService,
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

    await expect(
      service.completeLinkFromBot({ code: 'RZ-ABC123', telegramUserId: 123n }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects reused link token', async () => {
    prisma.adminTelegramLinkToken.findUnique.mockResolvedValue({
      id: 'tok_1',
      adminUserId: 'adm_1',
      code: 'RZ-ABC123',
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(
      service.completeLinkFromBot({ code: 'RZ-ABC123', telegramUserId: 123n }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('binds telegram user id on valid token', async () => {
    prisma.adminTelegramLinkToken.findUnique.mockResolvedValue({
      id: 'tok_1',
      adminUserId: 'adm_1',
      code: 'RZ-ABC123',
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await service.completeLinkFromBot({
      code: 'RZ-ABC123',
      telegramUserId: 999888777n,
      username: 'ignored_username',
      firstName: 'Ignored',
    });

    expect(prisma.adminTelegramLinkToken.update).toHaveBeenCalled();
    expect(prisma.adminTelegramIdentity.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ telegramUserId: 999888777n, isVerified: true }),
      }),
    );
  });

  it('treats unlinked telegram user as unauthorized', async () => {
    prisma.adminTelegramIdentity.findUnique.mockResolvedValue(null);
    await expect(service.isVerifiedTelegramUser(42n)).resolves.toBe(false);
  });

  it('treats verified telegram user as authorized', async () => {
    prisma.adminTelegramIdentity.findUnique.mockResolvedValue({ isVerified: true });
    await expect(service.isVerifiedTelegramUser(42n)).resolves.toBe(true);
  });
});
