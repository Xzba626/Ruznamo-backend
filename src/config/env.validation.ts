import * as Joi from 'joi';

const requiredSecret = (name: string, min = 32): Joi.StringSchema =>
  Joi.string()
    .empty('')
    .min(min)
    .required()
    .messages({
      'any.required': `${name} is missing. Add it in Vercel → Settings → Environment Variables.`,
      'string.empty': `${name} is empty. Do NOT copy placeholder values from .env.example — use real secrets.`,
      'string.min': `${name} must be at least ${min} characters.`,
    });

const requiredDatabaseUrl = (name: string): Joi.StringSchema =>
  Joi.string()
    .empty('')
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required()
    .messages({
      'any.required': `${name} is missing. Add Neon connection string in Vercel Environment Variables.`,
      'string.empty': `${name} is empty. Use Neon ${name === 'DATABASE_URL' ? 'pooled' : 'direct'} connection — not an empty placeholder.`,
      'string.uri': `${name} must be a valid postgresql:// connection string.`,
    });

/** process.env values are always strings — coerce safely with defaults. */
const envNumber = (name: string, defaultValue: number): Joi.Schema =>
  Joi.custom((value, helpers) => {
    if (value === undefined || value === null || value === '') {
      return defaultValue;
    }
    const parsed = typeof value === 'number' ? value : Number(String(value).trim());
    if (!Number.isFinite(parsed)) {
      return helpers.message({ custom: `${name} must be a number` });
    }
    return parsed;
  }, `${name} env number`).default(defaultValue);

const envUrl = (name: string, defaultValue: string): Joi.StringSchema =>
  Joi.string()
    .trim()
    .empty('')
    .custom((value, helpers) => {
      if (value === undefined || value === null || value === '') {
        return defaultValue;
      }
      const raw = String(value).trim();
      const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      const { error } = Joi.string().uri().validate(withScheme);
      if (error) {
        return helpers.message({
          custom: `${name} must be a valid URL (include https:// or use host like example.vercel.app).`,
        });
      }
      return withScheme;
    }, `${name} env url`)
    .default(defaultValue);

const optionalUrl = (): Joi.StringSchema =>
  Joi.string()
    .trim()
    .allow('')
    .empty('')
    .custom((value, helpers) => {
      if (value === undefined || value === null || value === '') {
        return undefined;
      }
      const raw = String(value).trim();
      const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      const { error } = Joi.string().uri().validate(withScheme);
      if (error) {
        return helpers.message({ custom: 'ANDROID_UPDATE_URL must be a valid URL' });
      }
      return withScheme;
    }, 'optional env url')
    .optional();

/**
 * Vercel may inject empty strings for unset optional vars.
 * `.empty('')` converts them to undefined so `.default()` applies.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').empty('').default('production'),
  PORT: envNumber('PORT', 3000),
  DATABASE_URL: requiredDatabaseUrl('DATABASE_URL'),
  DIRECT_URL: requiredDatabaseUrl('DIRECT_URL'),
  JWT_SECRET: requiredSecret('JWT_SECRET'),
  JWT_REFRESH_SECRET: requiredSecret('JWT_REFRESH_SECRET'),
  JWT_ACCESS_EXPIRES_IN: Joi.string().empty('').default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().empty('').default('30d'),
  LICENSE_KEY_PEPPER: requiredSecret('LICENSE_KEY_PEPPER'),
  CORS_ORIGINS: Joi.string().empty('').default('*'),
  API_BASE_URL: envUrl('API_BASE_URL', 'http://localhost:3000'),
  APP_BASE_URL: envUrl('APP_BASE_URL', 'http://localhost:3000'),
  TELEGRAM_USER_BOT_TOKEN: Joi.string().allow('').optional(),
  TELEGRAM_ADMIN_BOT_TOKEN: Joi.string().allow('').optional(),
  TELEGRAM_WEBHOOK_SECRET: Joi.string().allow('').optional(),
  ADMIN_TELEGRAM_CHAT_ID: Joi.string().allow('').optional(),
  ANDROID_UPDATE_URL: optionalUrl(),
  LOG_LEVEL: Joi.string()
    .empty('')
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent')
    .default('info'),
  THROTTLE_TTL: envNumber('THROTTLE_TTL', 60000),
  THROTTLE_LIMIT: envNumber('THROTTLE_LIMIT', 100),
});
