import { BadRequestException, ForbiddenException } from '@nestjs/common';

import type { CurrentUser } from '../auth/types/current-user.type';
import { AccessControlService } from './access-control.service';

describe('AccessControlService', () => {
  const prisma = {
    user: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    role: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    permission: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const actor: CurrentUser = {
    id: 'admin-user',
    organisationId: 'organisation-1',
    email: 'admin@medcnx.local',
    firstName: 'MedCNX',
    lastName: 'Admin',
    status: 'ACTIVE',
    roles: ['ORG_ADMIN'],
    permissions: ['users:read', 'users:update', 'users:disable'],
  };

  let service: AccessControlService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AccessControlService(prisma as never);
  });

  it('scopes the access overview to the current organisation', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    prisma.role.findMany.mockResolvedValue([]);
    prisma.permission.findMany.mockResolvedValue([]);

    await expect(service.getOverview(actor)).resolves.toEqual({
      users: [],
      roles: [],
      permissions: [],
    });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organisationId: actor.organisationId },
      }),
    );
    expect(prisma.role.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organisationId: actor.organisationId },
      }),
    );
  });

  it('rejects role assignments containing a role from another organisation', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'employee-user',
      email: 'employee@medcnx.local',
      userRoles: [],
    });
    prisma.role.findMany.mockResolvedValue([
      { id: 'role-1', name: 'EMPLOYEE' },
    ]);

    await expect(
      service.updateUserRoles(actor, 'employee-user', {
        roleIds: ['role-1', 'foreign-role'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not allow an administrator to suspend their own account', async () => {
    await expect(
      service.updateUserStatus(actor, actor.id, { status: 'SUSPENDED' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it('protects system role permission templates from editing', async () => {
    prisma.role.findFirst.mockResolvedValue({
      id: 'org-admin-role',
      name: 'ORG_ADMIN',
      isSystem: true,
      rolePermissions: [],
    });

    await expect(
      service.updateRolePermissions(actor, 'org-admin-role', {
        permissionIds: ['permission-1'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.permission.findMany).not.toHaveBeenCalled();
  });
});
