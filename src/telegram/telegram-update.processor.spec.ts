import { AuditActorType } from '@prisma/client';
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
    answerCallbackQuery: jest.fn(),
  };

  const telegramAccountService = {
    resolveTelegramUser: jest.fn().mockResolvedValue({ userId: 'usr_1' }),
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
  };

  const auditService = { log: jest.fn() };

  const processor = new TelegramUpdateProcessor(
    prisma as never,
    configService as never,
    botApi as never,
    telegramAccountService as never,
    orderService as never,
    {} as never,
    {} as never,
    adminTelegramService as never,
    supportRelay as never,
    auditService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
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

  it('relays unknown free text from regular users', async () => {
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

  it('relays support photo when no payment order', async () => {
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
    { tryCompleteLinkFromBot: jest.fn() } as never,
    { relayFreeText: jest.fn() } as never,
    auditService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
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
