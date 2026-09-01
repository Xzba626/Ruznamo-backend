import type { TelegramI18n } from './i18n/telegram-i18n.types';
import type { InlineKeyboardMarkup, ReplyKeyboardMarkup } from './telegram.types';

export function userMainReplyKeyboard(msgs: TelegramI18n): ReplyKeyboardMarkup {
  return {
    keyboard: [
      [{ text: msgs.replyBuyLicense }, { text: msgs.replyMyLicenses }],
      [{ text: msgs.replySupport }, { text: msgs.replyLanguage }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

export function adminMainReplyKeyboard(): ReplyKeyboardMarkup {
  return {
    keyboard: [
      [{ text: '💳 Реквизиты' }, { text: '📋 Заявки' }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

export function inlineMainMenuButton(msgs: TelegramI18n): InlineKeyboardMarkup {
  return {
    inline_keyboard: [[{ text: msgs.replyMainMenu, callback_data: 'action:main_menu' }]],
  };
}

export function isReplyMenuText(text: string, msgs: TelegramI18n): boolean {
  return (
    text === msgs.replyBuyLicense ||
    text === msgs.replyMyLicenses ||
    text === msgs.replySupport ||
    text === msgs.replyLanguage ||
    text === msgs.replyMainMenu
  );
}

export const ADMIN_REPLY_PAYMENT_METHODS = '💳 Реквизиты';
export const ADMIN_REPLY_ORDERS = '📋 Заявки';
