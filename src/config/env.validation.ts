import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  DATABASE_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('30d'),
  LICENSE_KEY_PEPPER: Joi.string().min(32).required(),
  CORS_ORIGINS: Joi.string().default('http://localhost:3000'),
  API_BASE_URL: Joi.string().uri().default('http://localhost:3000'),
  APP_BASE_URL: Joi.string().uri().default('http://localhost:3000'),
  TELEGRAM_USER_BOT_TOKEN: Joi.string().allow('').optional(),
  TELEGRAM_ADMIN_BOT_TOKEN: Joi.string().allow('').optional(),
  ADMIN_TELEGRAM_IDS: Joi.string().allow('').optional(),
  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent')
    .default('info'),
  THROTTLE_TTL: Joi.number().default(60000),
  THROTTLE_LIMIT: Joi.number().default(100),
});
