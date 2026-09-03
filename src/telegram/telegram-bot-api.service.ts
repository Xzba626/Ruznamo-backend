import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InlineKeyboardMarkup, ReplyKeyboardMarkup, ReplyKeyboardRemove, TelegramReplyMarkup } from './telegram.types';

@Injectable()
export class TelegramBotApiService {
  private readonly logger = new Logger(TelegramBotApiService.name);

  constructor(private readonly configService: ConfigService) {}

  private get token(): string {
    return this.configService.get<string>('telegram.botToken', '');
  }

  private async call<T>(method: string, body: Record<string, unknown>): Promise<T | null> {
    if (!this.token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN is not configured');
      return null;
    }

    const response = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      this.logger.warn({ method, status: response.status }, 'Telegram API call failed');
      return null;
    }

    const json = (await response.json()) as { ok: boolean; result?: T };
    return json.ok ? (json.result ?? null) : null;
  }

  async sendMessage(
    chatId: number | bigint,
    text: string,
    replyMarkup?: TelegramReplyMarkup,
    options?: { parseMode?: 'Markdown' | 'HTML' | 'none' },
  ): Promise<number | null> {
    const parseMode = options?.parseMode ?? 'Markdown';
    const result = await this.call<{ message_id: number }>('sendMessage', {
      chat_id: Number(chatId),
      text,
      ...(parseMode !== 'none' ? { parse_mode: parseMode } : {}),
      reply_markup: replyMarkup,
    });
    return result?.message_id ?? null;
  }

  sendPlainMessage(
    chatId: number | bigint,
    text: string,
    replyMarkup?: ReplyKeyboardMarkup | ReplyKeyboardRemove,
  ): Promise<number | null> {
    return this.sendMessage(chatId, text, replyMarkup, { parseMode: 'none' });
  }

  removeReplyKeyboard(chatId: number | bigint): Promise<void> {
    return this.sendPlainMessage(chatId, ' ', { remove_keyboard: true }).then(() => undefined);
  }

  async sendPhoto(
    chatId: number | bigint,
    photoFileId: string,
    caption?: string,
    replyMarkup?: InlineKeyboardMarkup,
  ): Promise<number | null> {
    const result = await this.call<{ message_id: number }>('sendPhoto', {
      chat_id: Number(chatId),
      photo: photoFileId,
      caption,
      parse_mode: 'Markdown',
      reply_markup: replyMarkup,
    });
    return result?.message_id ?? null;
  }

  async sendDocument(
    chatId: number | bigint,
    documentFileId: string,
    caption?: string,
    replyMarkup?: InlineKeyboardMarkup,
  ): Promise<number | null> {
    const result = await this.call<{ message_id: number }>('sendDocument', {
      chat_id: Number(chatId),
      document: documentFileId,
      caption,
      parse_mode: 'Markdown',
      reply_markup: replyMarkup,
    });
    return result?.message_id ?? null;
  }

  answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
    return this.call('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text,
      show_alert: Boolean(text),
    }).then(() => undefined);
  }

  editMessageReplyMarkup(
    chatId: number | bigint,
    messageId: number,
    replyMarkup: InlineKeyboardMarkup,
  ): Promise<void> {
    return this.call('editMessageReplyMarkup', {
      chat_id: Number(chatId),
      message_id: messageId,
      reply_markup: replyMarkup,
    }).then(() => undefined);
  }

  /** Returns true when the message was edited successfully. */
  async editMessageText(
    chatId: number | bigint,
    messageId: number,
    text: string,
    replyMarkup?: InlineKeyboardMarkup,
    options?: { parseMode?: 'Markdown' | 'HTML' | 'none' },
  ): Promise<boolean> {
    const parseMode = options?.parseMode ?? 'Markdown';
    const result = await this.call<{ message_id: number }>('editMessageText', {
      chat_id: Number(chatId),
      message_id: messageId,
      text,
      ...(parseMode !== 'none' ? { parse_mode: parseMode } : {}),
      reply_markup: replyMarkup,
    });
    return Boolean(result);
  }

  async setMyCommands(
    commands: Array<{ command: string; description: string }>,
    scope?: { type: 'all_private_chats' } | { type: 'chat'; chat_id: number },
  ): Promise<void> {
    await this.call('setMyCommands', {
      commands,
      ...(scope ? { scope } : {}),
    });
  }

  async setChatMenuButton(
    menuButton: { type: 'commands' },
    scope?: { type: 'default' } | { type: 'all_private_chats' } | { type: 'chat'; chat_id: number },
  ): Promise<void> {
    await this.call('setChatMenuButton', {
      menu_button: menuButton,
      ...(scope ? { scope } : {}),
    });
  }
}
