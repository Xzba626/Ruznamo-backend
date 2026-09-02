import type { TelegramI18n } from './i18n/telegram-i18n.types';
import type { InlineKeyboardMarkup, ReplyKeyboardRemove } from './telegram.types';

/** Removes persistent reply keyboards from older bot versions. */
export function removeReplyKeyboard(): ReplyKeyboardRemove {
  return { remove_keyboard: true };
}

export function navRow(msgs: TelegramI18n, backCallback: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: msgs.menuBack, callback_data: backCallback },
        { text: msgs.replyMainMenu, callback_data: 'action:main_menu' },
      ],
    ],
  };
}

export function homeRow(msgs: TelegramI18n): InlineKeyboardMarkup {
  return {
    inline_keyboard: [[{ text: msgs.replyMainMenu, callback_data: 'action:main_menu' }]],
  };
}

export function supportExitKeyboard(msgs: TelegramI18n): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: msgs.supportExit, callback_data: 'action:support_exit' }],
      [{ text: msgs.replyMainMenu, callback_data: 'action:main_menu' }],
    ],
  };
}

export function languageKeyboard(msgs: TelegramI18n): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: msgs.languageButtonTj, callback_data: 'lang:tj' }],
      [{ text: msgs.languageButtonRu, callback_data: 'lang:ru' }],
    ],
  };
}

export function licensesPageKeyboard(
  msgs: TelegramI18n,
  page: number,
  totalPages: number,
): InlineKeyboardMarkup {
  const row: Array<{ text: string; callback_data: string }> = [];
  if (page > 0) {
    row.push({ text: '◀️', callback_data: `licenses:page:${page - 1}` });
  }
  if (page < totalPages - 1) {
    row.push({ text: '▶️', callback_data: `licenses:page:${page + 1}` });
  }
  return {
    inline_keyboard: [
      ...(row.length ? [row] : []),
      [{ text: msgs.replyMainMenu, callback_data: 'action:main_menu' }],
    ],
  };
}

/** Legacy reply-keyboard labels — still recognized for users with old keyboards. */
export function isLegacyReplyMenuText(text: string, msgs: TelegramI18n): boolean {
  return (
    text === msgs.replyBuyLicense ||
    text === msgs.replyMyLicenses ||
    text === msgs.replySupport ||
    text === msgs.replyLanguage ||
    text === msgs.replyMainMenu ||
    text === '💳 Реквизиты' ||
    text === '📋 Заявки'
  );
}

export const ADMIN_REPLY_PAYMENT_METHODS = '💳 Реквизиты';
export const ADMIN_REPLY_ORDERS = '📋 Заявки';
