import { registerAs } from '@nestjs/config';

const parseEnvInt = (value: string | undefined, fallback: number): number => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return fallback;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseEnvInt(process.env.PORT, 3000),
  apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:3000',
  appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:3000',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  isProduction: process.env.NODE_ENV === 'production',
}));

export const jwtConfig = registerAs('jwt', () => ({
  accessSecret: process.env.JWT_SECRET,
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
  accessAudience: 'ruznamo-mobile',
  adminAudience: 'ruznamo-admin',
}));

export const securityConfig = registerAs('security', () => ({
  licenseKeyPepper: process.env.LICENSE_KEY_PEPPER,
  throttleTtl: parseEnvInt(process.env.THROTTLE_TTL, 60000),
  throttleLimit: parseEnvInt(process.env.THROTTLE_LIMIT, 100),
}));

export const telegramConfig = registerAs('telegram', () => ({
  userBotToken: process.env.TELEGRAM_USER_BOT_TOKEN ?? '',
  adminBotToken: process.env.TELEGRAM_ADMIN_BOT_TOKEN ?? '',
  adminTelegramIds: (process.env.ADMIN_TELEGRAM_CHAT_ID ?? process.env.ADMIN_TELEGRAM_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean),
}));
