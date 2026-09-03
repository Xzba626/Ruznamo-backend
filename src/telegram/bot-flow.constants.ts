export const BOT_FLOW = {
  SUPPORT: 'support',
  PURCHASE: 'purchase',
  ADMIN_SUPPORT_REPLY: 'admin_support_reply',
  ADMIN_CREATE_LICENSE: 'admin_create_license',
  ADMIN_ORDER_REJECT: 'admin_order_reject',
  DEFERRED_START: 'deferred_start',
  NAV: 'nav',
} as const;

export const PURCHASE_STEP = {
  TARIFF_CARD: 'tariff_card',
  DURATION: 'duration',
  PAYMENT_METHOD: 'payment_method',
  AWAITING_RECEIPT: 'awaiting_receipt',
  PENDING_REENTRY: 'pending_reentry',
  CANCEL_CONFIRM: 'cancel_confirm',
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
