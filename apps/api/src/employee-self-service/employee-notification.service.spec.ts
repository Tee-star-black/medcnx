import { EmployeeNotificationCategory } from '@prisma/client';
import { EmployeeNotificationService } from './employee-notification.service';

describe('EmployeeNotificationService', () => {
  const prisma = {
    employee: { findFirst: jest.fn() },
    employeeNotification: { create: jest.fn() },
  };
  const service = new EmployeeNotificationService(prisma as never);
  const input = {
    organisationId: 'organisation-1',
    employeeId: 'employee-1',
    category: EmployeeNotificationCategory.DOCUMENT,
    title: 'New document available',
    message: 'A document is ready.',
    href: '/employee/documents',
  };

  beforeEach(() => jest.clearAllMocks());

  it('creates a notification only for the employee linked in the same organisation', async () => {
    prisma.employee.findFirst.mockResolvedValue({ userId: 'user-1' });
    prisma.employeeNotification.create.mockResolvedValue({ id: 'notification-1' });

    await expect(service.notifyEmployee(input)).resolves.toEqual({
      id: 'notification-1',
    });
    expect(prisma.employee.findFirst).toHaveBeenCalledWith({
      where: { id: 'employee-1', organisationId: 'organisation-1' },
      select: { userId: true },
    });
    expect(prisma.employeeNotification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organisationId: 'organisation-1',
        userId: 'user-1',
      }),
    });
  });

  it('does not create a notification for an unlinked employee profile', async () => {
    prisma.employee.findFirst.mockResolvedValue({ userId: null });
    await expect(service.notifyEmployee(input)).resolves.toBeNull();
    expect(prisma.employeeNotification.create).not.toHaveBeenCalled();
  });
});
