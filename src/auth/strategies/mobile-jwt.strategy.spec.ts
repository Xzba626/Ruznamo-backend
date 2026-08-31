import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MobileJwtStrategy } from './mobile-jwt.strategy';

describe('MobileJwtStrategy', () => {
  const configService = {
    get: jest.fn((key: string, fallback?: string) => {
      if (key === 'jwt.accessSecret') return 'test-secret';
      if (key === 'jwt.accessAudience') return 'ruznamo-mobile';
      return fallback;
    }),
  };

  it('rejects admin audience tokens', () => {
    const strategy = new MobileJwtStrategy(configService as unknown as ConfigService);

    expect(() =>
      strategy.validate({
        sub: 'adm_1',
        deviceId: 'dev_1',
        installationId: 'inst',
        type: 'access',
        aud: 'ruznamo-admin',
      }),
    ).toThrow(UnauthorizedException);
  });

  it('accepts valid mobile tokens', () => {
    const strategy = new MobileJwtStrategy(configService as unknown as ConfigService);
    const payload = strategy.validate({
      sub: 'usr_1',
      deviceId: 'dev_1',
      installationId: 'inst',
      type: 'access',
      aud: 'ruznamo-mobile',
    });

    expect(payload.sub).toBe('usr_1');
  });
});
