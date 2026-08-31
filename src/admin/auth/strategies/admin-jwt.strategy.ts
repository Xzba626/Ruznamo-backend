import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AdminJwtPayload } from '../admin-jwt.payload';

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(configService: ConfigService) {
    const secret = configService.get<string>('jwt.accessSecret');
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      audience: configService.get<string>('jwt.adminAudience', 'ruznamo-admin'),
    });
  }

  validate(payload: AdminJwtPayload): AdminJwtPayload {
    if (payload.type !== 'access' || payload.aud !== 'ruznamo-admin') {
      throw new UnauthorizedException('Invalid admin token');
    }

    return payload;
  }
}
