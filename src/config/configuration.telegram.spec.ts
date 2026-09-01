import { telegramConfig } from './configuration';

describe('telegramConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('disables bot in production when token is set without webhook secret', () => {
    process.env.NODE_ENV = 'production';
    process.env.TELEGRAM_BOT_TOKEN = '123456:ABC-DEF';
    process.env.TELEGRAM_WEBHOOK_SECRET = '';

    const config = telegramConfig();
    expect(config.misconfigured).toBe(true);
    expect(config.enabled).toBe(false);
    expect(config.botToken).toBe('');
    expect(config.webhookSecret).toBe('');
  });

  it('enables bot in production when token and webhook secret are set', () => {
    process.env.NODE_ENV = 'production';
    process.env.TELEGRAM_BOT_TOKEN = '123456:ABC-DEF';
    process.env.TELEGRAM_WEBHOOK_SECRET = 'a'.repeat(16);

    const config = telegramConfig();
    expect(config.misconfigured).toBe(false);
    expect(config.enabled).toBe(true);
    expect(config.botToken).toBe('123456:ABC-DEF');
  });

  it('allows token without webhook secret in development', () => {
    process.env.NODE_ENV = 'development';
    process.env.TELEGRAM_BOT_TOKEN = '123456:ABC-DEF';
    process.env.TELEGRAM_WEBHOOK_SECRET = '';

    const config = telegramConfig();
    expect(config.misconfigured).toBe(false);
    expect(config.enabled).toBe(true);
    expect(config.botToken).toBe('123456:ABC-DEF');
  });
});
