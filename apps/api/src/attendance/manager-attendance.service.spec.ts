import { NotFoundException } from '@nestjs/common';
import type { CurrentUser } from '../auth/types/current-user.type';
import { ManagerAttendanceService } from './manager-attendance.service';

describe('ManagerAttendanceService', () => {
  const user = {
    id: 'user-manager',
    organisationId: 'org-1',
    email: 'manager@example.com',
    firstName: 'Mara',
    lastName: 'Manager',
    roles: ['HR_MANAGER'],
    permissions: [],
  } as CurrentUser;

  const prisma = {
    employee: {
      findFirst: jest.fn(),
    },
  };

  const attendanceService = {
    findAll: jest.fn(),
  };

  let service: ManagerAttendanceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ManagerAttendanceService(prisma as any, attendanceService as any);
  });

  it('returns only attendance exceptions for current direct reports', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'manager-employee' });
    attendanceService.findAll.mockResolvedValue([
      {
        id: 'a1',
        policyStatus: 'LATE',
        employee: { id: 'employee-1', managerId: 'manager-employee' },
      },
      {
        id: 'a2',
        policyStatus: 'COMPLIANT',
        employee: { id: 'employee-2', managerId: 'manager-employee' },
      },
      {
        id: 'a3',
        policyStatus: 'MISSED_CLOCK_OUT',
        employee: { id: 'employee-3', managerId: 'another-manager' },
      },
    ]);

    const result = await service.findExceptions(user, 14);

    expect(result.total).toBe(1);
    expect(result.records).toEqual([
      expect.objectContaining({ id: 'a1', policyStatus: 'LATE' }),
    ]);
    expect(result.byStatus).toEqual({ LATE: 1 });
    expect(attendanceService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ roles: ['MANAGER'] }),
      expect.objectContaining({ dateFrom: expect.any(String), dateTo: expect.any(String) }),
    );
  });

  it('rejects accounts without a linked employee profile', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);

    await expect(service.findExceptions(user)).rejects.toBeInstanceOf(NotFoundException);
    expect(attendanceService.findAll).not.toHaveBeenCalled();
  });
});
