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

/**
 * Vercel may inject empty strings for unset optional vars.
 * `.empty('')` converts them to undefined so `.default()` applies.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').empty('').default('production'),
  PORT: Joi.number().empty('').default(3000),
  DATABASE_URL: requiredDatabaseUrl('DATABASE_URL'),
  DIRECT_URL: requiredDatabaseUrl('DIRECT_URL'),
  JWT_SECRET: requiredSecret('JWT_SECRET'),
  JWT_REFRESH_SECRET: requiredSecret('JWT_REFRESH_SECRET'),
  JWT_ACCESS_EXPIRES_IN: Joi.string().empty('').default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().empty('').default('30d'),
  LICENSE_KEY_PEPPER: requiredSecret('LICENSE_KEY_PEPPER'),
  CORS_ORIGINS: Joi.string().empty('').default('*'),
  API_BASE_URL: Joi.string().uri().empty('').default('http://localhost:3000'),
  APP_BASE_URL: Joi.string().uri().empty('').default('http://localhost:3000'),
  TELEGRAM_USER_BOT_TOKEN: Joi.string().allow('').optional(),
  TELEGRAM_ADMIN_BOT_TOKEN: Joi.string().allow('').optional(),
  TELEGRAM_WEBHOOK_SECRET: Joi.string().allow('').optional(),
  ADMIN_TELEGRAM_CHAT_ID: Joi.string().allow('').optional(),
  ANDROID_UPDATE_URL: Joi.string().uri().allow('').optional(),
  LOG_LEVEL: Joi.string()
    .empty('')
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent')
    .default('info'),
  THROTTLE_TTL: Joi.number().empty('').default(60000),
  THROTTLE_LIMIT: Joi.number().empty('').default(100),
});
