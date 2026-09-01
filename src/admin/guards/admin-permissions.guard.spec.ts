import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminPermissionsGuard } from './admin-permissions.guard';

describe('AdminPermissionsGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  };

  const guard = new AdminPermissionsGuard(reflector as unknown as Reflector);

  function contextWithAdmin(permissions: string[] | null) {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user: permissions ? { sub: 'adm_1', permissions } : undefined,
        }),
      }),
    } as ExecutionContext;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows when no permissions required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(contextWithAdmin([]))).toBe(true);
  });

  it('rejects unauthenticated admin', () => {
    reflector.getAllAndOverride.mockReturnValue(['orders:approve']);
    expect(() => guard.canActivate(contextWithAdmin(null))).toThrow(ForbiddenException);
  });

  it('rejects insufficient permissions', () => {
    reflector.getAllAndOverride.mockReturnValue(['orders:approve']);
    expect(() => guard.canActivate(contextWithAdmin(['orders:read']))).toThrow(ForbiddenException);
  });

  it('allows when all permissions present', () => {
    reflector.getAllAndOverride.mockReturnValue(['orders:read', 'orders:approve']);
    expect(guard.canActivate(contextWithAdmin(['orders:read', 'orders:approve', 'audit:read']))).toBe(true);
  });
});
