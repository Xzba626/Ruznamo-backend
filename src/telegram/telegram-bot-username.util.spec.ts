import { normalizeTelegramBotUsername } from './telegram-bot-username.util';

describe('normalizeTelegramBotUsername', () => {
  it('strips leading @', () => {
    expect(normalizeTelegramBotUsername('@Ruznamo_bot')).toBe('Ruznamo_bot');
  });

  it('extracts username from t.me URL', () => {
    expect(normalizeTelegramBotUsername('https://t.me/Ruznamo_bot')).toBe('Ruznamo_bot');
  });

  it('extracts username from bare t.me path', () => {
    expect(normalizeTelegramBotUsername('t.me/Ruznamo_bot')).toBe('Ruznamo_bot');
  });

  it('returns null for empty input', () => {
    expect(normalizeTelegramBotUsername('')).toBeNull();
    expect(normalizeTelegramBotUsername(undefined)).toBeNull();
  });
});
