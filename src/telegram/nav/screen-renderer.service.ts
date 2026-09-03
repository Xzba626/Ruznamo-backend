import { Injectable } from '@nestjs/common';
import { TelegramBotApiService } from '../telegram-bot-api.service';
import { TelegramBotSessionService } from '../telegram-bot-session.service';
import type { InlineKeyboardMarkup } from '../telegram.types';
import { BotScreen, type BotScreenId } from './bot-screens';
import { NAV_FLOW, asNavPayload, type NavSessionPayload } from './nav-context';

export interface RenderMenuOptions {
  telegramUserId: bigint;
  chatId: bigint;
  screen: BotScreenId;
  text: string;
  keyboard?: InlineKeyboardMarkup;
  /** Prefer editing this message; otherwise use session menuMessageId; else send new. */
  messageId?: number;
  /** Extra payload fields to merge into session */
  payload?: NavSessionPayload;
  parseMode?: 'Markdown' | 'HTML' | 'none';
}

@Injectable()
export class ScreenRendererService {
  constructor(
    private readonly botApi: TelegramBotApiService,
    private readonly sessionService: TelegramBotSessionService,
  ) {}

  async answerCallback(callbackQueryId: string | undefined, text?: string): Promise<void> {
    if (!callbackQueryId) return;
    await this.botApi.answerCallbackQuery(callbackQueryId, text);
  }

  async renderMenu(opts: RenderMenuOptions): Promise<number | null> {
    const existing = await this.sessionService.getSession(opts.telegramUserId);
    const prev = asNavPayload(existing?.payload);
    const targetMessageId = opts.messageId ?? prev.menuMessageId;

    let messageId: number | null = null;
    if (targetMessageId != null) {
      const edited = await this.botApi.editMessageText(
        opts.chatId,
        targetMessageId,
        opts.text,
        opts.keyboard,
        { parseMode: opts.parseMode ?? 'Markdown' },
      );
      if (edited) {
        messageId = targetMessageId;
      }
    }

    if (messageId == null) {
      await this.botApi.removeReplyKeyboard(opts.chatId);
      messageId = await this.botApi.sendMessage(opts.chatId, opts.text, opts.keyboard, {
        parseMode: opts.parseMode ?? 'Markdown',
      });
    }

    const nextPayload: NavSessionPayload = {
      ...prev,
      ...opts.payload,
      screen: opts.screen,
      menuMessageId: messageId ?? undefined,
    };

    // Preserve exclusive input flows when rendering over nav; otherwise store nav flow.
    const keepFlow =
      existing?.flow === 'support' ||
      existing?.flow === 'purchase' ||
      existing?.flow === 'admin_support_reply' ||
      existing?.flow === 'admin_create_license' ||
      existing?.flow === 'admin_payment_method' ||
      existing?.flow === 'deferred_start';

    if (keepFlow && existing) {
      await this.sessionService.set(
        opts.telegramUserId,
        existing.flow,
        existing.step,
        { ...asNavPayload(existing.payload), ...nextPayload },
      );
    } else {
      await this.sessionService.set(
        opts.telegramUserId,
        NAV_FLOW,
        opts.screen,
        nextPayload,
      );
    }

    return messageId;
  }

  async getScreen(telegramUserId: bigint): Promise<BotScreenId | null> {
    const session = await this.sessionService.getSession(telegramUserId);
    const screen = asNavPayload(session?.payload).screen;
    return screen ?? null;
  }

  async getPayload(telegramUserId: bigint): Promise<NavSessionPayload> {
    const session = await this.sessionService.getSession(telegramUserId);
    return asNavPayload(session?.payload);
  }

  roleRoot(isAdmin: boolean): BotScreenId {
    return isAdmin ? BotScreen.ADMIN_ROOT : BotScreen.USER_ROOT;
  }
}
