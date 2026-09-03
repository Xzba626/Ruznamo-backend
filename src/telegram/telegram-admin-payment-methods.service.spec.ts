import { PaymentMethodType } from '@prisma/client';
import { CB } from './telegram.messages';
import { BotScreen, backParent } from './nav/bot-screens';
import { NAV_FLOW } from './nav/nav-context';
import {
  ADMIN_PM_FLOW,
  TelegramAdminPaymentMethodsService,
} from './telegram-admin-payment-methods.service';

describe('TelegramAdminPaymentMethodsService navigation', () => {
  const paymentMethods = {
    listAll: jest.fn(),
    getById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    setActive: jest.fn(),
    safeDelete: jest.fn(),
  };
  const sessions = {
    getSession: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    clear: jest.fn(),
  };
  const botApi = {
    answerCallbackQuery: jest.fn(),
    sendMessage: jest.fn(),
    sendPlainMessage: jest.fn(),
  };
  const adminTelegramAuth = {
    isTelegramAdmin: jest.fn().mockResolvedValue(true),
  };

  const service = new TelegramAdminPaymentMethodsService(
    paymentMethods as never,
    sessions as never,
    botApi as never,
    adminTelegramAuth as never,
  );

  const telegramId = 42n;
  const chatId = 42n;

  beforeEach(() => {
    jest.clearAllMocks();
    paymentMethods.listAll.mockResolvedValue([
      {
        id: 'pm1',
        name: 'Alif',
        paymentValue: '1234',
        recipientName: 'Owner',
        isActive: true,
      },
    ]);
  });

  it('list Back callback targets ADMIN_ROOT, not list again', async () => {
    await service.showList(telegramId, chatId);
    const keyboard = botApi.sendMessage.mock.calls[0][2] as {
      inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
    };
    const flat = keyboard.inline_keyboard.flat();
    const back = flat.find((row) => row.text.includes('Назад'));
    expect(back?.callback_data).toBe(CB.ACTION_ADMIN_MENU);
    expect(back?.callback_data).not.toBe('admin:pm:list');
    expect(sessions.set).toHaveBeenCalledWith(
      telegramId,
      NAV_FLOW,
      BotScreen.ADMIN_PAYMENT_METHODS_LIST,
      expect.objectContaining({ screen: BotScreen.ADMIN_PAYMENT_METHODS_LIST }),
    );
  });

  it('empty list also Back to ADMIN_ROOT', async () => {
    paymentMethods.listAll.mockResolvedValue([]);
    await service.showList(telegramId, chatId);
    const keyboard = botApi.sendMessage.mock.calls[0][2] as {
      inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
    };
    const back = keyboard.inline_keyboard.flat().find((row) => row.text.includes('Назад'));
    expect(back?.callback_data).toBe(CB.ACTION_ADMIN_MENU);
  });

  it('save clears wizard and persists list screen', async () => {
    sessions.getSession.mockResolvedValue({
      flow: ADMIN_PM_FLOW,
      step: 'confirm',
      payload: {
        mode: 'add',
        name: 'Card',
        type: PaymentMethodType.CARD,
        paymentValue: '8600',
        recipientName: 'Ali',
      },
    });
    paymentMethods.create.mockResolvedValue({ id: 'pm_new' });

    await service.handleCallback(telegramId, chatId, 'admin:pm:save', 'cq1');

    expect(sessions.set).toHaveBeenCalledWith(
      telegramId,
      ADMIN_PM_FLOW,
      'done',
      expect.any(Object),
    );
    expect(paymentMethods.create).toHaveBeenCalledTimes(1);
    expect(sessions.clear).toHaveBeenCalledWith(telegramId);
    expect(sessions.set).toHaveBeenCalledWith(
      telegramId,
      NAV_FLOW,
      BotScreen.ADMIN_PAYMENT_METHODS_LIST,
      expect.objectContaining({ screen: BotScreen.ADMIN_PAYMENT_METHODS_LIST }),
    );
    expect(botApi.sendMessage).toHaveBeenCalled();
  });

  it('double save does not create duplicate and does not resurrect wizard', async () => {
    sessions.getSession.mockResolvedValue({
      flow: ADMIN_PM_FLOW,
      step: 'done',
      payload: {
        mode: 'add',
        name: 'Card',
        type: PaymentMethodType.CARD,
        paymentValue: '8600',
        recipientName: 'Ali',
      },
    });

    await service.handleCallback(telegramId, chatId, 'admin:pm:save', 'cq2');

    expect(paymentMethods.create).not.toHaveBeenCalled();
    expect(botApi.answerCallbackQuery).toHaveBeenCalledWith('cq2', 'Уже сохранено');
  });

  it('stale save without session shows list safely', async () => {
    sessions.getSession.mockResolvedValue(null);
    await service.handleCallback(telegramId, chatId, 'admin:pm:save', 'cq3');
    expect(paymentMethods.create).not.toHaveBeenCalled();
    expect(botApi.answerCallbackQuery).toHaveBeenCalledWith('cq3', 'Уже сохранено или устарело');
    expect(botApi.sendMessage).toHaveBeenCalled();
  });

  it('cancel clears edit state and returns to list', async () => {
    await service.handleCallback(telegramId, chatId, 'admin:pm:cancel', 'cq4');
    expect(sessions.clear).toHaveBeenCalledWith(telegramId);
    expect(botApi.sendMessage).toHaveBeenCalled();
  });

  it('edit save updates existing method and clears wizard', async () => {
    sessions.getSession.mockResolvedValue({
      flow: ADMIN_PM_FLOW,
      step: 'confirm',
      payload: {
        mode: 'edit',
        methodId: 'pm1',
        name: 'Card2',
        type: PaymentMethodType.CARD,
        paymentValue: '8601',
        recipientName: 'Ali',
      },
    });

    await service.handleCallback(telegramId, chatId, 'admin:pm:save', 'cq5');

    expect(paymentMethods.update).toHaveBeenCalledWith(
      'pm1',
      expect.objectContaining({ name: 'Card2', paymentValue: '8601' }),
    );
    expect(paymentMethods.create).not.toHaveBeenCalled();
    expect(sessions.clear).toHaveBeenCalled();
  });
});

describe('ADMIN_PAYMENT_METHODS Back parents', () => {
  it('list → ADMIN_ROOT; edit → list', () => {
    expect(backParent(BotScreen.ADMIN_PAYMENT_METHODS_LIST)).toBe(BotScreen.ADMIN_ROOT);
    expect(backParent(BotScreen.ADMIN_PAYMENT_METHOD_EDIT)).toBe(BotScreen.ADMIN_PAYMENT_METHODS_LIST);
  });
});
