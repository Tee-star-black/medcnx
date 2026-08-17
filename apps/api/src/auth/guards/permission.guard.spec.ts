import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PermissionsGuard } from './permissions.guard';

describe('PermissionsGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  const guard = new PermissionsGuard(reflector);

  function context(permissions?: string[]) {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () =>
          permissions
            ? {
                user: {
                  permissions,
                },
              }
            : {},
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows the exact required payroll permission', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      'payroll:calculate',
    ]);

    expect(
      guard.canActivate(context(['payroll:calculate'])),
    ).toBe(true);
  });

  it('does not accept employee permissions as payroll permissions', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      'payroll:calculate',
    ]);

    expect(() =>
      guard.canActivate(context(['employees:update'])),
    ).toThrow(ForbiddenException);
  });

  it('keeps payroll permissions separated', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      'payroll:approve',
    ]);

    expect(() =>
      guard.canActivate(context(['payroll:calculate'])),
    ).toThrow(ForbiddenException);
  });
});
