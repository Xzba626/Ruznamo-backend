import { TelegramSupportRelayService } from './telegram-support-relay.service';

describe('TelegramSupportRelayService', () => {
  const configService = {
    get: jest.fn((key: string) => (key === 'telegram.adminTelegramIds' ? ['999'] : undefined)),
  };

  const botApi = {
    sendPlainMessage: jest.fn().mockResolvedValue(undefined),
  };

  const auditService = { log: jest.fn() };

  const service = new TelegramSupportRelayService(
    configService as never,
    botApi as never,
    auditService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('relays free text to configured admin ids', async () => {
    const result = await service.relayFreeText({
      telegramUserId: 111n,
      chatId: 111n,
      text: 'Салом',
      firstName: 'User',
      username: 'testuser',
    });

    expect(result).toBe('sent');
    expect(botApi.sendPlainMessage).toHaveBeenCalledWith(999n, expect.stringContaining('Салом'));
  });

  it('returns no_admins when ADMIN_TELEGRAM_IDS empty', async () => {
    configService.get.mockReturnValueOnce([]);
    const result = await service.relayFreeText({
      telegramUserId: 111n,
      chatId: 111n,
      text: 'test',
    });
    expect(result).toBe('no_admins');
  });
});
