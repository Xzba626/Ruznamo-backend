import type { BotScreenId } from './bot-screens';

/** Payload stored in TelegramBotSession for navigation + exclusive wizards. */
export interface NavSessionPayload extends Record<string, unknown> {
  screen?: BotScreenId;
  menuMessageId?: number;
  orderId?: string;
  licenseId?: string;
  deviceId?: string;
  conversationId?: string;
  planCode?: string;
  billingPeriod?: string;
  paymentMethodId?: string;
  articleId?: string;
  parentContext?: BotScreenId | string;
  page?: number;
}

export const NAV_FLOW = 'nav' as const;

export function asNavPayload(raw: Record<string, unknown> | null | undefined): NavSessionPayload {
  return (raw ?? {}) as NavSessionPayload;
}
