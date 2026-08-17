import { NotFoundException } from '@nestjs/common';
import { EmployeeSelfServiceService } from './employee-self-service.service';

describe('EmployeeSelfServiceService notification ownership', () => {
  const prisma = {
    employeeNotification: {
      updateMany: jest.fn(),
    },
  };
  const employeeContext = { resolve: jest.fn() };
  const service = new EmployeeSelfServiceService(
    prisma as never,
    employeeContext as never,
  );
  const user = {
    id: 'user-1',
    organisationId: 'organisation-1',
    email: 'employee@medcnx.local',
    firstName: 'Test',
    lastName: 'Employee',
    status: 'ACTIVE',
    roles: ['EMPLOYEE'],
    permissions: ['notifications:update-own'],
  };

  beforeEach(() => jest.clearAllMocks());

  it('scopes notification updates to the authenticated user and organisation', async () => {
    prisma.employeeNotification.updateMany.mockResolvedValue({ count: 1 });
    await expect(service.markNotificationRead(user, 'notification-1')).resolves.toEqual({ success: true });
    expect(prisma.employeeNotification.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'notification-1',
        organisationId: 'organisation-1',
        userId: 'user-1',
      },
      data: { readAt: expect.any(Date) },
    });
  });

  it('does not reveal notifications owned by another employee', async () => {
    prisma.employeeNotification.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.markNotificationRead(user, 'other-notification')).rejects.toBeInstanceOf(NotFoundException);
  });
});
