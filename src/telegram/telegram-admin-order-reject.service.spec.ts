import { OrderStatus, PaymentMethodType } from '@prisma/client';
import { PaymentRejectionReasonCode } from '../payments/rejection-reason';
import {
  ADMIN_ORDER_REJECT_FLOW,
  TelegramAdminOrderRejectService,
} from './telegram-admin-order-reject.service';
import { BotScreen } from './nav/bot-screens';

describe('TelegramAdminOrderRejectService', () => {
  const sessions = {
    getSession: jest.fn(),
    set: jest.fn(),
    clear: jest.fn(),
  };
  const botApi = {
    answerCallbackQuery: jest.fn(),
    sendMessage: jest.fn(),
    sendPlainMessage: jest.fn(),
    removeReplyKeyboard: jest.fn(),
  };
  const adminTelegramAuth = { isTelegramAdmin: jest.fn().mockResolvedValue(true) };
  const paymentApproval = { reject: jest.fn() };
  const orderService = {
    getOrderForAdminReview: jest.fn(),
  };

  const service = new TelegramAdminOrderRejectService(
    sessions as never,
    botApi as never,
    adminTelegramAuth as never,
    paymentApproval as never,
    orderService as never,
  );

  const telegramId = 99n;
  const chatId = 99n;
  const orderId = 'ord_reject_1';

  beforeEach(() => {
    jest.clearAllMocks();
    orderService.getOrderForAdminReview.mockResolvedValue({
      id: orderId,
      status: OrderStatus.UNDER_REVIEW,
      billingPeriod: 'MONTHLY',
      amount: '25.00',
      currency: 'TJS',
      paymentMethodName: 'Alif',
      plan: { name: 'Standard' },
      user: {
        displayName: 'User',
        telegramAccount: {
          firstName: 'User',
          username: 'user',
          telegramId: 1n,
          chatId: 1n,
          language: 'RU',
        },
      },
    });
  });

  it('opens reason selection without mutating order', async () => {
    await service.handleCallback(telegramId, chatId, `payment:reject:${orderId}`, 'cq1');

    expect(paymentApproval.reject).not.toHaveBeenCalled();
    expect(sessions.set).toHaveBeenCalledWith(
      telegramId,
      ADMIN_ORDER_REJECT_FLOW,
      'select',
      expect.objectContaining({ orderId, screen: BotScreen.ADMIN_ORDER_REJECT_REASON }),
    );
    expect(botApi.sendMessage).toHaveBeenCalledWith(
      chatId,
      expect.stringContaining('Почему вы отклоняете'),
      expect.objectContaining({
        inline_keyboard: expect.any(Array),
      }),
    );
  });

  it('Back from reason select returns to order detail without reject', async () => {
    await service.handleCallback(telegramId, chatId, `admin:reject:back:${orderId}`, 'cq2');
    expect(paymentApproval.reject).not.toHaveBeenCalled();
    expect(sessions.clear).toHaveBeenCalled();
    expect(botApi.sendMessage).toHaveBeenCalledWith(
      chatId,
      expect.stringContaining('Заявка #'),
      expect.any(Object),
    );
  });

  it('preset pick shows confirm without mutation', async () => {
    sessions.getSession.mockResolvedValue({
      flow: ADMIN_ORDER_REJECT_FLOW,
      step: 'select',
      payload: { orderId },
    });

    await service.handleCallback(
      telegramId,
      chatId,
      `admin:reject:pick:${PaymentRejectionReasonCode.AMOUNT_MISMATCH}`,
      'cq3',
    );

    expect(paymentApproval.reject).not.toHaveBeenCalled();
    expect(sessions.set).toHaveBeenCalledWith(
      telegramId,
      ADMIN_ORDER_REJECT_FLOW,
      'confirm',
      expect.objectContaining({
        orderId,
        reasonCode: PaymentRejectionReasonCode.AMOUNT_MISMATCH,
      }),
    );
    expect(botApi.sendMessage).toHaveBeenCalledWith(
      chatId,
      expect.stringContaining('Отклонить заявку'),
      expect.objectContaining({
        inline_keyboard: expect.arrayContaining([
          expect.arrayContaining([
            expect.objectContaining({ callback_data: `admin:reject:do:${orderId}` }),
          ]),
        ]),
      }),
    );
  });

  it('final do rejects once and notifies customer with reason', async () => {
    sessions.getSession.mockResolvedValue({
      flow: ADMIN_ORDER_REJECT_FLOW,
      step: 'confirm',
      payload: {
        orderId,
        reasonCode: PaymentRejectionReasonCode.AMOUNT_MISMATCH,
      },
    });
    paymentApproval.reject.mockResolvedValue({
      orderId,
      alreadyProcessed: false,
      reasonCode: PaymentRejectionReasonCode.AMOUNT_MISMATCH,
      reasonText: 'Неверная сумма',
    });

    await service.handleCallback(telegramId, chatId, `admin:reject:do:${orderId}`, 'cq4');

    expect(paymentApproval.reject).toHaveBeenCalledWith(
      orderId,
      expect.objectContaining({ telegramUserId: telegramId.toString() }),
      expect.objectContaining({ code: PaymentRejectionReasonCode.AMOUNT_MISMATCH }),
    );
    expect(botApi.sendMessage).toHaveBeenCalledWith(
      1n,
      expect.stringContaining('Неверная сумма'),
      expect.any(Object),
    );
  });

  it('double final reject is idempotent', async () => {
    sessions.getSession.mockResolvedValue({
      flow: ADMIN_ORDER_REJECT_FLOW,
      step: 'confirm',
      payload: {
        orderId,
        reasonCode: PaymentRejectionReasonCode.PAYMENT_NOT_FOUND,
      },
    });
    paymentApproval.reject.mockResolvedValue({
      orderId,
      alreadyProcessed: true,
      reasonCode: PaymentRejectionReasonCode.PAYMENT_NOT_FOUND,
      reasonText: 'Оплата не найдена',
    });

    await service.handleCallback(telegramId, chatId, `admin:reject:do:${orderId}`, 'cq5');
    expect(botApi.answerCallbackQuery).toHaveBeenCalledWith('cq5', 'Уже отклонено');
  });

  it('custom text invalid media path stays on custom via handleText empty', async () => {
    sessions.getSession.mockResolvedValue({
      flow: ADMIN_ORDER_REJECT_FLOW,
      step: 'custom',
      payload: { orderId },
    });
    await service.handleText(telegramId, chatId, '  ab  ');
    expect(paymentApproval.reject).not.toHaveBeenCalled();
    expect(botApi.sendPlainMessage).toHaveBeenCalledWith(
      chatId,
      expect.stringContaining('текстовым сообщением'),
    );
  });

  it('custom reason goes to confirm then can finalize', async () => {
    sessions.getSession.mockResolvedValue({
      flow: ADMIN_ORDER_REJECT_FLOW,
      step: 'custom',
      payload: { orderId },
    });
    await service.handleText(telegramId, chatId, 'На чеке указана другая сумма оплаты.');
    expect(sessions.set).toHaveBeenCalledWith(
      telegramId,
      ADMIN_ORDER_REJECT_FLOW,
      'confirm',
      expect.objectContaining({
        reasonCode: PaymentRejectionReasonCode.OTHER,
        customReason: 'На чеке указана другая сумма оплаты.',
      }),
    );
  });
});
