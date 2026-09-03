import { AuditActorType, BillingPeriod, PlanCode, TelegramLanguage } from '@prisma/client';
import { TelegramUpdateProcessor } from './telegram-update.processor';

describe('TelegramUpdateProcessor deferred context and Standard card', () => {
  const prisma = {
    telegramProcessedUpdate: { create: jest.fn().mockResolvedValue({}) },
    order: { findFirst: jest.fn().mockResolvedValue(null) },
    license: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    telegramAccount: { findUnique: jest.fn().mockResolvedValue({ id: 'ta_1' }) },
  };

  const configService = {
    get: jest.fn((key: string, fallback?: unknown) => {
      if (key === 'telegram.adminTelegramIds') return [];
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
    resolveTelegramUser: jest.fn(),
    setLanguage: jest.fn(),
  };

  const paymentConfigService = {
    listPurchaseAvailablePlans: jest.fn().mockResolvedValue([
      { id: 'plan_1', code: PlanCode.STANDARD, name: 'Standard', nameTj: 'Standard', prices: [] },
    ]),
    isPlanAvailableForPurchase: jest.fn().mockResolvedValue(true),
    listActivePlanPrices: jest.fn().mockResolvedValue([
      { planCode: PlanCode.STANDARD, billingPeriod: BillingPeriod.MONTHLY, amount: '20.00', currency: 'TJS' },
      { planCode: PlanCode.STANDARD, billingPeriod: BillingPeriod.YEARLY, amount: '250.00', currency: 'TJS' },
    ]),
    getPlanPriceForPurchase: jest.fn(),
  };

  const telegramAuthService = {
    bindTelegramAndIssueOtp: jest.fn().mockImplementation(async (_token, _acc, _tg, sendOtp) => {
      await sendOtp('482731');
    }),
  };

  const auditService = { log: jest.fn() };

  const adminTelegramAuthService = {
    isTelegramAdmin: jest.fn().mockResolvedValue(false),
    listActiveAdminTelegramIds: jest.fn().mockResolvedValue([]),
  };

  const processor = new TelegramUpdateProcessor(
    prisma as never,
    configService as never,
    botApi as never,
    telegramAccountService as never,
    { findAwaitingReceiptOrder: jest.fn().mockResolvedValue(null) } as never,
    {} as never,
    paymentConfigService as never,
    { listActive: jest.fn().mockResolvedValue([]) } as never,
    { handleText: jest.fn().mockResolvedValue(false), handleCallback: jest.fn().mockResolvedValue(false) } as never,
    { handleText: jest.fn().mockResolvedValue(false), handleCallback: jest.fn().mockResolvedValue(false) } as never,
    { showList: jest.fn(), showDetail: jest.fn(), showDevices: jest.fn(), showRevokeConfirm: jest.fn(), revokeLicense: jest.fn() } as never,
    { answerCallback: jest.fn(), renderMenu: jest.fn(), getScreen: jest.fn(), getPayload: jest.fn(), roleRoot: jest.fn() } as never,
    { tryCompleteLinkFromBot: jest.fn() } as never,
    adminTelegramAuthService as never,
    { relayFreeText: jest.fn() } as never,
    sessionService as never,
    commandsService as never,
    { createChallenge: jest.fn(), confirmLink: jest.fn(), getChallengePreview: jest.fn(), revokeDeviceAsHolder: jest.fn() } as never,
    { createChallenge: jest.fn(), confirmReplacement: jest.fn(), getChallengePreview: jest.fn() } as never,
    telegramAuthService as never,
    { listOpenConversations: jest.fn().mockResolvedValue([]), getConversationHistory: jest.fn(), closeConversation: jest.fn(), createConversation: jest.fn(), ticketLabel: jest.fn().mockReturnValue('ABCD') } as never,
    { issueLicense: jest.fn() } as never,
    auditService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    sessionService.getSession.mockResolvedValue(null);
    sessionService.get.mockResolvedValue(null);
    telegramAccountService.resolveTelegramUser.mockResolvedValue({
      userId: 'usr_1',
      telegramAccountId: 'ta_1',
      language: null,
    });
  });

  it('defers auth deep link until language is selected', async () => {
    await processor.processUpdate({
      update_id: 10,
      message: {
        message_id: 10,
        text: '/start auth_testtoken123456',
        from: { id: 111, first_name: 'User' },
        chat: { id: 111 },
      },
    });

    expect(sessionService.set).toHaveBeenCalledWith(
      111n,
      'deferred_start',
      'pending',
      expect.objectContaining({ kind: 'auth', authToken: 'testtoken123456' }),
    );
    expect(telegramAuthService.bindTelegramAndIssueOtp).not.toHaveBeenCalled();
    expect(botApi.sendMessage).toHaveBeenCalledWith(
      111n,
      expect.stringContaining('Забонро интихоб'),
      expect.any(Object),
    );
  });

  it('resumes auth flow after language selection', async () => {
    sessionService.get.mockImplementation(async (_id: bigint, flow: string) => {
      if (flow === 'deferred_start') {
        return { kind: 'auth', authToken: 'testtoken123456' };
      }
      return null;
    });
    sessionService.getSession.mockResolvedValue({
      flow: 'deferred_start',
      step: 'pending',
      payload: { kind: 'auth', authToken: 'testtoken123456' },
    });
    telegramAccountService.resolveTelegramUser
      .mockResolvedValueOnce({
        userId: 'usr_1',
        telegramAccountId: 'ta_1',
        language: null,
      })
      .mockResolvedValue({
        userId: 'usr_1',
        telegramAccountId: 'ta_1',
        language: TelegramLanguage.RU,
      });

    await (processor as unknown as { handleCallback: (u: unknown) => Promise<void> }).handleCallback({
      callback_query: {
        id: 'cb_lang',
        data: 'lang:ru',
        from: { id: 111, first_name: 'User' },
        message: { chat: { id: 111 } },
      },
    });

    expect(telegramAccountService.setLanguage).toHaveBeenCalledWith('ta_1', TelegramLanguage.RU);
    expect(telegramAuthService.bindTelegramAndIssueOtp).toHaveBeenCalled();
    expect(botApi.sendMessage).toHaveBeenCalledWith(
      111n,
      expect.stringContaining('482731'),
      expect.objectContaining({
        inline_keyboard: expect.arrayContaining([
          expect.arrayContaining([
            expect.objectContaining({ copy_text: { text: '482731' } }),
          ]),
        ]),
      }),
      { parseMode: 'none' },
    );
  });

  it('shows Standard tariff card before duration selection', async () => {
    telegramAccountService.resolveTelegramUser.mockResolvedValue({
      userId: 'usr_1',
      telegramAccountId: 'ta_1',
      language: TelegramLanguage.RU,
    });

    await (processor as unknown as { handleCallback: (u: unknown) => Promise<void> }).handleCallback({
      callback_query: {
        id: 'cb_plan',
        data: 'plan:STANDARD',
        from: { id: 111, first_name: 'User' },
        message: { chat: { id: 111 } },
      },
    });

    expect(paymentConfigService.listActivePlanPrices).toHaveBeenCalledWith(PlanCode.STANDARD);
    expect(botApi.sendMessage).toHaveBeenCalledWith(
      111n,
      expect.stringContaining('Standard'),
      expect.objectContaining({
        inline_keyboard: expect.arrayContaining([
          expect.arrayContaining([
            expect.objectContaining({ callback_data: 'duration:STANDARD:MONTHLY' }),
          ]),
        ]),
      }),
    );
  });
});
