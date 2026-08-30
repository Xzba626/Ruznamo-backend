import { envValidationSchema } from './env.validation';

describe('envValidationSchema', () => {
  const validEnv = {
    NODE_ENV: 'test',
    PORT: 3000,
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/ruznamo?sslmode=require',
    DIRECT_URL: 'postgresql://user:pass@localhost:5432/ruznamo?sslmode=require',
    JWT_SECRET: 'test-jwt-secret-minimum-32-characters-long',
    JWT_REFRESH_SECRET: 'test-refresh-secret-minimum-32-chars',
    LICENSE_KEY_PEPPER: 'test-license-pepper-minimum-32-chars',
  };

  it('accepts valid environment', () => {
    const { error } = envValidationSchema.validate(validEnv);
    expect(error).toBeUndefined();
  });

  it('rejects missing DATABASE_URL', () => {
    const { error } = envValidationSchema.validate({
      ...validEnv,
      DATABASE_URL: undefined,
    });
    expect(error).toBeDefined();
  });

  it('rejects missing DIRECT_URL', () => {
    const { error } = envValidationSchema.validate({
      ...validEnv,
      DIRECT_URL: undefined,
    });
    expect(error).toBeDefined();
  });

  it('rejects short JWT_SECRET', () => {
    const { error } = envValidationSchema.validate({
      ...validEnv,
      JWT_SECRET: 'short',
    });
    expect(error).toBeDefined();
  });

  it('rejects empty DATABASE_URL (Vercel placeholder mistake)', () => {
    const { error } = envValidationSchema.validate({
      ...validEnv,
      DATABASE_URL: '',
    });
    expect(error).toBeDefined();
    expect(error?.message).toContain('DATABASE_URL');
  });

  it('defaults PORT when empty string (Vercel serverless)', () => {
    const { error, value } = envValidationSchema.validate({
      ...validEnv,
      PORT: '',
    });
    expect(error).toBeUndefined();
    expect(value.PORT).toBe(3000);
  });

  it('coerces numeric env vars from strings (process.env)', () => {
    const { error, value } = envValidationSchema.validate({
      ...validEnv,
      PORT: '3000',
      THROTTLE_TTL: '60000',
      THROTTLE_LIMIT: '100',
    });
    expect(error).toBeUndefined();
    expect(value.PORT).toBe(3000);
    expect(value.THROTTLE_TTL).toBe(60000);
    expect(value.THROTTLE_LIMIT).toBe(100);
  });

  it('coerces API_BASE_URL without https scheme', () => {
    const { error, value } = envValidationSchema.validate({
      ...validEnv,
      API_BASE_URL: 'ruznamo-backend-o4xk.vercel.app',
      APP_BASE_URL: 'ruznamo-backend-o4xk.vercel.app',
    });
    expect(error).toBeUndefined();
    expect(value.API_BASE_URL).toBe('https://ruznamo-backend-o4xk.vercel.app');
    expect(value.APP_BASE_URL).toBe('https://ruznamo-backend-o4xk.vercel.app');
  });
});
