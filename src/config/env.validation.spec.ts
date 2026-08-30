import { envValidationSchema } from './env.validation';

describe('envValidationSchema', () => {
  const validEnv = {
    NODE_ENV: 'test',
    PORT: 3000,
    DATABASE_URL: 'postgresql://ruznamo:ruznamo@localhost:5432/ruznamo?schema=public',
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

  it('rejects short JWT_SECRET', () => {
    const { error } = envValidationSchema.validate({
      ...validEnv,
      JWT_SECRET: 'short',
    });
    expect(error).toBeDefined();
  });
});
