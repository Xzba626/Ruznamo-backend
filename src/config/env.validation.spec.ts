import { envValidationSchema } from './env.validation';

describe('envValidationSchema', () => {
  const validEnv = {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/ruznamo?sslmode=require',
    DIRECT_URL: 'postgresql://user:pass@localhost:5432/ruznamo?sslmode=require',
    JWT_SECRET: 'test-jwt-secret-minimum-32-characters-long',
    JWT_REFRESH_SECRET: 'test-refresh-secret-minimum-32-chars',
    LICENSE_KEY_PEPPER: 'test-license-pepper-minimum-32-chars',
  };

  const nestValidationOptions = {
    abortEarly: false,
    convert: true,
    allowUnknown: true,
  };

  it('accepts valid environment', () => {
    const { error } = envValidationSchema.validate(validEnv, nestValidationOptions);
    expect(error).toBeUndefined();
  });

  it('ignores PORT and THROTTLE_* (parsed separately in configuration.ts)', () => {
    const { error } = envValidationSchema.validate(
      {
        ...validEnv,
        PORT: '',
        THROTTLE_TTL: 'not-a-number',
        THROTTLE_LIMIT: '',
      },
      nestValidationOptions,
    );
    expect(error).toBeUndefined();
  });

  it('rejects missing DATABASE_URL', () => {
    const { error } = envValidationSchema.validate(
      {
        ...validEnv,
        DATABASE_URL: undefined,
      },
      nestValidationOptions,
    );
    expect(error).toBeDefined();
  });

  it('rejects missing DIRECT_URL', () => {
    const { error } = envValidationSchema.validate(
      {
        ...validEnv,
        DIRECT_URL: undefined,
      },
      nestValidationOptions,
    );
    expect(error).toBeDefined();
  });

  it('rejects short JWT_SECRET', () => {
    const { error } = envValidationSchema.validate(
      {
        ...validEnv,
        JWT_SECRET: 'short',
      },
      nestValidationOptions,
    );
    expect(error).toBeDefined();
  });

  it('rejects empty DATABASE_URL (Vercel placeholder mistake)', () => {
    const { error } = envValidationSchema.validate(
      {
        ...validEnv,
        DATABASE_URL: '',
      },
      nestValidationOptions,
    );
    expect(error).toBeDefined();
    expect(error?.message).toContain('DATABASE_URL');
  });

  it('coerces API_BASE_URL without https scheme', () => {
    const { error, value } = envValidationSchema.validate(
      {
        ...validEnv,
        API_BASE_URL: 'ruznamo-backend-o4xk.vercel.app',
        APP_BASE_URL: 'ruznamo-backend-o4xk.vercel.app',
      },
      nestValidationOptions,
    );
    expect(error).toBeUndefined();
    expect(value.API_BASE_URL).toBe('https://ruznamo-backend-o4xk.vercel.app');
    expect(value.APP_BASE_URL).toBe('https://ruznamo-backend-o4xk.vercel.app');
  });

  it('allows production boot when TELEGRAM_BOT_TOKEN is set without webhook secret', () => {
    const { error } = envValidationSchema.validate(
      {
        ...validEnv,
        NODE_ENV: 'production',
        TELEGRAM_BOT_TOKEN: '123456:ABC-DEF',
        TELEGRAM_WEBHOOK_SECRET: '',
      },
      nestValidationOptions,
    );
    expect(error).toBeUndefined();
  });

  it('rejects TELEGRAM_WEBHOOK_SECRET shorter than 16 characters when set', () => {
    const { error } = envValidationSchema.validate(
      {
        ...validEnv,
        TELEGRAM_WEBHOOK_SECRET: 'short',
      },
      nestValidationOptions,
    );
    expect(error).toBeDefined();
    expect(error?.message).toContain('TELEGRAM_WEBHOOK_SECRET');
  });
});
