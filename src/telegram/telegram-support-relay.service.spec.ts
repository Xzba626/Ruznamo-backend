import { TelegramLanguage } from '@prisma/client';
import { TelegramSupportRelayService } from './telegram-support-relay.service';

describe('TelegramSupportRelayService', () => {
  const configService = {
    get: jest.fn((key: string) => (key === 'telegram.adminTelegramIds' ? ['999'] : undefined)),
  };

  const botApi = {
    sendPlainMessage: jest.fn().mockResolvedValue(42),
    sendPhoto: jest.fn().mockResolvedValue(43),
    sendDocument: jest.fn().mockResolvedValue(44),
    removeReplyKeyboard: jest.fn().mockResolvedValue(undefined),
  };

  const auditService = { log: jest.fn() };

  const prisma = {
    supportRelayMapping: {
      create: jest.fn().mockResolvedValue({ id: 'map_1' }),
      findUnique: jest.fn(),
    },
    telegramAccount: {
      findUnique: jest.fn().mockResolvedValue({ language: TelegramLanguage.RU }),
    },
  };

  const service = new TelegramSupportRelayService(
    configService as never,
    botApi as never,
    auditService as never,
    prisma as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    configService.get.mockImplementation((key: string) =>
      key === 'telegram.adminTelegramIds' ? ['999'] : undefined,
    );
  });

  it('relays free text to configured admin ids and stores mapping', async () => {
    const result = await service.relayFreeText({
      telegramUserId: 111n,
      chatId: 111n,
      text: 'Салом',
      firstName: 'User',
      username: 'testuser',
      sourceUserMessageId: 7,
    });

    expect(result).toBe('sent');
    expect(botApi.sendPlainMessage).toHaveBeenCalledWith(999n, expect.stringContaining('Салом'));
    expect(prisma.supportRelayMapping.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        adminChatId: 999n,
        adminMessageId: 42,
        userChatId: 111n,
        userTelegramId: 111n,
        sourceUserMessageId: 7,
      }),
    });
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

  it('delivers admin text reply to mapped user A only', async () => {
    prisma.supportRelayMapping.findUnique.mockResolvedValue({
      id: 'map_a',
      userChatId: 111n,
      userTelegramId: 111n,
    });

    const result = await service.deliverAdminReply({
      adminTelegramId: 999n,
      adminChatId: 999n,
      replyToMessageId: 42,
      text: 'Ответ админа',
    });

    expect(result).toBe('delivered');
    expect(botApi.sendPlainMessage).toHaveBeenCalledWith(
      111n,
      expect.stringContaining('Ответ админа'),
    );
    expect(botApi.removeReplyKeyboard).toHaveBeenCalledWith(111n);
  });

  it('routes admin reply to user B when mapping points to B', async () => {
    prisma.supportRelayMapping.findUnique.mockResolvedValue({
      id: 'map_b',
      userChatId: 222n,
      userTelegramId: 222n,
    });

    await service.deliverAdminReply({
      adminTelegramId: 999n,
      adminChatId: 999n,
      replyToMessageId: 55,
      text: 'For user B',
    });

    expect(botApi.sendPlainMessage).toHaveBeenCalledWith(222n, expect.stringContaining('For user B'));
  });

  it('does not deliver when mapping is unknown', async () => {
    prisma.supportRelayMapping.findUnique.mockResolvedValue(null);

    const result = await service.deliverAdminReply({
      adminTelegramId: 999n,
      adminChatId: 999n,
      replyToMessageId: 9999,
      text: 'Orphan reply',
    });

    expect(result).toBe('unknown_target');
    expect(botApi.sendPlainMessage).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('Orphan reply'),
    );
  });

  it('rejects delivery from non-admin telegram id', async () => {
    const result = await service.deliverAdminReply({
      adminTelegramId: 123n,
      adminChatId: 123n,
      replyToMessageId: 1,
      text: 'Not admin',
    });

    expect(result).toBe('not_authorized');
    expect(prisma.supportRelayMapping.findUnique).not.toHaveBeenCalled();
  });

  it('delivers admin photo reply to mapped user', async () => {
    prisma.supportRelayMapping.findUnique.mockResolvedValue({
      id: 'map_photo',
      userChatId: 111n,
      userTelegramId: 111n,
    });

    const result = await service.deliverAdminReply({
      adminTelegramId: 999n,
      adminChatId: 999n,
      replyToMessageId: 42,
      photoFileId: 'photo-file-id',
      caption: 'See attachment',
    });

    expect(result).toBe('delivered');
    expect(botApi.sendPhoto).toHaveBeenCalledWith(
      111n,
      'photo-file-id',
      expect.stringContaining('See attachment'),
      undefined,
    );
  });
});
