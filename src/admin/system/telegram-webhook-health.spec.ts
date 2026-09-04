import { evaluateTelegramWebhookHealth } from './telegram-webhook-health';

describe('evaluateTelegramWebhookHealth', () => {
  const nowMs = Date.parse('2026-09-04T13:44:00.000Z');

  it('treats stale Telegram last_error as historical, not current outage', () => {
    const result = evaluateTelegramWebhookHealth({
      url: 'https://ruznamo-backend-o4xk.vercel.app/api/v1/telegram/webhook',
      lastErrorMessage: 'Wrong response from the webhook: 500 Internal Server Error',
      lastErrorDateUnix: Math.floor(Date.parse('2026-09-03T18:34:56.000Z') / 1000),
      pendingUpdateCount: 0,
      nowMs,
    });

    expect(result.status).toBe('healthy');
    expect(result.lastErrorHistorical).toBe(true);
    expect(result.lastError).toContain('500');
    expect(result.lastErrorAt).toBe('2026-09-03T18:34:56.000Z');
  });

  it('marks recent last_error as current warning', () => {
    const recentUnix = Math.floor((nowMs - 5 * 60 * 1000) / 1000);
    const result = evaluateTelegramWebhookHealth({
      url: 'https://example.com/webhook',
      lastErrorMessage: 'Wrong response from the webhook: 500 Internal Server Error',
      lastErrorDateUnix: recentUnix,
      pendingUpdateCount: 0,
      nowMs,
    });

    expect(result.status).toBe('warning');
    expect(result.lastErrorHistorical).toBe(false);
  });

  it('marks pending updates with last_error as current error', () => {
    const result = evaluateTelegramWebhookHealth({
      url: 'https://example.com/webhook',
      lastErrorMessage: 'Wrong response from the webhook: 500 Internal Server Error',
      lastErrorDateUnix: Math.floor((nowMs - 60 * 60 * 1000) / 1000),
      pendingUpdateCount: 3,
      nowMs,
    });

    expect(result.status).toBe('error');
    expect(result.lastErrorHistorical).toBe(false);
  });
});
