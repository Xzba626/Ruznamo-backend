import { normalizeTelegramBotUsername } from '../telegram/telegram-bot-username.util';

export { normalizeTelegramBotUsername };

export function readTelegramBotToken(): string {
  const primary = (process.env.TELEGRAM_BOT_TOKEN ?? '').trim();
  if (primary) {
    return primary;
  }

  const legacyUser = (process.env.TELEGRAM_USER_BOT_TOKEN ?? '').trim();
  if (legacyUser) {
    console.warn(
      '[telegram] Using deprecated TELEGRAM_USER_BOT_TOKEN. Migrate to TELEGRAM_BOT_TOKEN on Vercel.',
    );
    return legacyUser;
  }

  const legacyAdmin = (process.env.TELEGRAM_ADMIN_BOT_TOKEN ?? '').trim();
  if (legacyAdmin) {
    console.warn(
      '[telegram] Using deprecated TELEGRAM_ADMIN_BOT_TOKEN. Migrate to TELEGRAM_BOT_TOKEN on Vercel.',
    );
    return legacyAdmin;
  }

  return '';
}

export function readTelegramBotUsername(): string {
  return normalizeTelegramBotUsername(process.env.TELEGRAM_BOT_USERNAME) ?? '';
}

export function readAdminTelegramIds(): string[] {
  const raw = (process.env.ADMIN_TELEGRAM_IDS ?? process.env.ADMIN_TELEGRAM_CHAT_ID ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => /^\d+$/.test(id));

  if (
    raw.length === 0 &&
    (process.env.ADMIN_TELEGRAM_CHAT_ID ?? '').trim() &&
    !(process.env.ADMIN_TELEGRAM_IDS ?? '').trim()
  ) {
    console.warn(
      '[telegram] Using deprecated ADMIN_TELEGRAM_CHAT_ID. Migrate to ADMIN_TELEGRAM_IDS (comma-separated).',
    );
  }

  return raw;
}

export function maskSecret(value: string | undefined): {
  present: boolean;
  length: number;
  preview: string | null;
} {
  const trimmed = (value ?? '').trim();
  if (!trimmed) {
    return { present: false, length: 0, preview: null };
  }
  if (trimmed.length <= 8) {
    return { present: true, length: trimmed.length, preview: '***' };
  }
  return {
    present: true,
    length: trimmed.length,
    preview: `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`,
  };
}
