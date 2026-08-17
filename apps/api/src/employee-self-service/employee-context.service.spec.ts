import { NotFoundException } from '@nestjs/common';
import { EmployeeContextService } from './employee-context.service';

describe('EmployeeContextService', () => {
  const prisma = {
    employee: { findFirst: jest.fn() },
  };
  const service = new EmployeeContextService(prisma as never);
  const user = {
    id: 'user-1',
    organisationId: 'organisation-1',
    email: 'employee@medcnx.local',
    firstName: 'Test',
    lastName: 'Employee',
    status: 'ACTIVE',
    roles: ['EMPLOYEE'],
    permissions: ['profile:view-own'],
  };

  beforeEach(() => jest.clearAllMocks());

  it('resolves an employee using both authenticated user and organisation', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'employee-1' });

    await expect(service.resolve(user)).resolves.toEqual({ id: 'employee-1' });
    expect(prisma.employee.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', organisationId: 'organisation-1' },
      }),
    );
  });

  it('rejects an unlinked authenticated user with a clear error', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);
    await expect(service.resolve(user)).rejects.toBeInstanceOf(NotFoundException);
  });
});
