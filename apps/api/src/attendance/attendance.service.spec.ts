import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  AttendanceCorrectionReason,
  AttendanceCorrectionStatus,
  AttendanceStatus,
} from '@prisma/client';

import { AttendanceService } from './attendance.service';

describe('AttendanceService V1', () => {
  const user = {
    id: 'user-1',
    organisationId: 'organisation-1',
    email: 'employee@example.test',
    firstName: 'Test',
    lastName: 'Employee',
    status: 'ACTIVE',
    roles: ['EMPLOYEE'],
    permissions: [],
  };
  const employee = {
    id: 'employee-1',
    organisationId: 'organisation-1',
    userId: 'user-1',
  };
  const policy = {
    standardClockInTime: '08:00',
    standardClockOutTime: '17:00',
    lateClockInThresholdMinutes: 15,
    defaultWorkingHoursPerDay: 8,
    attendanceWorkingDays: [1, 2, 3, 4, 5],
    attendanceGracePeriodMinutes: 0,
    allowEarlyClockIn: true,
    allowEarlyClockOut: true,
    requireLateAttendanceNote: false,
    requireEarlyClockOutNote: false,
    attendanceCorrectionsRequireApproval: true,
    autoMarkMissedClockOut: false,
  };
  const prisma = {
    employee: { findFirst: jest.fn(), findMany: jest.fn() },
    organisation: { findUnique: jest.fn() },
    attendanceRecord: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    attendanceCorrectionRequest: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    leaveRequest: { findMany: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new AttendanceService(
    prisma as never,
    { sendMail: jest.fn() } as never,
    { notifyEmployee: jest.fn() } as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.employee.findFirst.mockResolvedValue(employee);
    prisma.organisation.findUnique.mockResolvedValue(policy);
  });

  it('calculates late arrival beyond the configured threshold', () => {
    const result = (service as any).withPolicyAnalysis(
      {
        clockInAt: new Date(2026, 6, 1, 8, 20),
        clockOutAt: new Date(2026, 6, 1, 17, 0),
        status: AttendanceStatus.CLOCKED_OUT,
      },
      policy,
    );
    expect(result.isLate).toBe(true);
    expect(result.lateByMinutes).toBe(20);
  });

  it('calculates short shifts and early departure', () => {
    const result = (service as any).withPolicyAnalysis(
      {
        clockInAt: new Date(2026, 6, 1, 8, 0),
        clockOutAt: new Date(2026, 6, 1, 15, 0),
        status: AttendanceStatus.CLOCKED_OUT,
      },
      policy,
    );
    expect(result.isShortShift).toBe(true);
    expect(result.earlyClockOutByMinutes).toBe(120);
  });

  it('calculates overtime separately from approved and payable overtime', () => {
    const result = (service as any).withPolicyAnalysis(
      {
        clockInAt: new Date(2026, 6, 1, 8, 0),
        clockOutAt: new Date(2026, 6, 1, 18, 0),
        status: AttendanceStatus.CLOCKED_OUT,
      },
      policy,
    );
    expect(result.overtimeMinutes).toBe(120);
  });

  it('prevents a duplicate open clock-in', async () => {
    prisma.attendanceRecord.findFirst.mockResolvedValueOnce({
      id: 'open-record',
      status: AttendanceStatus.CLOCKED_IN,
      clockOutAt: null,
    });
    await expect(service.clockIn(user)).rejects.toThrow('already clocked in');
  });

  it('prevents a second attendance record on the same day', async () => {
    prisma.attendanceRecord.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'today-record' });
    await expect(service.clockIn(user)).rejects.toThrow('already created');
  });

  it('uses server time and writes an audit record on clock-in', async () => {
    prisma.attendanceRecord.findFirst.mockResolvedValue(null);
    const create = jest
      .fn()
      .mockImplementation(({ data }) => ({ ...data, id: 'record-1' }));
    const auditCreate = jest.fn().mockResolvedValue({});
    prisma.$transaction.mockImplementation((callback) =>
      callback({
        attendanceRecord: { create },
        auditLog: { create: auditCreate },
      }),
    );
    const before = Date.now();
    const record = await service.clockIn(user, 'Starting shift');
    const after = Date.now();
    expect(new Date(record.clockInAt).getTime()).toBeGreaterThanOrEqual(before);
    expect(new Date(record.clockInAt).getTime()).toBeLessThanOrEqual(after);
    expect(auditCreate).toHaveBeenCalled();
  });

  it('rejects clock-out without an open shift', async () => {
    prisma.attendanceRecord.findFirst.mockResolvedValue(null);
    await expect(service.clockOut(user)).rejects.toThrow(
      'not currently clocked in',
    );
  });

  it('requires details when requesting a correction', async () => {
    await expect(
      service.requestCorrection(user, {
        requestedDate: '2026-07-01',
        reasonCategory: AttendanceCorrectionReason.OTHER,
        explanation: 'Missing time',
      }),
    ).rejects.toThrow('Provide a requested clock-in or clock-out time');
  });

  it('prevents access to another employee attendance record in a correction', async () => {
    prisma.attendanceRecord.findFirst.mockResolvedValue(null);
    await expect(
      service.requestCorrection(user, {
        attendanceRecordId: 'other-record',
        requestedDate: '2026-07-01',
        requestedClockInAt: '2026-07-01T08:00:00.000Z',
        reasonCategory: AttendanceCorrectionReason.INCORRECT_TIME,
        explanation: 'The recorded time belongs to another employee.',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.attendanceRecord.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organisationId: 'organisation-1',
          employeeId: 'employee-1',
        }),
      }),
    );
  });

  it('submits an attendance correction with an audit entry', async () => {
    prisma.attendanceRecord.findFirst.mockResolvedValue(null);
    prisma.attendanceCorrectionRequest.findFirst.mockResolvedValue(null);
    const create = jest.fn().mockResolvedValue({ id: 'correction-1' });
    const auditCreate = jest.fn().mockResolvedValue({});
    prisma.$transaction.mockImplementation((callback) =>
      callback({
        attendanceCorrectionRequest: { create },
        auditLog: { create: auditCreate },
      }),
    );
    await service.requestCorrection(user, {
      requestedDate: '2026-07-01',
      requestedClockInAt: '2026-07-01T08:00:00.000Z',
      reasonCategory: AttendanceCorrectionReason.FORGOT_CLOCK_IN,
      explanation: 'The attendance page was unavailable at shift start.',
    });
    expect(create).toHaveBeenCalled();
    expect(auditCreate).toHaveBeenCalled();
  });

  it('approves a correction and updates the attendance record transactionally', async () => {
    prisma.attendanceCorrectionRequest.findFirst.mockResolvedValue({
      id: 'correction-1',
      organisationId: 'organisation-1',
      employeeId: 'employee-1',
      attendanceRecordId: 'record-1',
      requestedClockInAt: new Date('2026-07-01T08:00:00.000Z'),
      requestedClockOutAt: new Date('2026-07-01T17:00:00.000Z'),
      originalValues: {},
      status: AttendanceCorrectionStatus.PENDING,
      attendanceRecord: {
        id: 'record-1',
        clockInAt: new Date('2026-07-01T09:00:00.000Z'),
        clockOutAt: null,
      },
      employee: { email: null, firstName: 'Test', lastName: 'Employee' },
    });
    const attendanceUpdate = jest.fn().mockResolvedValue({});
    const correctionUpdate = jest.fn().mockResolvedValue({
      id: 'correction-1',
      status: AttendanceCorrectionStatus.APPROVED,
    });
    const auditCreate = jest.fn().mockResolvedValue({});
    prisma.$transaction.mockImplementation((callback) =>
      callback({
        attendanceRecord: { update: attendanceUpdate },
        attendanceCorrectionRequest: { update: correctionUpdate },
        auditLog: { create: auditCreate },
      }),
    );
    await service.reviewCorrection(
      user,
      'correction-1',
      'APPROVED',
      'Times confirmed by the shift manager.',
    );
    expect(attendanceUpdate).toHaveBeenCalled();
    expect(correctionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: AttendanceCorrectionStatus.APPROVED,
        }),
      }),
    );
    expect(auditCreate).toHaveBeenCalled();
  });

  it('requires rejection comments when reviewing a correction', async () => {
    prisma.attendanceCorrectionRequest.findFirst.mockResolvedValue({
      id: 'correction-1',
      status: AttendanceCorrectionStatus.PENDING,
      attendanceRecord: null,
    });
    await expect(
      service.reviewCorrection(user, 'correction-1', 'REJECTED'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not classify an employee on approved leave as a missing clock-in', async () => {
    prisma.employee.findMany.mockResolvedValue([
      { ...employee, department: null },
    ]);
    prisma.attendanceRecord.findMany.mockResolvedValue([]);
    prisma.leaveRequest.findMany.mockResolvedValue([
      { employeeId: 'employee-1', leaveType: 'ANNUAL' },
    ]);
    prisma.attendanceCorrectionRequest.count.mockResolvedValue(0);
    const summary = await service.getDashboardSummary(user, '2026-07-01');
    expect(summary.onLeave).toBe(1);
    expect(summary.missingClockIns).toBe(0);
  });

  it('rejects an invalid attendance status filter', async () => {
    await expect(
      service.findAll(user, { status: 'NOT_A_STATUS' }),
    ).rejects.toThrow('Invalid attendance status filter');
  });

  it('exports an organisation-isolated attendance summary CSV', async () => {
    const findAll = jest
      .spyOn(service, 'findAll')
      .mockResolvedValue([] as never);
    prisma.employee.findMany.mockResolvedValue([
      {
        id: 'employee-1',
        employeeNumber: 'MED-001',
        firstName: 'Test',
        lastName: 'Employee',
        department: { name: 'Clinical' },
      },
    ]);
    prisma.leaveRequest.findMany.mockResolvedValue([]);
    prisma.auditLog.create.mockResolvedValue({});
    const report = await service.exportAttendanceReport(
      user,
      '2026-07-01',
      '2026-07-31',
    );
    expect(report.fileName).toBe(
      'medcnx-attendance-report-2026-07-01-2026-07-31.csv',
    );
    expect(report.content).toContain('Days Expected');
    expect(findAll).toHaveBeenCalledWith(user, {
      dateFrom: '2026-07-01',
      dateTo: '2026-07-31',
    });
    findAll.mockRestore();
  });
});
