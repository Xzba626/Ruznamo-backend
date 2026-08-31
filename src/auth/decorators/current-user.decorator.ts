import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { MobileJwtPayload } from '../mobile-jwt.payload';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): MobileJwtPayload => {
    const request = ctx.switchToHttp().getRequest<{ user: MobileJwtPayload }>();
    return request.user;
  },
);
