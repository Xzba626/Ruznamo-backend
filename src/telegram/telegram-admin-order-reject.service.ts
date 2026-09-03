import { Injectable, Logger } from '@nestjs/common';
import { AuditActorType, BillingPeriod, OrderStatus, TelegramLanguage } from '@prisma/client';
import { AdminTelegramAuthService } from '../admin/telegram/admin-telegram-auth.service';
import { PaymentApprovalService } from '../payments/payment-approval.service';
import { OrderService } from '../payments/order.service';
import { billingPeriodDays, getTelegramI18n } from './i18n';
import {
  CUSTOM_REJECTION_REASON_MAX_LEN,
  PAYMENT_REJECTION_REASON_CODES,
  PaymentRejectionReasonCode,
  parsePaymentRejectionReasonCode,
  rejectionReasonButtonLabel,
  rejectionReasonCustomerText,
  rejectionReasonGuidance,
  rejectionReasonLabel,
  sanitizeCustomRejectionReason,
} from '../payments/rejection-reason';
import { BotScreen } from './nav/bot-screens';
import { NAV_FLOW } from './nav/nav-context';
import { TelegramBotApiService } from './telegram-bot-api.service';
import { TelegramBotSessionService } from './telegram-bot-session.service';
import { CB } from './telegram.messages';
import type { InlineKeyboardMarkup } from './telegram.types';

export const ADMIN_ORDER_REJECT_FLOW = 'admin_order_reject';

type RejectWizardPayload = {
  orderId: string;
  reasonCode?: PaymentRejectionReasonCode;
  customReason?: string;
  screen?: string;
};

@Injectable()
export class TelegramAdminOrderRejectService {
  private readonly logger = new Logger(TelegramAdminOrderRejectService.name);

  constructor(
    private readonly sessions: TelegramBotSessionService,
    private readonly botApi: TelegramBotApiService,
    private readonly adminTelegramAuth: AdminTelegramAuthService,
    private readonly paymentApproval: PaymentApprovalService,
    private readonly orderService: OrderService,
  ) {}

  private async isAdmin(telegramUserId: bigint): Promise<boolean> {
    return this.adminTelegramAuth.isTelegramAdmin(telegramUserId);
  }

  async handleText(telegramUserId: bigint, chatId: bigint, text: string): Promise<boolean> {
    if (!(await this.isAdmin(telegramUserId))) {
      return false;
    }
    const session = await this.sessions.getSession(telegramUserId);
    if (!session || session.flow !== ADMIN_ORDER_REJECT_FLOW || session.step !== 'custom') {
      return false;
    }

    const payload = session.payload as RejectWizardPayload;
    if (!payload.orderId) {
      await this.sessions.clear(telegramUserId);
      return true;
    }

    if (text.trim() === '❌ Отмена' || text.trim() === 'Отмена') {
      await this.showReasonSelect(telegramUserId, chatId, payload.orderId);
      return true;
    }

    const sanitized = sanitizeCustomRejectionReason(text);
    if (!sanitized) {
      await this.botApi.sendPlainMessage(
        chatId,
        `Напишите причину текстовым сообщением (от 5 до ${CUSTOM_REJECTION_REASON_MAX_LEN} символов).`,
      );
      return true;
    }

    await this.sessions.set(telegramUserId, ADMIN_ORDER_REJECT_FLOW, 'confirm', {
      orderId: payload.orderId,
      reasonCode: PaymentRejectionReasonCode.OTHER,
      customReason: sanitized,
      screen: BotScreen.ADMIN_ORDER_REJECT_CONFIRM,
    });
    await this.showConfirm(chatId, payload.orderId, PaymentRejectionReasonCode.OTHER, sanitized);
    return true;
  }

  async handleCallback(
    telegramUserId: bigint,
    chatId: bigint,
    data: string,
    callbackQueryId: string,
  ): Promise<boolean> {
    if (!data.startsWith('admin:reject:') && !data.startsWith('payment:reject:')) {
      return false;
    }
    if (!(await this.isAdmin(telegramUserId))) {
      return false;
    }

    // payment:reject:orderId → open reason select (no mutation)
    if (data.startsWith('payment:reject:') || data.startsWith('reject:')) {
      const orderId = data.startsWith('payment:reject:')
        ? data.slice('payment:reject:'.length).trim()
        : data.slice('reject:'.length).trim();
      await this.botApi.answerCallbackQuery(callbackQueryId);
      await this.showReasonSelect(telegramUserId, chatId, orderId);
      return true;
    }

    if (data.startsWith('admin:reject:back:')) {
      const orderId = data.slice('admin:reject:back:'.length).trim();
      await this.sessions.clear(telegramUserId);
      await this.botApi.answerCallbackQuery(callbackQueryId);
      await this.showOrderDetail(chatId, orderId);
      return true;
    }

    if (data.startsWith('admin:reject:cancel:')) {
      const orderId = data.slice('admin:reject:cancel:'.length).trim();
      await this.sessions.clear(telegramUserId);
      await this.botApi.answerCallbackQuery(callbackQueryId);
      await this.showOrderDetail(chatId, orderId);
      return true;
    }

    if (data.startsWith('admin:reject:change:')) {
      const orderId = data.slice('admin:reject:change:'.length).trim();
      await this.botApi.answerCallbackQuery(callbackQueryId);
      await this.showReasonSelect(telegramUserId, chatId, orderId);
      return true;
    }

    if (data.startsWith('admin:reject:custom')) {
      const fromCallback = data.startsWith('admin:reject:custom:')
        ? data.slice('admin:reject:custom:'.length).trim()
        : '';
      const session = await this.sessions.getSession(telegramUserId);
      const payload =
        session?.flow === ADMIN_ORDER_REJECT_FLOW
          ? (session.payload as RejectWizardPayload)
          : null;
      const orderId = fromCallback || payload?.orderId;
      if (!orderId) {
        await this.botApi.answerCallbackQuery(callbackQueryId, 'Сессия устарела');
        return true;
      }
      await this.sessions.set(telegramUserId, ADMIN_ORDER_REJECT_FLOW, 'custom', {
        orderId,
        reasonCode: PaymentRejectionReasonCode.OTHER,
        screen: BotScreen.ADMIN_ORDER_REJECT_CUSTOM_REASON,
      });
      await this.botApi.answerCallbackQuery(callbackQueryId);
      await this.botApi.sendMessage(
        chatId,
        'Напишите причину отказа.\n\n' +
          'Это сообщение будет отправлено пользователю.\n\n' +
          'Например:\n«На чеке указана сумма 20 TJS, а стоимость выбранного тарифа — 25 TJS.»',
        {
          inline_keyboard: [[{ text: '✖️ Отмена', callback_data: `admin:reject:change:${orderId}` }]],
        },
      );
      return true;
    }

    if (data.startsWith('admin:reject:pick:')) {
      const code = parsePaymentRejectionReasonCode(data.slice('admin:reject:pick:'.length));
      const session = await this.sessions.getSession(telegramUserId);
      const payload =
        session?.flow === ADMIN_ORDER_REJECT_FLOW
          ? (session.payload as RejectWizardPayload)
          : null;
      const orderId = payload?.orderId;
      if (!orderId || !code) {
        await this.botApi.answerCallbackQuery(callbackQueryId, 'Сессия устарела');
        return true;
      }
      if (code === PaymentRejectionReasonCode.OTHER) {
        await this.botApi.answerCallbackQuery(callbackQueryId);
        await this.sessions.set(telegramUserId, ADMIN_ORDER_REJECT_FLOW, 'custom', {
          orderId,
          reasonCode: code,
          screen: BotScreen.ADMIN_ORDER_REJECT_CUSTOM_REASON,
        });
        await this.botApi.sendMessage(
          chatId,
          'Напишите причину отказа.\n\nЭто сообщение будет отправлено пользователю.',
          {
            inline_keyboard: [[{ text: '✖️ Отмена', callback_data: `admin:reject:change:${orderId}` }]],
          },
        );
        return true;
      }
      await this.sessions.set(telegramUserId, ADMIN_ORDER_REJECT_FLOW, 'confirm', {
        orderId,
        reasonCode: code,
        screen: BotScreen.ADMIN_ORDER_REJECT_CONFIRM,
      });
      await this.botApi.answerCallbackQuery(callbackQueryId);
      await this.showConfirm(chatId, orderId, code, null);
      return true;
    }

    if (data.startsWith('admin:reject:do:')) {
      const orderId = data.slice('admin:reject:do:'.length).trim();
      return this.finalizeReject(telegramUserId, chatId, orderId, callbackQueryId);
    }

    return false;
  }

  async showReasonSelect(telegramUserId: bigint, chatId: bigint, orderId: string): Promise<void> {
    const order = await this.orderService.getOrderForAdminReview(orderId);
    if (!order) {
      await this.botApi.sendPlainMessage(chatId, 'Заявка не найдена.');
      return;
    }
    if (
      order.status === OrderStatus.REJECTED ||
      order.status === OrderStatus.COMPLETED ||
      order.status === OrderStatus.APPROVED ||
      order.status === OrderStatus.CANCELLED
    ) {
      await this.botApi.sendPlainMessage(
        chatId,
        `Заявка уже в статусе ${order.status}. Отклонение недоступно.`,
      );
      await this.sessions.clear(telegramUserId);
      return;
    }

    await this.sessions.set(telegramUserId, ADMIN_ORDER_REJECT_FLOW, 'select', {
      orderId,
      screen: BotScreen.ADMIN_ORDER_REJECT_REASON,
    });

    const shortId = orderId.slice(0, 8);
    await this.botApi.sendMessage(
      chatId,
      `Почему вы отклоняете оплату по заявке #${shortId}?\n\nВыберите причину или напишите свою.`,
      this.reasonKeyboard(orderId),
    );
  }

  private reasonKeyboard(orderId: string): InlineKeyboardMarkup {
    const codes = PAYMENT_REJECTION_REASON_CODES.filter(
      (code) => code !== PaymentRejectionReasonCode.OTHER,
    );
    const rows: InlineKeyboardMarkup['inline_keyboard'] = [];
    for (let i = 0; i < codes.length; i += 2) {
      const left = codes[i];
      const right = codes[i + 1];
      const row = [
        {
          text: rejectionReasonButtonLabel(left),
          callback_data: `admin:reject:pick:${left}`,
        },
      ];
      if (right) {
        row.push({
          text: rejectionReasonButtonLabel(right),
          callback_data: `admin:reject:pick:${right}`,
        });
      }
      rows.push(row);
    }
    rows.push([
      {
        text: rejectionReasonButtonLabel(PaymentRejectionReasonCode.OTHER),
        callback_data: `admin:reject:custom:${orderId}`,
      },
    ]);
    rows.push([{ text: '⬅️ Назад', callback_data: `admin:reject:back:${orderId}` }]);
    return { inline_keyboard: rows };
  }

  private async showConfirm(
    chatId: bigint,
    orderId: string,
    code: PaymentRejectionReasonCode,
    customReason: string | null,
  ): Promise<void> {
    const reasonText =
      code === PaymentRejectionReasonCode.OTHER && customReason
        ? customReason
        : rejectionReasonLabel(code, 'RU');
    const shortId = orderId.slice(0, 8);
    await this.botApi.sendMessage(
      chatId,
      `Отклонить заявку #${shortId}?\n\n` +
        `Причина:\n${reasonText}\n\n` +
        `Пользователь получит эту причину в Telegram.`,
      {
        inline_keyboard: [
          [{ text: '❌ Отклонить заявку', callback_data: `admin:reject:do:${orderId}` }],
          [{ text: '⬅️ Изменить причину', callback_data: `admin:reject:change:${orderId}` }],
          [{ text: 'Отмена', callback_data: `admin:reject:cancel:${orderId}` }],
        ],
      },
    );
  }

  private async finalizeReject(
    telegramUserId: bigint,
    chatId: bigint,
    orderId: string,
    callbackQueryId: string,
  ): Promise<boolean> {
    const session = await this.sessions.getSession(telegramUserId);
    const payload =
      session?.flow === ADMIN_ORDER_REJECT_FLOW
        ? (session.payload as RejectWizardPayload)
        : null;

    if (!payload?.orderId || payload.orderId !== orderId || session?.step !== 'confirm') {
      await this.botApi.answerCallbackQuery(callbackQueryId, 'Подтверждение устарело');
      await this.showOrderDetail(chatId, orderId);
      return true;
    }

    const code =
      parsePaymentRejectionReasonCode(payload.reasonCode) ?? PaymentRejectionReasonCode.OTHER;
    const customReason = payload.customReason?.trim() || null;

    try {
      const result = await this.paymentApproval.reject(
        orderId,
        {
          actorType: AuditActorType.TELEGRAM_BOT,
          actorId: telegramUserId.toString(),
          telegramUserId: telegramUserId.toString(),
        },
        { code, text: customReason },
      );

      await this.sessions.clear(telegramUserId);
      await this.sessions.set(telegramUserId, NAV_FLOW, BotScreen.ADMIN_ORDER_DETAIL, {
        screen: BotScreen.ADMIN_ORDER_DETAIL,
        orderId,
      });

      if (result.alreadyProcessed) {
        await this.botApi.answerCallbackQuery(callbackQueryId, 'Уже отклонено');
        await this.botApi.sendPlainMessage(chatId, `Заявка #${orderId.slice(0, 8)} уже была отклонена.`);
        return true;
      }

      await this.notifyCustomer(orderId, code, customReason);
      await this.botApi.answerCallbackQuery(callbackQueryId, '❌ Отклонено');
      const reasonForAdmin =
        code === PaymentRejectionReasonCode.OTHER && customReason
          ? customReason
          : rejectionReasonLabel(code, 'RU');
      await this.botApi.sendMessage(
        chatId,
        `❌ Оплата отклонена\nЗаявка: #${orderId.slice(0, 8)}\nПричина: ${reasonForAdmin}`,
        {
          inline_keyboard: [
            [{ text: '⬅️ К заявке', callback_data: `admin:reject:back:${orderId}` }],
            [{ text: 'Админ-меню', callback_data: CB.ACTION_ADMIN_MENU }],
          ],
        },
      );
    } catch (error) {
      this.logger.warn({ orderId, error }, 'Reject finalize failed');
      await this.botApi.answerCallbackQuery(callbackQueryId, 'Ошибка');
    }
    return true;
  }

  private async notifyCustomer(
    orderId: string,
    code: PaymentRejectionReasonCode,
    customReason: string | null,
  ): Promise<void> {
    const order = await this.orderService.getOrderForAdminReview(orderId);
    if (!order?.user.telegramAccount) {
      return;
    }
    const tg = order.user.telegramAccount;
    const userChatId = tg.chatId ?? tg.telegramId;
    if (!userChatId) {
      return;
    }

    const lang: 'RU' | 'TJ' = tg.language === TelegramLanguage.RU ? 'RU' : 'TJ';
    const msgs = getTelegramI18n(tg.language ?? null);
    const days = billingPeriodDays(order.billingPeriod ?? BillingPeriod.MONTHLY);
    const periodLabel = lang === 'RU' ? `${days} дней` : `${days} рӯз`;
    const reasonText = rejectionReasonCustomerText(code, customReason, lang);
    const guidance = rejectionReasonGuidance(code, lang);

    const body = msgs.paymentRejectedDetailed(
      orderId.slice(0, 8),
      order.plan.name,
      periodLabel,
      reasonText,
      guidance,
    );

    await this.botApi.sendMessage(userChatId, body, {
      inline_keyboard: [
        [{ text: msgs.replyBuyLicense, callback_data: CB.ACTION_GET_KEY }],
        [{ text: msgs.replySupport, callback_data: CB.ACTION_SUPPORT }],
      ],
    });
    await this.botApi.removeReplyKeyboard(userChatId);
  }

  async showOrderDetail(chatId: bigint, orderId: string): Promise<void> {
    const order = await this.orderService.getOrderForAdminReview(orderId);
    if (!order) {
      await this.botApi.sendPlainMessage(chatId, 'Заявка не найдена.');
      return;
    }

    const tgAccount = order.user.telegramAccount;
    const days = billingPeriodDays(order.billingPeriod);
    const displayName = tgAccount?.firstName ?? order.user.displayName ?? '—';
    const username = tgAccount?.username ? `@${tgAccount.username}` : '—';
    const reasonLine =
      order.status === OrderStatus.REJECTED && (order.rejectionReason || order.rejectionReasonCode)
        ? `\nПричина: ${order.rejectionReason ?? order.rejectionReasonCode}` +
          (order.rejectedAt ? `\nДата: ${order.rejectedAt.toISOString()}` : '')
        : '';

    const text =
      `Заявка #${orderId.slice(0, 8)}\n\n` +
      `Пользователь: ${displayName}\n` +
      `Telegram: ${username}\n` +
      `Тариф: ${order.plan.name}\n` +
      `Срок: ${days} дней\n` +
      `Сумма: ${order.amount} ${order.currency}\n` +
      `Способ оплаты: ${order.paymentMethodName ?? '—'}\n` +
      `Статус: ${order.status}` +
      reasonLine +
      `\nOrder: \`${order.id}\``;

    const canDecide =
      order.status === OrderStatus.UNDER_REVIEW ||
      order.status === OrderStatus.RECEIPT_SUBMITTED ||
      order.status === OrderStatus.PENDING;

    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: canDecide
        ? [
            [
              { text: '✅ Подтвердить', callback_data: CB.approve(orderId) },
              { text: '❌ Отклонить', callback_data: CB.reject(orderId) },
            ],
            [{ text: '⬅️ Админ-меню', callback_data: CB.ACTION_ADMIN_MENU }],
          ]
        : [[{ text: '⬅️ Админ-меню', callback_data: CB.ACTION_ADMIN_MENU }]],
    };

    await this.botApi.sendMessage(chatId, text, keyboard);
  }
}
