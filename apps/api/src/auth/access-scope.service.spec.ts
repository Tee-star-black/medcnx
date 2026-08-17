import { ForbiddenException } from '@nestjs/common';
import { AccessScopeService, EmployeeAccessScope } from './access-scope.service';

describe('AccessScopeService', () => {
  const prisma = {
    employee: {
      findFirst: jest.fn(),
    },
  } as any;

  const service = new AccessScopeService(prisma);

  const baseUser = {
    id: 'user-1',
    organisationId: 'org-1',
    email: 'user@medcnx.local',
    firstName: 'Test',
    lastName: 'User',
    status: 'ACTIVE',
    roles: ['EMPLOYEE'],
    permissions: [],
    sessionId: 'session-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('grants organisation scope to HR administrators', async () => {
    const user = { ...baseUser, roles: ['HR_MANAGER'] };

    expect(service.defaultEmployeeScope(user)).toBe(
      EmployeeAccessScope.ORGANISATION,
    );
    await expect(service.employeeWhere(user)).resolves.toEqual({
      organisationId: 'org-1',
    });
    expect(prisma.employee.findFirst).not.toHaveBeenCalled();
  });

  it('limits managers to themselves and direct reports', async () => {
    prisma.employee.findFirst.mockResolvedValue({
      id: 'employee-manager',
      departmentId: 'department-1',
    });

    const user = { ...baseUser, roles: ['MANAGER'] };

    expect(service.defaultEmployeeScope(user)).toBe(
      EmployeeAccessScope.DIRECT_REPORTS,
    );
    await expect(service.employeeWhere(user)).resolves.toEqual({
      organisationId: 'org-1',
      OR: [{ id: 'employee-manager' }, { managerId: 'employee-manager' }],
    });
  });

  it('limits ordinary employees to their own employee record', async () => {
    prisma.employee.findFirst.mockResolvedValue({
      id: 'employee-1',
      departmentId: 'department-1',
    });

    await expect(service.employeeWhere(baseUser)).resolves.toEqual({
      organisationId: 'org-1',
      id: 'employee-1',
    });
  });

  it('rejects scoped employee access when the account is not linked', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);

    await expect(service.employeeWhere(baseUser)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
