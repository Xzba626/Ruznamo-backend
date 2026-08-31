import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { MobileJwtPayload } from '../mobile-jwt.payload';

@Injectable()
export class MobileJwtStrategy extends PassportStrategy(Strategy, 'mobile-jwt') {
  constructor(configService: ConfigService) {
    const secret = configService.get<string>('jwt.accessSecret');
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      audience: configService.get<string>('jwt.accessAudience', 'ruznamo-mobile'),
    });
  }

  validate(payload: MobileJwtPayload): MobileJwtPayload {
    if (payload.type !== 'access' || payload.aud !== 'ruznamo-mobile') {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN',
        message: 'Invalid mobile access token',
      });
    }

    return payload;
  }
}
