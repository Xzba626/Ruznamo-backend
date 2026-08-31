import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AdminJwtPayload } from '../auth/admin-jwt.payload';

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AdminJwtPayload => {
    const request = ctx.switchToHttp().getRequest<Request & { user: AdminJwtPayload }>();
    return request.user;
  },
);
