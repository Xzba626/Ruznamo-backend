import { ConfigService } from '@nestjs/config';
import { AdminTelegramIdentityStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

describe('AdminTelegramAuthService', () => {
  const prisma = {
    adminTelegramRevokedId: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    adminTelegramIdentity: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  const configService = {
    get: jest.fn((key: string, fallback?: unknown) => {
      if (key === 'telegram.adminTelegramIds') return ['111', '222'];
      return fallback;
    }),
  };

  let service: import('./admin-telegram-auth.service').AdminTelegramAuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.adminTelegramRevokedId.findMany.mockResolvedValue([]);
    prisma.adminTelegramRevokedId.count.mockResolvedValue(0);
    prisma.adminTelegramIdentity.count.mockResolvedValue(0);
    const { AdminTelegramAuthService } = await import('./admin-telegram-auth.service');
    service = new AdminTelegramAuthService(
      prisma as unknown as PrismaService,
      configService as unknown as ConfigService,
    );
  });

  it('denies revoked telegram id even if still in env', async () => {
    prisma.adminTelegramRevokedId.findUnique.mockResolvedValue({ telegramUserId: 111n });
    await expect(service.isTelegramAdmin(111n)).resolves.toBe(false);
  });

  it('uses env only when Telegram admin management was never initialized', async () => {
    prisma.adminTelegramRevokedId.findUnique.mockResolvedValue(null);
    prisma.adminTelegramIdentity.count.mockResolvedValue(0);
    prisma.adminTelegramRevokedId.count.mockResolvedValue(0);
    await expect(service.isTelegramAdmin(111n)).resolves.toBe(true);
    await expect(service.isTelegramAdmin(999n)).resolves.toBe(false);
  });

  it('ignores env when DB has ACTIVE bindings', async () => {
    prisma.adminTelegramRevokedId.findUnique.mockResolvedValue(null);
    prisma.adminTelegramIdentity.count.mockResolvedValue(1);
    prisma.adminTelegramIdentity.findFirst.mockResolvedValue(null);
    await expect(service.isTelegramAdmin(111n)).resolves.toBe(false);

    prisma.adminTelegramIdentity.findFirst.mockResolvedValue({
      status: AdminTelegramIdentityStatus.ACTIVE,
      isVerified: true,
    });
    await expect(service.isTelegramAdmin(333n)).resolves.toBe(true);
  });

  it('does not resurrect env admin after zero ACTIVE bindings once initialized', async () => {
    // Disconnect last ACTIVE admin: historical identity rows remain, zero ACTIVE.
    prisma.adminTelegramRevokedId.findUnique.mockResolvedValue(null);
    prisma.adminTelegramIdentity.count.mockResolvedValue(1);
    prisma.adminTelegramRevokedId.count.mockResolvedValue(1);
    prisma.adminTelegramIdentity.findFirst.mockResolvedValue(null);
    await expect(service.isTelegramAdmin(111n)).resolves.toBe(false);
    await expect(service.isTelegramAdminManagementInitialized()).resolves.toBe(true);
  });

  it('treats revoked-id history alone as initialized (env never used)', async () => {
    prisma.adminTelegramRevokedId.findUnique.mockResolvedValue(null);
    prisma.adminTelegramIdentity.count.mockResolvedValue(0);
    prisma.adminTelegramRevokedId.count.mockResolvedValue(1);
    prisma.adminTelegramIdentity.findFirst.mockResolvedValue(null);
    await expect(service.isTelegramAdmin(111n)).resolves.toBe(false);
  });
});
