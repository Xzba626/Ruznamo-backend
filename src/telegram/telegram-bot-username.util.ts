/**
 * Normalize TELEGRAM_BOT_USERNAME for deep links and public API.
 * Accepts: Ruznamo_bot, @Ruznamo_bot, https://t.me/Ruznamo_bot, t.me/Ruznamo_bot
 */
export function normalizeTelegramBotUsername(raw: string | undefined): string | null {
  let value = (raw ?? '').trim();
  if (!value) {
    return null;
  }

  value = value.replace(/^@+/, '');

  const tmeMatch = value.match(/(?:https?:\/\/)?(?:www\.)?t\.me\/([A-Za-z0-9_]+)/i);
  if (tmeMatch?.[1]) {
    value = tmeMatch[1];
  }

  const telegramMatch = value.match(/(?:https?:\/\/)?(?:www\.)?telegram\.me\/([A-Za-z0-9_]+)/i);
  if (telegramMatch?.[1]) {
    value = telegramMatch[1];
  }

  return value.length > 0 ? value : null;
}
