import { getActiveLocale, type AdminLocale } from './locale-state';

const roleLabels: Record<AdminLocale, Record<string, string>> = {
  ru: {
    SUPER_ADMIN: 'Суперадминистратор',
    ADMIN: 'Администратор',
    SUPPORT: 'Поддержка',
  },
  tj: {
    SUPER_ADMIN: 'Супермудир',
    ADMIN: 'Мудир',
    SUPPORT: 'Дастгирӣ',
  },
};

export function labelRole(code: string): string {
  const locale = getActiveLocale();
  return roleLabels[locale][code] ?? roleLabels.ru[code] ?? code;
}

export function formatDateTime(value: string | Date): string {
  const locale = getActiveLocale() === 'tj' ? 'tg-TJ' : 'ru-RU';
  try {
    return new Date(value).toLocaleString(locale);
  } catch {
    return new Date(value).toLocaleString('ru-RU');
  }
}

export function formatDate(value: string | Date): string {
  const locale = getActiveLocale() === 'tj' ? 'tg-TJ' : 'ru-RU';
  try {
    return new Date(value).toLocaleDateString(locale);
  } catch {
    return new Date(value).toLocaleDateString('ru-RU');
  }
}

export function formatMoney(amount: string | number, currency: string): string {
  return `${amount} ${currency}`;
}

export function formatTelegramUser(
  telegram: { username?: string | null; firstName?: string | null; telegramId?: string } | null | undefined,
): string {
  if (!telegram) return '—';
  if (telegram.username) return `@${telegram.username}`;
  if (telegram.firstName) return telegram.firstName;
  if (telegram.telegramId) return telegram.telegramId;
  return '—';
}
