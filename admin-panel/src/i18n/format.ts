const roleLabels: Record<string, string> = {
  SUPER_ADMIN: 'Суперадминистратор',
  ADMIN: 'Администратор',
  SUPPORT: 'Поддержка',
};

export function labelRole(code: string): string {
  return roleLabels[code] ?? code;
}

export function formatDateTime(value: string | Date): string {
  return new Date(value).toLocaleString('ru-RU');
}

export function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString('ru-RU');
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
