import { AuditActorType, TelegramLanguage } from '@prisma/client';
import { TelegramUpdateProcessor } from './telegram-update.processor';

describe('TelegramUpdateProcessor pairing and relay', () => {
  const prisma = {
    telegramProcessedUpdate: { create: jest.fn().mockResolvedValue({}) },
    order: { findFirst: jest.fn().mockResolvedValue(null) },
    license: { findFirst: jest.fn() },
  };

  const configService = {
    get: jest.fn((key: string, fallback?: unknown) => {
      if (key === 'telegram.adminTelegramIds') return ['999'];
      return fallback;
    }),
  };

  const botApi = {
    sendMessage: jest.fn(),
    sendPlainMessage: jest.fn(),
    answerCallbackQuery: jest.fn(),
    removeReplyKeyboard: jest.fn(),
  };

  const sessionService = {
    getSession: jest.fn().mockResolvedValue(null),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn(),
    clear: jest.fn(),
  };

  const commandsService = {
    registerAdminCommandsForChat: jest.fn(),
    registerDefaultCommands: jest.fn(),
  };

  const telegramAccountService = {
    resolveTelegramUser: jest.fn().mockResolvedValue({ userId: 'usr_1', language: TelegramLanguage.TJ }),
  };

  const orderService = {
    findAwaitingReceiptOrder: jest.fn().mockResolvedValue(null),
  };

  const adminTelegramService = {
    tryCompleteLinkFromBot: jest.fn(),
  };

  const supportRelay = {
    relayFreeText: jest.fn().mockResolvedValue('sent'),
    relayMedia: jest.fn().mockResolvedValue('sent'),
    deliverAdminReply: jest.fn().mockResolvedValue('delivered'),
  };

  const auditService = { log: jest.fn() };

  const processor = new TelegramUpdateProcessor(
    prisma as never,
    configService as never,
    botApi as never,
    telegramAccountService as never,
    orderService as never,
    {} as never,
    {
      listPurchaseAvailablePlans: jest.fn().mockResolvedValue([
        { id: 'plan_1', code: 'STANDARD', name: 'Standard', nameTj: 'Стандарт', prices: [] },
      ]),
      isPlanAvailableForPurchase: jest.fn().mockResolvedValue(true),
      listActivePlanPrices: jest.fn().mockResolvedValue([]),
      getPlanPriceForPurchase: jest.fn(),
    } as never,
    { listActive: jest.fn().mockResolvedValue([]) } as never,
    { handleText: jest.fn().mockResolvedValue(false), handleCallback: jest.fn().mockResolvedValue(false) } as never,
    adminTelegramService as never,
    supportRelay as never,
    sessionService as never,
    commandsService as never,
    { createChallenge: jest.fn(), confirmLink: jest.fn(), getChallengePreview: jest.fn(), revokeDeviceAsHolder: jest.fn() } as never,
    { createChallenge: jest.fn(), confirmReplacement: jest.fn(), getChallengePreview: jest.fn() } as never,
    auditService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    sessionService.getSession.mockResolvedValue(null);
  });

  it('handles plain admin pairing code before relay', async () => {
    adminTelegramService.tryCompleteLinkFromBot.mockResolvedValue({ ok: true });

    await processor.processUpdate({
      update_id: 1,
      message: {
        message_id: 1,
        text: 'RZ-ABC123',
        from: { id: 999, first_name: 'Admin' },
        chat: { id: 999 },
      },
    });

    expect(adminTelegramService.tryCompleteLinkFromBot).toHaveBeenCalled();
    expect(supportRelay.relayFreeText).not.toHaveBeenCalled();
    expect(botApi.sendMessage).toHaveBeenCalled();
  });

  it('relays free text only in support mode', async () => {
    sessionService.getSession.mockResolvedValue({ flow: 'support', step: 'active', payload: {} });

    await processor.processUpdate({
      update_id: 2,
      message: {
        message_id: 2,
        text: 'Салом, ман савол дорам',
        from: { id: 111, first_name: 'User', username: 'user1' },
        chat: { id: 111 },
      },
    });

    expect(supportRelay.relayFreeText).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Салом, ман савол дорам' }),
    );
    expect(botApi.sendMessage).toHaveBeenCalled();
  });

  it('does not relay /start user flow as free text', async () => {
    await processor.processUpdate({
      update_id: 3,
      message: {
        message_id: 3,
        text: '/start',
        from: { id: 111, first_name: 'User' },
        chat: { id: 111 },
      },
    });

    expect(supportRelay.relayFreeText).not.toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'telegram.user.started' }),
    );
  });

  it('ignores free text outside support mode', async () => {
    await processor.processUpdate({
      update_id: 5,
      message: {
        message_id: 5,
        text: 'Салом, ман савол дорам',
        from: { id: 111, first_name: 'User', username: 'user1' },
        chat: { id: 111 },
      },
    });

    expect(supportRelay.relayFreeText).not.toHaveBeenCalled();
  });

  it('relays support photo in support mode when no payment order', async () => {
    sessionService.getSession.mockResolvedValue({ flow: 'support', step: 'active', payload: {} });

    await processor.processUpdate({
      update_id: 4,
      message: {
        message_id: 4,
        photo: [{ file_id: 'ph_1' }],
        from: { id: 111, first_name: 'User' },
        chat: { id: 111 },
      },
    });

    expect(supportRelay.relayMedia).toHaveBeenCalled();
    expect(orderService.findAwaitingReceiptOrder).toHaveBeenCalled();
  });

  it('delivers admin native reply to mapped support message', async () => {
    await processor.processUpdate({
      update_id: 6,
      message: {
        message_id: 60,
        text: 'Ответ пользователю',
        from: { id: 999, first_name: 'Admin' },
        chat: { id: 999 },
        reply_to_message: {
          message_id: 42,
          chat: { id: 999 },
        },
      },
    });

    expect(supportRelay.deliverAdminReply).toHaveBeenCalledWith(
      expect.objectContaining({
        adminTelegramId: 999n,
        replyToMessageId: 42,
        text: 'Ответ пользователю',
      }),
    );
    expect(supportRelay.relayFreeText).not.toHaveBeenCalled();
  });

  it('does not treat arbitrary admin text as support reply', async () => {
    await processor.processUpdate({
      update_id: 7,
      message: {
        message_id: 70,
        text: 'Случайный текст админа',
        from: { id: 999, first_name: 'Admin' },
        chat: { id: 999 },
      },
    });

    expect(supportRelay.deliverAdminReply).not.toHaveBeenCalled();
  });

  it('notifies admin when support reply target is unknown', async () => {
    supportRelay.deliverAdminReply.mockResolvedValueOnce('unknown_target');

    await processor.processUpdate({
      update_id: 8,
      message: {
        message_id: 80,
        text: 'Ответ на старое сообщение',
        from: { id: 999, first_name: 'Admin' },
        chat: { id: 999 },
        reply_to_message: {
          message_id: 1,
          chat: { id: 999 },
        },
      },
    });

    expect(botApi.sendPlainMessage).toHaveBeenCalledWith(
      999n,
      expect.stringContaining('получателя'),
    );
  });
});

describe('TelegramUpdateProcessor admin callbacks', () => {
  const prisma = {
    telegramProcessedUpdate: { create: jest.fn().mockResolvedValue({}) },
    order: { findFirst: jest.fn().mockResolvedValue(null), findUnique: jest.fn().mockResolvedValue(null) },
    license: { findFirst: jest.fn() },
  };

  const configService = {
    get: jest.fn((key: string, fallback?: unknown) => {
      if (key === 'telegram.adminTelegramIds') return ['999'];
      return fallback;
    }),
  };

  const botApi = {
    answerCallbackQuery: jest.fn(),
    sendMessage: jest.fn(),
    sendPlainMessage: jest.fn(),
    removeReplyKeyboard: jest.fn(),
  };

  const sessionService = {
    getSession: jest.fn().mockResolvedValue(null),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn(),
    clear: jest.fn(),
  };

  const commandsService = {
    registerAdminCommandsForChat: jest.fn(),
    registerDefaultCommands: jest.fn(),
  };

  const paymentApprovalService = {
    approve: jest.fn(),
    reject: jest.fn(),
    getStoredLicenseKeyForUser: jest.fn(),
  };

  const auditService = { log: jest.fn() };

  const processor = new TelegramUpdateProcessor(
    prisma as never,
    configService as never,
    botApi as never,
    {} as never,
    { getOrderForAdminReview: jest.fn() } as never,
    paymentApprovalService as never,
    {} as never,
    { listActive: jest.fn().mockResolvedValue([]) } as never,
    { handleText: jest.fn().mockResolvedValue(false), handleCallback: jest.fn().mockResolvedValue(false) } as never,
    { tryCompleteLinkFromBot: jest.fn() } as never,
    { relayFreeText: jest.fn() } as never,
    sessionService as never,
    commandsService as never,
    { createChallenge: jest.fn(), confirmLink: jest.fn(), getChallengePreview: jest.fn(), revokeDeviceAsHolder: jest.fn() } as never,
    { createChallenge: jest.fn(), confirmReplacement: jest.fn(), getChallengePreview: jest.fn() } as never,
    auditService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    sessionService.getSession.mockResolvedValue(null);
  });

  it('rejects approve callback from non-admin telegram user', async () => {
    await (processor as unknown as { handleCallback: (u: unknown) => Promise<void> }).handleCallback({
      callback_query: {
        id: 'cb_1',
        data: 'payment:approve:ord_1',
        from: { id: 111 },
        message: { chat: { id: 111 } },
      },
    });

    expect(paymentApprovalService.approve).not.toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'telegram.admin.unauthorized' }),
    );
    expect(botApi.answerCallbackQuery).toHaveBeenCalled();
  });

  it('allows approve callback for configured admin telegram id', async () => {
    paymentApprovalService.approve.mockResolvedValue({
      orderId: 'ord_1',
      userId: 'usr_1',
      licenseId: 'lic_1',
      licenseKey: 'k'.repeat(64),
      expiresAt: new Date(),
      alreadyProcessed: false,
    });

    await (processor as unknown as { handleCallback: (u: unknown) => Promise<void> }).handleCallback({
      callback_query: {
        id: 'cb_2',
        data: 'payment:approve:ord_1',
        from: { id: 999 },
        message: { chat: { id: 999 } },
      },
    });

    expect(paymentApprovalService.approve).toHaveBeenCalledWith(
      'ord_1',
      expect.objectContaining({
        actorType: AuditActorType.TELEGRAM_BOT,
        actorId: '999',
      }),
    );
  });
});
