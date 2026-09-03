import { Injectable, Logger } from '@nestjs/common';
import { PaymentMethodType } from '@prisma/client';
import { AdminTelegramAuthService } from '../admin/telegram/admin-telegram-auth.service';
import { PaymentMethodService } from '../payments/payment-method.service';
import { TelegramBotApiService } from './telegram-bot-api.service';
import { TelegramBotSessionService } from './telegram-bot-session.service';
import { InlineKeyboardMarkup } from './telegram.types';

const FLOW = 'admin_payment_method';

type WizardPayload = {
  mode?: 'add' | 'edit';
  methodId?: string;
  name?: string;
  type?: PaymentMethodType;
  paymentValue?: string;
  recipientName?: string;
};

@Injectable()
export class TelegramAdminPaymentMethodsService {
  private readonly logger = new Logger(TelegramAdminPaymentMethodsService.name);

  constructor(
    private readonly paymentMethods: PaymentMethodService,
    private readonly sessions: TelegramBotSessionService,
    private readonly botApi: TelegramBotApiService,
    private readonly adminTelegramAuth: AdminTelegramAuthService,
  ) {}

  private async isAdmin(telegramUserId: bigint): Promise<boolean> {
    return this.adminTelegramAuth.isTelegramAdmin(telegramUserId);
  }

  async handleText(telegramUserId: bigint, chatId: bigint, text: string): Promise<boolean> {
    if (!(await this.isAdmin(telegramUserId))) {
      return false;
    }

    if (text === '💳 Реквизиты') {
      await this.showList(chatId);
      return true;
    }

    if (text === '📋 Заявки') {
      await this.showPendingOrders(chatId);
      return true;
    }

    const session = await this.sessions.getSession(telegramUserId);
    if (!session || session.flow !== FLOW) {
      return false;
    }

    const step = session.step ?? 'name';
    const payload = { ...(session.payload as WizardPayload) };

    if (text === '❌ Отмена') {
      await this.sessions.clear(telegramUserId);
      await this.botApi.sendPlainMessage(chatId, 'Отменено.');
      await this.showList(chatId);
      return true;
    }

    switch (step) {
      case 'name':
        payload.name = text.trim();
        await this.sessions.set(telegramUserId, FLOW, 'type', payload);
        await this.botApi.sendMessage(chatId, 'Выберите тип:', this.typeKeyboard());
        return true;
      case 'value':
        payload.paymentValue = text.trim();
        await this.sessions.set(telegramUserId, FLOW, 'recipient', payload);
        await this.botApi.sendPlainMessage(chatId, 'Введите имя получателя:');
        return true;
      case 'recipient':
        payload.recipientName = text.trim();
        await this.sessions.set(telegramUserId, FLOW, 'confirm', payload);
        await this.botApi.sendMessage(
          chatId,
          this.previewText(payload),
          this.confirmKeyboard(),
        );
        return true;
      default:
        return false;
    }
  }

  async handleCallback(
    telegramUserId: bigint,
    chatId: bigint,
    data: string,
    callbackQueryId: string,
  ): Promise<boolean> {
    if (!(await this.isAdmin(telegramUserId))) {
      return false;
    }

    if (data === 'admin:pm:list') {
      await this.botApi.answerCallbackQuery(callbackQueryId);
      await this.showList(chatId);
      return true;
    }

    if (data === 'admin:pm:add') {
      await this.sessions.set(telegramUserId, FLOW, 'name', { mode: 'add' });
      await this.botApi.answerCallbackQuery(callbackQueryId);
      await this.botApi.sendPlainMessage(chatId, 'Введите название способа оплаты:');
      return true;
    }

    if (data.startsWith('admin:pm:edit:')) {
      const methodId = data.slice('admin:pm:edit:'.length);
      const method = await this.paymentMethods.getById(methodId);
      await this.sessions.set(telegramUserId, FLOW, 'name', {
        mode: 'edit',
        methodId,
        name: method.name,
        type: method.type,
        paymentValue: method.paymentValue,
        recipientName: method.recipientName,
      });
      await this.botApi.answerCallbackQuery(callbackQueryId);
      await this.botApi.sendPlainMessage(
        chatId,
        `Редактирование: ${method.name}\nВведите новое название (или то же):`,
      );
      return true;
    }

    if (data.startsWith('admin:pm:toggle:')) {
      const methodId = data.slice('admin:pm:toggle:'.length);
      const method = await this.paymentMethods.getById(methodId);
      await this.paymentMethods.setActive(methodId, !method.isActive);
      await this.botApi.answerCallbackQuery(callbackQueryId, method.isActive ? 'Отключено' : 'Включено');
      await this.showList(chatId);
      return true;
    }

    if (data.startsWith('admin:pm:delete:')) {
      const methodId = data.slice('admin:pm:delete:'.length);
      await this.paymentMethods.safeDelete(methodId);
      await this.botApi.answerCallbackQuery(callbackQueryId, 'Удалено/отключено');
      await this.showList(chatId);
      return true;
    }

    if (data === 'admin:pm:type:PHONE' || data === 'admin:pm:type:CARD') {
      const session = await this.sessions.get<WizardPayload>(telegramUserId, FLOW);
      if (!session) return false;
      const type = data.endsWith('CARD') ? PaymentMethodType.CARD : PaymentMethodType.PHONE;
      await this.sessions.set(telegramUserId, FLOW, 'value', { ...session, type });
      await this.botApi.answerCallbackQuery(callbackQueryId);
      await this.botApi.sendPlainMessage(
        chatId,
        type === PaymentMethodType.PHONE ? 'Введите номер телефона:' : 'Введите номер карты:',
      );
      return true;
    }

    if (data === 'admin:pm:save') {
      const session = await this.sessions.get<WizardPayload>(telegramUserId, FLOW);
      if (!session?.name || !session.type || !session.paymentValue || !session.recipientName) {
        await this.botApi.answerCallbackQuery(callbackQueryId, 'Не хватает данных');
        return true;
      }
      if (session.mode === 'edit' && session.methodId) {
        await this.paymentMethods.update(session.methodId, {
          name: session.name,
          type: session.type,
          paymentValue: session.paymentValue,
          recipientName: session.recipientName,
        });
      } else {
        await this.paymentMethods.create({
          name: session.name,
          type: session.type,
          paymentValue: session.paymentValue,
          recipientName: session.recipientName,
        });
      }
      await this.sessions.clear(telegramUserId);
      await this.botApi.answerCallbackQuery(callbackQueryId, 'Сохранено');
      await this.showList(chatId);
      return true;
    }

    if (data === 'admin:pm:cancel') {
      await this.sessions.clear(telegramUserId);
      await this.botApi.answerCallbackQuery(callbackQueryId);
      await this.showList(chatId);
      return true;
    }

    return false;
  }

  private previewText(payload: WizardPayload): string {
    const typeLabel = payload.type === PaymentMethodType.CARD ? 'Банковская карта' : 'Номер телефона';
    return (
      `Проверьте данные:\n\n` +
      `Название: ${payload.name}\n` +
      `Тип: ${typeLabel}\n` +
      `Номер: ${payload.paymentValue}\n` +
      `Получатель: ${payload.recipientName}`
    );
  }

  private typeKeyboard(): InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [
          { text: '📱 Номер телефона', callback_data: 'admin:pm:type:PHONE' },
          { text: '💳 Банковская карта', callback_data: 'admin:pm:type:CARD' },
        ],
        [{ text: '❌ Отмена', callback_data: 'admin:pm:cancel' }],
      ],
    };
  }

  private confirmKeyboard(): InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [
          { text: '✅ Сохранить', callback_data: 'admin:pm:save' },
          { text: '❌ Отмена', callback_data: 'admin:pm:cancel' },
        ],
      ],
    };
  }

  private listKeyboard(methods: Array<{ id: string; name: string; isActive: boolean }>): InlineKeyboardMarkup {
    const rows = methods.map((method) => [
      {
        text: `${method.isActive ? '🟢' : '⚪'} ${method.name}`,
        callback_data: `admin:pm:noop:${method.id}`,
      },
      { text: '✏️', callback_data: `admin:pm:edit:${method.id}` },
      { text: method.isActive ? 'Выкл' : 'Вкл', callback_data: `admin:pm:toggle:${method.id}` },
      { text: '🗑', callback_data: `admin:pm:delete:${method.id}` },
    ]);

    return {
      inline_keyboard: [
        ...rows,
        [{ text: '➕ Добавить', callback_data: 'admin:pm:add' }],
        [{ text: '↩️ Назад', callback_data: 'admin:pm:list' }],
      ],
    };
  }

  async showList(chatId: bigint): Promise<void> {
    const methods = await this.paymentMethods.listAll();
    if (methods.length === 0) {
      await this.botApi.sendMessage(
        chatId,
        'Способы оплаты не настроены.\n\nНажмите «➕ Добавить».',
        {
          inline_keyboard: [[{ text: '➕ Добавить', callback_data: 'admin:pm:add' }]],
        },
      );
      return;
    }

    const lines = methods.map(
      (method) =>
        `${method.isActive ? '🟢' : '⚪'} ${method.name} — ${method.paymentValue} (${method.recipientName})`,
    );

    await this.botApi.sendMessage(chatId, `💳 Реквизиты\n\n${lines.join('\n')}`, this.listKeyboard(methods));
  }

  async showPendingOrders(chatId: bigint): Promise<void> {
    // lightweight summary; detailed review stays in receipt messages
    await this.botApi.sendPlainMessage(
      chatId,
      '📋 Заявки на проверку приходят сюда автоматически при отправке чека пользователем.',
    );
  }
}
