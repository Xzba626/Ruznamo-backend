import { PlanCode } from '@prisma/client';
import { parsePlanCode } from '../payments/plan-code.util';

/** Admin pairing messages stay Russian (admin panel language). */
export const TG_ADMIN = {
  adminConnected: 'Telegram успешно подключён к админ-панели Ruznamo.',
  adminConnectExpired: 'Код подключения истёк. Создайте новый код в админ-панели.',
  adminConnectUnauthorized: 'Код подключения недействителен или уже использован.',
  adminWelcome: 'Салом! Шумо ҳамчун маъмур шинохта шудед.',
} as const;

export const CB = {
  LANG_TJ: 'lang:tj',
  LANG_RU: 'lang:ru',
  PLAN_STANDARD: 'plan:STANDARD',
  PLAN_PRO: 'plan:PRO',
  STANDARD_BUY_CONFIRM: 'plan:STANDARD:confirm',
  plan: (planCode: string) => `plan:${planCode}`,
  ACTION_LANGUAGE: 'action:language',
  ACTION_RETRY: 'action:retry',
  ACTION_MY_KEY: 'action:my_key',
  ACTION_MY_SUB: 'action:my_sub',
  ACTION_HELP: 'action:help',
  ACTION_GET_KEY: 'action:get_key',
  ACTION_MAIN_MENU: 'action:main_menu',
  ACTION_INSTRUCTION: 'action:instruction',
  ACTION_SUPPORT: 'action:support',
  ACTION_SUPPORT_EXIT: 'action:support_exit',
  ACTION_SUPPORT_CLOSE_CONFIRM: 'action:support_close_confirm',
  ACTION_SUPPORT_CLOSE_CANCEL: 'action:support_close_cancel',
  supportCategory: (category: string) => `support:cat:${category}`,
  ACTION_RECOVER: 'action:recover',
  ACTION_ADMIN_MENU: 'action:admin_menu',
  ACTION_BACK_PLAN: 'action:back_plan',
  ACTION_BACK_DURATION: 'action:back_duration',
  ACTION_NAV_BACK: 'action:nav_back',
  ACTION_CANCEL_PAYMENT: 'action:cancel_payment',
  ACTION_CANCEL_PAYMENT_YES: 'action:cancel_payment_yes',
  ACTION_CANCEL_PAYMENT_NO: 'action:cancel_payment_no',
  ACTION_CONTINUE_PENDING: 'action:continue_pending',
  ACTION_NEW_PURCHASE: 'action:new_purchase',
  ACTION_SEND_RECEIPT: 'action:send_receipt',
  approve: (orderId: string) => `payment:approve:${orderId}`,
  reject: (orderId: string) => `payment:reject:${orderId}`,
  duration: (planCode: string, billingPeriod: string) => `duration:${planCode}:${billingPeriod}`,
  paymentMethod: (methodId: string) => `paymethod:${methodId}`,
  linkConfirm: (token: string) => `link:confirm:${token}`,
  linkCancel: (token: string) => `link:cancel:${token}`,
  replConfirm: (token: string) => `repl:confirm:${token}`,
  replCancel: (token: string) => `repl:cancel:${token}`,
  licenseDetail: (licenseId: string) => `lic:detail:${licenseId}`,
  licenseDevices: (licenseId: string) => `licdev:${licenseId}`,
  deviceDetail: (licenseId: string, deviceId: string) => `licdevitem:${licenseId}:${deviceId}`,
  revokeDeviceConfirm: (licenseId: string, deviceId: string) =>
    `licrev:confirm:${licenseId}:${deviceId}`,
  revokeDeviceDo: (licenseId: string, deviceId: string) => `licrev:do:${licenseId}:${deviceId}`,
  /** @deprecated prefer revokeDeviceConfirm */
  revokeDevice: (licenseId: string, deviceId: string) => `licrev:confirm:${licenseId}:${deviceId}`,
  instruct: (articleId: string) => `instruct:${articleId}`,
} as const;

export function parsePlanCallback(data: string): PlanCode | null {
  if (!data.startsWith('plan:')) {
    return null;
  }
  const planCode = parsePlanCode(data.slice('plan:'.length));
  return planCode;
}

export function parseDurationCallback(
  data: string,
): { planCode: PlanCode; billingPeriod: 'MONTHLY' | 'YEARLY' } | null {
  if (!data.startsWith('duration:')) {
    return null;
  }
  const [, planCodeRaw, billingPeriod] = data.split(':');
  const planCode = parsePlanCode(planCodeRaw ?? '');
  if (
    !planCode ||
    (billingPeriod !== 'MONTHLY' && billingPeriod !== 'YEARLY')
  ) {
    return null;
  }
  return { planCode, billingPeriod };
}

export function parsePaymentMethodCallback(data: string): { methodId: string } | null {
  if (!data.startsWith('paymethod:')) {
    return null;
  }
  const methodId = data.slice('paymethod:'.length).trim();
  return methodId ? { methodId } : null;
}

export function parsePaymentCallback(
  data: string,
): { action: 'approve' | 'reject'; orderId: string } | null {
  const prefixes = [
    { action: 'approve' as const, prefix: 'payment:approve:' },
    { action: 'reject' as const, prefix: 'payment:reject:' },
    { action: 'approve' as const, prefix: 'approve:' },
    { action: 'reject' as const, prefix: 'reject:' },
  ];

  for (const { action, prefix } of prefixes) {
    if (data.startsWith(prefix)) {
      const orderId = data.slice(prefix.length).trim();
      if (orderId) {
        return { action, orderId };
      }
    }
  }

  return null;
}

export function formatDateLocalized(date: Date, lang: 'TJ' | 'RU'): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

/** @deprecated Use formatDateLocalized(date, 'TJ') */
export const formatDateTj = (date: Date): string => formatDateLocalized(date, 'TJ');

export function parseBotCommand(text: string): { command: string; args: string } | null {
  const match = text.trim().match(/^\/([a-z_]+)(?:@\w+)?(?:\s+(.*))?$/i);
  if (!match) {
    return null;
  }
  return { command: match[1].toLowerCase(), args: (match[2] ?? '').trim() };
}

export function formatAmount(amount: string, currency: string, lang: 'TJ' | 'RU'): string {
  if (currency === 'TJS') {
    return lang === 'RU' ? `${amount} сомони` : `${amount} сомонӣ`;
  }
  return `${amount} ${currency}`;
}
