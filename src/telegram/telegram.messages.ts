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
  ACTION_LANGUAGE: 'action:language',
  ACTION_RETRY: 'action:retry',
  ACTION_MY_KEY: 'action:my_key',
  ACTION_MY_SUB: 'action:my_sub',
  ACTION_HELP: 'action:help',
  ACTION_GET_KEY: 'action:get_key',
  approve: (orderId: string) => `payment:approve:${orderId}`,
  reject: (orderId: string) => `payment:reject:${orderId}`,
} as const;

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

export function formatAmount(amount: string, currency: string, lang: 'TJ' | 'RU'): string {
  if (currency === 'TJS') {
    return lang === 'RU' ? `${amount} сомони` : `${amount} сомонӣ`;
  }
  return `${amount} ${currency}`;
}
