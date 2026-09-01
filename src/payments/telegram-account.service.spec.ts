import { TelegramAccountService } from './telegram-account.service';

describe('TelegramAccountService', () => {
  const prisma = {
    telegramAccount: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    user: { create: jest.fn() },
    $transaction: jest.fn(),
  };

  const service = new TelegramAccountService(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it('returns existing telegram account without creating duplicate user', async () => {
    prisma.telegramAccount.findUnique.mockResolvedValue({
      id: 'ta_1',
      userId: 'usr_1',
      telegramId: 999n,
      username: 'ivan',
      firstName: 'Ivan',
    });
    prisma.telegramAccount.update.mockResolvedValue({
      id: 'ta_1',
      userId: 'usr_1',
      telegramId: 999n,
      username: 'ivan',
      firstName: 'Ivan',
    });

    const result = await service.resolveTelegramUser({
      telegramId: 999n,
      chatId: 999n,
      username: 'ivan',
      firstName: 'Ivan',
    });

    expect(result.userId).toBe('usr_1');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('creates user and telegram account for new telegram id', async () => {
    prisma.telegramAccount.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(async (cb: (tx: typeof prisma) => Promise<unknown>) =>
      cb({
        user: {
          create: jest.fn().mockResolvedValue({ id: 'usr_new' }),
        },
        telegramAccount: {
          create: jest.fn().mockResolvedValue({
            id: 'ta_new',
            userId: 'usr_new',
            telegramId: 888n,
            username: null,
            firstName: 'Ali',
          }),
        },
      } as never),
    );

    const result = await service.resolveTelegramUser({
      telegramId: 888n,
      chatId: 888n,
      firstName: 'Ali',
    });

    expect(result.userId).toBe('usr_new');
  });
});
