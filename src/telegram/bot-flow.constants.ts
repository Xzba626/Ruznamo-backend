export const BOT_FLOW = {
  SUPPORT: 'support',
  PURCHASE: 'purchase',
  ADMIN_SUPPORT_REPLY: 'admin_support_reply',
  ADMIN_CREATE_LICENSE: 'admin_create_license',
  DEFERRED_START: 'deferred_start',
} as const;

export const SUPPORT_CATEGORY = {
  TECHNICAL: 'technical',
  LICENSE: 'license',
  PAYMENT: 'payment',
  DEVICE: 'device',
  OTHER: 'other',
} as const;

export type SupportCategoryCode = (typeof SUPPORT_CATEGORY)[keyof typeof SUPPORT_CATEGORY];

export interface SupportSessionPayload extends Record<string, unknown> {
  conversationId?: string;
}

export interface AdminSupportReplyPayload extends Record<string, unknown> {
  conversationId: string;
  targetTelegramAccountId: string;
  targetChatId: string;
  targetTelegramUserId: string;
}

export interface AdminCreateLicensePayload extends Record<string, unknown> {
  planCode?: string;
  billingPeriod?: string;
}
