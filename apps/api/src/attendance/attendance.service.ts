import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AttendanceCorrectionStatus,
  AttendanceStatus,
  AuditAction,
  EmployeeNotificationCategory,
  EmploymentStatus,
  LeaveStatus,
  type AttendanceCorrectionReason,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { AccessScopeService } from '../auth/access-scope.service';
import type { CurrentUser } from '../auth/types/current-user.type';
import { PrismaService } from '../database/prisma.service';
import { EmployeeNotificationService } from '../employee-self-service/employee-notification.service';
import { MailService } from '../mail/mail.service';

type AttendanceFilters = {
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  employeeId?: string;
  departmentId?: string;
  status?: string;
};

type OrganisationAttendancePolicy = {
  standardClockInTime: string;
  standardClockOutTime: string;
  lateClockInThresholdMinutes: number;
  defaultWorkingHoursPerDay: number;
  attendanceWorkingDays: number[];
  attendanceGracePeriodMinutes: number;
  allowEarlyClockIn: boolean;
  allowEarlyClockOut: boolean;
  requireLateAttendanceNote: boolean;
  requireEarlyClockOutNote: boolean;
  attendanceCorrectionsRequireApproval: boolean;
  autoMarkMissedClockOut: boolean;
};

type AttendanceRecordWithPolicy = {
  scheduledClockInTime: string;
  scheduledClockOutTime: string;
  expectedMinutes: number;
  workedMinutes: number;
  lateByMinutes: number;
  earlyClockOutByMinutes: number;
  overtimeMinutes: number;
  isLate: boolean;
  isShortShift: boolean;
  policyStatus:
    | 'COMPLIANT'
    | 'CLOCKED_IN'
    | 'LATE'
    | 'SHORT_SHIFT'
    | 'LATE_AND_SHORT_SHIFT'
    | 'MISSED_CLOCK_OUT';
};

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly notifications: EmployeeNotificationService,
    private readonly accessScope: AccessScopeService,
  ) {}

  async findAll(user: CurrentUser, filters: AttendanceFilters) {
    const policy = await this.getAttendancePolicy(user.organisationId);
    const employeeScope = await this.accessScope.employeeWhere(user);

    const where: any = {
      organisationId: user.organisationId,
      employee: filters.departmentId
        ? { AND: [employeeScope, { departmentId: filters.departmentId }] }
        : employeeScope,
    };

    if (filters.employeeId) {
      await this.accessScope.assertEmployeeAccess(user, filters.employeeId);
      where.employeeId = filters.employeeId;
    }

    if (filters.status) {
      if (
        !Object.values(AttendanceStatus).includes(
          filters.status as AttendanceStatus,
        )
      ) {
        throw new BadRequestException('Invalid attendance status filter.');
      }

      where.status = filters.status;
    }

    if (filters.date) {
      const selectedDate = new Date(filters.date);

      if (Number.isNaN(selectedDate.getTime())) {
        throw new BadRequestException('Invalid date filter.');
      }

      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      where.clockInAt = {
        gte: startOfDay,
        lte: endOfDay,
      };
    } else if (filters.dateFrom || filters.dateTo) {
      where.clockInAt = {};
      if (filters.dateFrom) {
        const from = new Date(`${filters.dateFrom}T00:00:00`);
        if (Number.isNaN(from.getTime())) {
          throw new BadRequestException('Invalid start date filter.');
        }
        where.clockInAt.gte = from;
      }
      if (filters.dateTo) {
        const to = new Date(`${filters.dateTo}T23:59:59.999`);
        if (Number.isNaN(to.getTime())) {
          throw new BadRequestException('Invalid end date filter.');
        }
        where.clockInAt.lte = to;
      }
    }

    const records = await this.prisma.attendanceRecord.findMany({
      where,
      orderBy: {
        clockInAt: 'desc',
      },
      include: {
        employee: {
          include: {
            department: true,
          },
        },
      },
      take: 300,
    });

    return records.map((record) => this.withPolicyAnalysis(record, policy));
  }

  async findMyAttendance(user: CurrentUser) {
    const employee = await this.findEmployeeForUser(user);
    const policy = await this.getAttendancePolicy(user.organisationId);

    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        organisationId: user.organisationId,
        employeeId: employee.id,
      },
      orderBy: {
        clockInAt: 'desc',
      },
      take: 100,
    });

    return records.map((record) => this.withPolicyAnalysis(record, policy));
  }

  async findMyTodayAttendance(user: CurrentUser) {
    const employee = await this.findEmployeeForUser(user);
    const policy = await this.getAttendancePolicy(user.organisationId);
    const { startOfDay, endOfDay } = this.getTodayRange();

    const record = await this.prisma.attendanceRecord.findFirst({
      where: {
        organisationId: user.organisationId,
        employeeId: employee.id,
        clockInAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: {
        clockInAt: 'desc',
      },
    });

    if (!record) return null;
    return this.withPolicyAnalysis(record, policy);
  }

  async clockIn(user: CurrentUser, notes?: string) {
    const employee = await this.findEmployeeForUser(user);
    const policy = await this.getAttendancePolicy(user.organisationId);
    const { startOfDay, endOfDay } = this.getTodayRange();

    const existingOpenRecord = await this.prisma.attendanceRecord.findFirst({
      where: {
        organisationId: user.organisationId,
        employeeId: employee.id,
        status: AttendanceStatus.CLOCKED_IN,
        clockOutAt: null,
      },
      orderBy: { clockInAt: 'desc' },
    });

    if (existingOpenRecord) {
      throw new BadRequestException('You are already clocked in.');
    }

    const existingTodayRecord = await this.prisma.attendanceRecord.findFirst({
      where: {
        organisationId: user.organisationId,
        employeeId: employee.id,
        clockInAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: { clockInAt: 'desc' },
    });

    if (existingTodayRecord) {
      throw new BadRequestException(
        'You have already created an attendance record today.',
      );
    }

    const now = new Date();

    if (
      !policy.allowEarlyClockIn &&
      this.dateToMinutes(now) < this.timeToMinutes(policy.standardClockInTime)
    ) {
      throw new BadRequestException(
        `Early clock-in is not permitted. Your scheduled start time is ${policy.standardClockInTime}.`,
      );
    }

    const analysis = this.withPolicyAnalysis(
      { clockInAt: now, clockOutAt: null, status: AttendanceStatus.CLOCKED_IN },
      policy,
    );

    if (
      analysis.isLate &&
      policy.requireLateAttendanceNote &&
      !this.cleanNotes(notes)
    ) {
      throw new BadRequestException('A note is required when clocking in late.');
    }

    const record = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.attendanceRecord.create({
        data: {
          id: randomUUID(),
          organisationId: user.organisationId,
          employeeId: employee.id,
          clockInAt: now,
          status: AttendanceStatus.CLOCKED_IN,
          notes: this.cleanNotes(notes),
          expectedMinutes: analysis.expectedMinutes,
          lateMinutes: analysis.lateByMinutes,
          policyResult: analysis.policyStatus,
          updatedAt: now,
        },
      });
      await transaction.auditLog.create({
        data: {
          organisationId: user.organisationId,
          actorUserId: user.id,
          employeeId: employee.id,
          action: AuditAction.CREATE,
          entity: 'AttendanceRecord',
          entityId: created.id,
          message: 'Employee clocked in.',
          metadata: {
            serverTime: now.toISOString(),
            lateMinutes: analysis.lateByMinutes,
          },
        },
      });
      return created;
    });

    return this.withPolicyAnalysis(record, policy);
  }

  async clockOut(user: CurrentUser, notes?: string) {
    const employee = await this.findEmployeeForUser(user);
    const policy = await this.getAttendancePolicy(user.organisationId);

    const openRecord = await this.prisma.attendanceRecord.findFirst({
      where: {
        organisationId: user.organisationId,
        employeeId: employee.id,
        status: AttendanceStatus.CLOCKED_IN,
        clockOutAt: null,
      },
      orderBy: { clockInAt: 'desc' },
    });

    if (!openRecord) {
      throw new BadRequestException('You are not currently clocked in.');
    }

    const clockOutAt = new Date();
    if (clockOutAt <= openRecord.clockInAt) {
      throw new BadRequestException('Clock-out time must be after clock-in.');
    }

    const existingNotes = openRecord.notes?.trim();
    const newNotes = this.cleanNotes(notes);
    const updatedNotes = [existingNotes, newNotes].filter(Boolean).join('\n');

    const analysis = this.withPolicyAnalysis(
      { ...openRecord, clockOutAt, status: AttendanceStatus.CLOCKED_OUT },
      policy,
    );

    if (analysis.earlyClockOutByMinutes > 0 && !policy.allowEarlyClockOut) {
      throw new BadRequestException(
        `Early clock-out is not permitted. Your scheduled end time is ${policy.standardClockOutTime}.`,
      );
    }
    if (
      analysis.earlyClockOutByMinutes > 0 &&
      policy.requireEarlyClockOutNote &&
      !newNotes
    ) {
      throw new BadRequestException(
        'A note is required when clocking out early.',
      );
    }

    const record = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.attendanceRecord.update({
        where: { id: openRecord.id },
        data: {
          clockOutAt,
          status: AttendanceStatus.CLOCKED_OUT,
          notes: updatedNotes || null,
          expectedMinutes: analysis.expectedMinutes,
          workedMinutes: analysis.workedMinutes,
          lateMinutes: analysis.lateByMinutes,
          earlyClockOutMinutes: analysis.earlyClockOutByMinutes,
          calculatedOvertimeMinutes: analysis.overtimeMinutes,
          policyResult: analysis.policyStatus,
          updatedAt: clockOutAt,
        },
      });
      await transaction.auditLog.create({
        data: {
          organisationId: user.organisationId,
          actorUserId: user.id,
          employeeId: employee.id,
          action: AuditAction.UPDATE,
          entity: 'AttendanceRecord',
          entityId: updated.id,
          message: 'Employee clocked out.',
          metadata: {
            serverTime: clockOutAt.toISOString(),
            workedMinutes: analysis.workedMinutes,
            overtimeMinutes: analysis.overtimeMinutes,
          },
        },
      });
      return updated;
    });

    return this.withPolicyAnalysis(record, policy);
  }

  async findMyCorrections(user: CurrentUser) {
    const employee = await this.findEmployeeForUser(user);
    return this.prisma.attendanceCorrectionRequest.findMany({
      where: { organisationId: user.organisationId, employeeId: employee.id },
      include: {
        reviewer: { select: { id: true, firstName: true, lastName: true } },
        attendanceRecord: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findCorrections(
    user: CurrentUser,
    status?: AttendanceCorrectionStatus,
  ) {
    const employeeScope = await this.accessScope.employeeWhere(user);

    return this.prisma.attendanceCorrectionRequest.findMany({
      where: {
        organisationId: user.organisationId,
        status,
        employee: employeeScope,
      },
      include: {
        employee: { include: { department: true } },
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
        reviewer: { select: { id: true, firstName: true, lastName: true } },
        attendanceRecord: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async requestCorrection(
    user: CurrentUser,
    input: {
      attendanceRecordId?: string;
      requestedDate: string;
      requestedClockInAt?: string;
      requestedClockOutAt?: string;
      reasonCategory: AttendanceCorrectionReason;
      explanation: string;
    },
  ) {
    const employee = await this.findEmployeeForUser(user);
    const requestedDate = new Date(`${input.requestedDate}T00:00:00`);
    const requestedClockInAt = input.requestedClockInAt
      ? new Date(input.requestedClockInAt)
      : null;
    const requestedClockOutAt = input.requestedClockOutAt
      ? new Date(input.requestedClockOutAt)
      : null;

    if (Number.isNaN(requestedDate.getTime())) {
      throw new BadRequestException('A valid correction date is required.');
    }
    if (requestedClockInAt && Number.isNaN(requestedClockInAt.getTime())) {
      throw new BadRequestException('Requested clock-in time is invalid.');
    }
    if (requestedClockOutAt && Number.isNaN(requestedClockOutAt.getTime())) {
      throw new BadRequestException('Requested clock-out time is invalid.');
    }
    if (
      requestedClockInAt &&
      requestedClockOutAt &&
      requestedClockOutAt <= requestedClockInAt
    ) {
      throw new BadRequestException(
        'Requested clock-out must be after clock-in.',
      );
    }
    if (!requestedClockInAt && !requestedClockOutAt) {
      throw new BadRequestException(
        'Provide a requested clock-in or clock-out time.',
      );
    }

    const record = input.attendanceRecordId
      ? await this.prisma.attendanceRecord.findFirst({
          where: {
            id: input.attendanceRecordId,
            organisationId: user.organisationId,
            employeeId: employee.id,
          },
        })
      : null;
    if (input.attendanceRecordId && !record) {
      throw new NotFoundException('Attendance record not found.');
    }

    const existingPending =
      await this.prisma.attendanceCorrectionRequest.findFirst({
        where: {
          organisationId: user.organisationId,
          employeeId: employee.id,
          attendanceRecordId: input.attendanceRecordId ?? null,
          requestedDate,
          status: AttendanceCorrectionStatus.PENDING,
        },
      });
    if (existingPending) {
      throw new BadRequestException(
        'A pending correction already exists for this record and date.',
      );
    }

    const correction = await this.prisma.$transaction(async (transaction) => {
      const correction = await transaction.attendanceCorrectionRequest.create({
        data: {
          organisationId: user.organisationId,
          employeeId: employee.id,
          attendanceRecordId: record?.id,
          requestedByUserId: user.id,
          requestedDate,
          requestedClockInAt,
          requestedClockOutAt,
          reasonCategory: input.reasonCategory,
          explanation: input.explanation.trim(),
          originalValues: record
            ? {
                clockInAt: record.clockInAt.toISOString(),
                clockOutAt: record.clockOutAt?.toISOString() ?? null,
                status: record.status,
                notes: record.notes,
              }
            : undefined,
        },
      });
      await transaction.auditLog.create({
        data: {
          organisationId: user.organisationId,
          actorUserId: user.id,
          employeeId: employee.id,
          action: AuditAction.CREATE,
          entity: 'AttendanceCorrectionRequest',
          entityId: correction.id,
          message: 'Attendance correction requested.',
          metadata: {
            reasonCategory: input.reasonCategory,
            requestedDate: input.requestedDate,
          },
        },
      });
      return correction;
    });

    await this.notifyCorrectionReviewers(
      user.organisationId,
      `${employee.firstName ?? user.firstName} ${employee.lastName ?? user.lastName}`,
      input.requestedDate,
    );
    return correction;
  }

  async cancelCorrection(user: CurrentUser, correctionId: string) {
    const employee = await this.findEmployeeForUser(user);
    const correction = await this.prisma.attendanceCorrectionRequest.findFirst({
      where: {
        id: correctionId,
        organisationId: user.organisationId,
        employeeId: employee.id,
      },
    });
    if (!correction) {
      throw new NotFoundException('Correction request not found.');
    }
    if (correction.status !== AttendanceCorrectionStatus.PENDING) {
      throw new BadRequestException(
        'Only pending correction requests can be cancelled.',
      );
    }

    return this.prisma.$transaction(async (transaction) => {
      const cancelled = await transaction.attendanceCorrectionRequest.update({
        where: { id: correction.id },
        data: { status: AttendanceCorrectionStatus.CANCELLED },
      });
      await transaction.auditLog.create({
        data: {
          organisationId: user.organisationId,
          actorUserId: user.id,
          employeeId: employee.id,
          action: AuditAction.UPDATE,
          entity: 'AttendanceCorrectionRequest',
          entityId: correction.id,
          message: 'Attendance correction cancelled.',
        },
      });
      return cancelled;
    });
  }

  async reviewCorrection(
    user: CurrentUser,
    correctionId: string,
    decision: 'APPROVED' | 'REJECTED',
    comments?: string,
  ) {
    const employeeScope = await this.accessScope.employeeWhere(user);
    const correction = await this.prisma.attendanceCorrectionRequest.findFirst({
      where: {
        id: correctionId,
        organisationId: user.organisationId,
        employee: employeeScope,
      },
      include: {
        attendanceRecord: true,
        employee: { select: { email: true, firstName: true, lastName: true } },
      },
    });

    if (!correction) {
      throw new NotFoundException('Correction request not found.');
    }
    if (correction.status !== AttendanceCorrectionStatus.PENDING) {
      throw new BadRequestException(
        'This correction request has already been reviewed.',
      );
    }
    if (decision === 'REJECTED' && !comments?.trim()) {
      throw new BadRequestException(
        'Review comments are required when rejecting a correction.',
      );
    }

    const policy = await this.getAttendancePolicy(user.organisationId);
    const reviewedCorrection = await this.prisma.$transaction(
      async (transaction) => {
        const reviewedAt = new Date();
        let attendanceRecordId = correction.attendanceRecordId;

        if (decision === 'APPROVED') {
          const clockInAt =
            correction.requestedClockInAt ??
            correction.attendanceRecord?.clockInAt;
          const clockOutAt =
            correction.requestedClockOutAt ??
            correction.attendanceRecord?.clockOutAt;
          if (!clockInAt) {
            throw new BadRequestException(
              'An approved correction requires a clock-in time.',
            );
          }
          if (clockOutAt && clockOutAt <= clockInAt) {
            throw new BadRequestException(
              'Corrected clock-out must be after clock-in.',
            );
          }
          const status = clockOutAt
            ? AttendanceStatus.CLOCKED_OUT
            : AttendanceStatus.CLOCKED_IN;
          const analysis = this.withPolicyAnalysis(
            { clockInAt, clockOutAt, status },
            policy,
          );
          const recordData = {
            clockInAt,
            clockOutAt,
            status,
            expectedMinutes: analysis.expectedMinutes,
            workedMinutes: analysis.workedMinutes,
            lateMinutes: analysis.lateByMinutes,
            earlyClockOutMinutes: analysis.earlyClockOutByMinutes,
            calculatedOvertimeMinutes: analysis.overtimeMinutes,
            policyResult: analysis.policyStatus,
            correctedAt: reviewedAt,
            correctedByUserId: user.id,
            correctionOriginalValues: correction.originalValues ?? undefined,
          };
          if (correction.attendanceRecordId) {
            await transaction.attendanceRecord.update({
              where: { id: correction.attendanceRecordId },
              data: recordData,
            });
          } else {
            const created = await transaction.attendanceRecord.create({
              data: {
                organisationId: user.organisationId,
                employeeId: correction.employeeId,
                ...recordData,
              },
            });
            attendanceRecordId = created.id;
          }
        }

        const reviewed = await transaction.attendanceCorrectionRequest.update({
          where: { id: correction.id },
          data: {
            status:
              decision === 'APPROVED'
                ? AttendanceCorrectionStatus.APPROVED
                : AttendanceCorrectionStatus.REJECTED,
            attendanceRecordId,
            reviewerUserId: user.id,
            reviewedAt,
            reviewComments: comments?.trim() || null,
          },
        });
        await transaction.auditLog.create({
          data: {
            organisationId: user.organisationId,
            actorUserId: user.id,
            employeeId: correction.employeeId,
            action:
              decision === 'APPROVED'
                ? AuditAction.APPROVE
                : AuditAction.REJECT,
            entity: 'AttendanceCorrectionRequest',
            entityId: correction.id,
            message: `Attendance correction ${decision.toLowerCase()}.`,
            metadata: {
              attendanceRecordId,
              comments: comments?.trim() || null,
            },
          },
        });
        return reviewed;
      },
    );

    await this.notifyEmployeeCorrectionDecision(
      correction.employee.email,
      correction.employee.firstName,
      decision,
      comments,
    );
    await this.notifications.notifyEmployee({
      organisationId: user.organisationId,
      employeeId: correction.employeeId,
      category: EmployeeNotificationCategory.ATTENDANCE,
      title: `Attendance correction ${decision.toLowerCase()}`,
      message:
        decision === 'APPROVED'
          ? 'Your attendance correction request has been approved.'
          : `Your attendance correction request was rejected. ${comments ?? ''}`.trim(),
      href: '/employee/attendance',
    });
    return reviewedCorrection;
  }

  async getDashboardSummary(user: CurrentUser, dateValue?: string) {
    const date = dateValue ? new Date(`${dateValue}T12:00:00`) : new Date();
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid summary date.');
    }

    const policy = await this.getAttendancePolicy(user.organisationId);
    const employeeScope = await this.accessScope.employeeWhere(user);
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    if (policy.autoMarkMissedClockOut) {
      await this.markMissedClockOuts(user, startOfDay);
    }

    const employmentOverlap = this.employmentOverlapWhere(startOfDay, endOfDay);
    const [employees, records, leave, pendingCorrections] = await Promise.all([
      this.prisma.employee.findMany({
        where: {
          AND: [employeeScope, employmentOverlap],
        },
        include: { department: true },
      }),
      this.prisma.attendanceRecord.findMany({
        where: {
          organisationId: user.organisationId,
          employee: employeeScope,
          clockInAt: { gte: startOfDay, lte: endOfDay },
        },
        include: { employee: { include: { department: true } } },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          organisationId: user.organisationId,
          employee: employeeScope,
          status: LeaveStatus.APPROVED,
          startDate: { lte: endOfDay },
          endDate: { gte: startOfDay },
        },
        select: { employeeId: true, leaveType: true },
      }),
      this.prisma.attendanceCorrectionRequest.count({
        where: {
          organisationId: user.organisationId,
          employee: employeeScope,
          status: AttendanceCorrectionStatus.PENDING,
        },
      }),
    ]);

    const analysed = records.map((record) =>
      this.withPolicyAnalysis(record, policy),
    );
    const recordedIds = new Set(records.map((record) => record.employeeId));
    const leaveIds = new Set(leave.map((item) => item.employeeId));
    const isWorkingDay = policy.attendanceWorkingDays.includes(date.getDay());
    const missing = isWorkingDay
      ? employees.filter(
          (employee) =>
            !recordedIds.has(employee.id) && !leaveIds.has(employee.id),
        )
      : [];
    const completed = analysed.filter(
      (record) => record.status === AttendanceStatus.CLOCKED_OUT,
    );
    const compliant = completed.filter(
      (record) => record.policyStatus === 'COMPLIANT',
    ).length;

    return {
      date: startOfDay.toISOString(),
      isWorkingDay,
      employeeCount: employees.length,
      clockedIn: analysed.filter(
        (record) => record.status === AttendanceStatus.CLOCKED_IN,
      ).length,
      clockedOut: completed.length,
      onTime: analysed.filter((record) => !record.isLate).length,
      late: analysed.filter((record) => record.isLate).length,
      shortShifts: analysed.filter((record) => record.isShortShift).length,
      missingClockIns: missing.length,
      missingEmployees: missing,
      onLeave: leave.length,
      approvedLeave: leave,
      pendingCorrections,
      totalWorkedMinutes: analysed.reduce(
        (sum, record) => sum + record.workedMinutes,
        0,
      ),
      totalOvertimeMinutes: analysed.reduce(
        (sum, record) => sum + record.overtimeMinutes,
        0,
      ),
      compliancePercentage: completed.length
        ? Math.round((compliant / completed.length) * 100)
        : 100,
    };
  }

  async exportAttendanceReport(
    user: CurrentUser,
    dateFrom: string,
    dateTo: string,
  ) {
    const from = new Date(`${dateFrom}T00:00:00`);
    const to = new Date(`${dateTo}T23:59:59.999`);
    if (
      Number.isNaN(from.getTime()) ||
      Number.isNaN(to.getTime()) ||
      to < from
    ) {
      throw new BadRequestException(
        'Provide a valid attendance report date range.',
      );
    }

    const records = await this.findAll(user, { dateFrom, dateTo });
    const policy = await this.getAttendancePolicy(user.organisationId);
    const employeeScope = await this.accessScope.employeeWhere(user);
    const employmentOverlap = this.employmentOverlapWhere(from, to);
    const [employees, leaveRequests] = await Promise.all([
      this.prisma.employee.findMany({
        where: {
          AND: [employeeScope, employmentOverlap],
        },
        include: { department: true },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          organisationId: user.organisationId,
          employee: employeeScope,
          status: LeaveStatus.APPROVED,
          startDate: { lte: to },
          endDate: { gte: from },
        },
        select: { employeeId: true, startDate: true, endDate: true },
      }),
    ]);

    const summaries = employees.map((employee) => {
      const employmentStart =
        employee.startDate && employee.startDate > from
          ? employee.startDate
          : from;
      const employmentEnd =
        employee.endDate && employee.endDate < to ? employee.endDate : to;
      const expectedDays =
        employmentStart <= employmentEnd
          ? this.countWorkingDays(
              employmentStart,
              employmentEnd,
              policy.attendanceWorkingDays,
            )
          : 0;
      const employeeRecords = records.filter(
        (record: any) => record.employeeId === employee.id,
      ) as Array<any>;
      const leaveDays = leaveRequests
        .filter((leave) => leave.employeeId === employee.id)
        .reduce((total, leave) => {
          const leaveStart =
            leave.startDate > employmentStart ? leave.startDate : employmentStart;
          const leaveEnd =
            leave.endDate < employmentEnd ? leave.endDate : employmentEnd;
          return (
            total +
            (leaveStart <= leaveEnd
              ? this.countWorkingDays(
                  leaveStart,
                  leaveEnd,
                  policy.attendanceWorkingDays,
                )
              : 0)
          );
        }, 0);
      const presentDays = new Set(
        employeeRecords.map((record) =>
          new Date(record.clockInAt).toISOString().slice(0, 10),
        ),
      ).size;
      const compliantDays = employeeRecords.filter(
        (record) => record.policyStatus === 'COMPLIANT',
      ).length;

      return [
        employee.employeeNumber,
        `${employee.firstName} ${employee.lastName}`,
        employee.department?.name ?? '',
        expectedDays,
        presentDays,
        employeeRecords.filter((record) => record.isLate).length,
        Math.max(0, expectedDays - presentDays - leaveDays),
        leaveDays,
        employeeRecords.reduce((sum, record) => sum + record.workedMinutes, 0),
        employeeRecords.reduce(
          (sum, record) => sum + record.overtimeMinutes,
          0,
        ),
        employeeRecords.filter((record) => record.isShortShift).length,
        employeeRecords.filter(
          (record) => record.status === AttendanceStatus.MISSED_CLOCK_OUT,
        ).length,
        employeeRecords.length
          ? Math.round((compliantDays / employeeRecords.length) * 100)
          : 0,
      ];
    });

    const header = [
      'Employee Number',
      'Employee Name',
      'Department',
      'Days Expected',
      'Days Present',
      'Days Late',
      'Days Absent',
      'Days On Leave',
      'Total Worked Minutes',
      'Overtime Minutes',
      'Short Shifts',
      'Missed Clock-outs',
      'Compliance Percentage',
    ];
    const csv = [header, ...summaries]
      .map((row) =>
        row
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(','),
      )
      .join('\r\n');

    await this.prisma.auditLog.create({
      data: {
        organisationId: user.organisationId,
        actorUserId: user.id,
        action: AuditAction.DOWNLOAD,
        entity: 'AttendanceReport',
        message: 'Attendance report exported.',
        metadata: { dateFrom, dateTo, recordCount: records.length },
      },
    });

    return {
      fileName: `medcnx-attendance-report-${dateFrom}-${dateTo}.csv`,
      content: `\uFEFF${csv}\r\n`,
    };
  }

  private employmentOverlapWhere(from: Date, to: Date) {
    return {
      AND: [
        {
          OR: [
            {
              employmentStatus: {
                in: [
                  EmploymentStatus.ACTIVE,
                  EmploymentStatus.ON_LEAVE,
                  EmploymentStatus.SUSPENDED,
                ],
              },
            },
            {
              employmentStatus: {
                in: [
                  EmploymentStatus.TERMINATED,
                  EmploymentStatus.RESIGNED,
                ],
              },
              endDate: { not: null },
            },
          ],
        },
        {
          OR: [{ startDate: null }, { startDate: { lte: to } }],
        },
        {
          OR: [{ endDate: null }, { endDate: { gte: from } }],
        },
      ],
    };
  }

  private countWorkingDays(from: Date, to: Date, workingDays: number[]) {
    let count = 0;
    const cursor = new Date(from);
    cursor.setHours(12, 0, 0, 0);
    const end = new Date(to);
    end.setHours(12, 0, 0, 0);
    while (cursor <= end) {
      if (workingDays.includes(cursor.getDay())) count += 1;
      cursor.setDate(cursor.getDate() + 1);
    }
    return count;
  }

  private async markMissedClockOuts(user: CurrentUser, before: Date) {
    const employeeScope = await this.accessScope.employeeWhere(user);
    const openRecords = await this.prisma.attendanceRecord.findMany({
      where: {
        organisationId: user.organisationId,
        employee: employeeScope,
        status: AttendanceStatus.CLOCKED_IN,
        clockOutAt: null,
        clockInAt: { lt: before },
      },
      select: { id: true, employeeId: true, clockInAt: true },
    });

    if (openRecords.length === 0) return;

    await this.prisma.$transaction(async (transaction) => {
      for (const record of openRecords) {
        await transaction.attendanceRecord.update({
          where: { id: record.id },
          data: {
            status: AttendanceStatus.MISSED_CLOCK_OUT,
            policyResult: 'MISSED_CLOCK_OUT',
          },
        });
        await transaction.auditLog.create({
          data: {
            organisationId: user.organisationId,
            employeeId: record.employeeId,
            action: AuditAction.UPDATE,
            entity: 'AttendanceRecord',
            entityId: record.id,
            message: 'Open attendance record marked as missed clock-out.',
            metadata: { clockInAt: record.clockInAt.toISOString() },
          },
        });
      }
    });
  }

  private async notifyCorrectionReviewers(
    organisationId: string,
    employeeName: string,
    requestedDate: string,
  ) {
    try {
      const reviewers = await this.prisma.user.findMany({
        where: {
          organisationId,
          status: 'ACTIVE',
          userRoles: {
            some: {
              role: {
                rolePermissions: {
                  some: {
                    permission: { key: 'attendance:review-corrections' },
                  },
                },
              },
            },
          },
        },
        select: { email: true },
      });
      await Promise.allSettled(
        reviewers.map((reviewer) =>
          this.mailService.sendMail({
            to: reviewer.email,
            subject: `Attendance correction submitted: ${employeeName}`,
            text: `${employeeName} submitted an attendance correction for ${requestedDate}. Sign in to MedCNX to review it.`,
            html: `<p>${employeeName} submitted an attendance correction for ${requestedDate}.</p><p>Sign in to MedCNX to review it.</p>`,
          }),
        ),
      );
    } catch {
      // Notification failure must never roll back the correction transaction.
    }
  }

  private async notifyEmployeeCorrectionDecision(
    email: string | null,
    firstName: string,
    decision: 'APPROVED' | 'REJECTED',
    comments?: string,
  ) {
    if (!email) return;
    try {
      const message = `Your attendance correction was ${decision.toLowerCase()}.${
        comments ? ` Review comments: ${comments}` : ''
      }`;
      await this.mailService.sendMail({
        to: email,
        subject: `Attendance correction ${decision.toLowerCase()}`,
        text: `${firstName}, ${message}`,
        html: `<p>${firstName},</p><p>${message}</p>`,
      });
    } catch {
      // The reviewed attendance transaction remains authoritative.
    }
  }

  private async findEmployeeForUser(user: CurrentUser) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        organisationId: user.organisationId,
        userId: user.id,
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee profile not found.');
    }

    if (employee.organisationId !== user.organisationId) {
      throw new ForbiddenException('You cannot access this employee profile.');
    }

    return employee;
  }

  private async getAttendancePolicy(
    organisationId: string,
  ): Promise<OrganisationAttendancePolicy> {
    const organisation = await this.prisma.organisation.findUnique({
      where: { id: organisationId },
      select: {
        standardClockInTime: true,
        standardClockOutTime: true,
        lateClockInThresholdMinutes: true,
        defaultWorkingHoursPerDay: true,
        attendanceWorkingDays: true,
        attendanceGracePeriodMinutes: true,
        allowEarlyClockIn: true,
        allowEarlyClockOut: true,
        requireLateAttendanceNote: true,
        requireEarlyClockOutNote: true,
        attendanceCorrectionsRequireApproval: true,
        autoMarkMissedClockOut: true,
      },
    });

    return {
      standardClockInTime: organisation?.standardClockInTime ?? '08:00',
      standardClockOutTime: organisation?.standardClockOutTime ?? '17:00',
      lateClockInThresholdMinutes:
        organisation?.lateClockInThresholdMinutes ?? 15,
      defaultWorkingHoursPerDay: organisation?.defaultWorkingHoursPerDay ?? 8,
      attendanceWorkingDays: organisation?.attendanceWorkingDays ?? [
        1, 2, 3, 4, 5,
      ],
      attendanceGracePeriodMinutes:
        organisation?.attendanceGracePeriodMinutes ?? 0,
      allowEarlyClockIn: organisation?.allowEarlyClockIn ?? true,
      allowEarlyClockOut: organisation?.allowEarlyClockOut ?? true,
      requireLateAttendanceNote:
        organisation?.requireLateAttendanceNote ?? false,
      requireEarlyClockOutNote: organisation?.requireEarlyClockOutNote ?? false,
      attendanceCorrectionsRequireApproval:
        organisation?.attendanceCorrectionsRequireApproval ?? true,
      autoMarkMissedClockOut: organisation?.autoMarkMissedClockOut ?? true,
    };
  }

  private withPolicyAnalysis<T extends Record<string, any>>(
    record: T,
    policy: OrganisationAttendancePolicy,
  ): T & AttendanceRecordWithPolicy {
    const expectedMinutes = policy.defaultWorkingHoursPerDay * 60;
    const scheduledClockInMinutes = this.timeToMinutes(
      policy.standardClockInTime,
    );
    const scheduledClockOutMinutes = this.timeToMinutes(
      policy.standardClockOutTime,
    );
    const actualClockInMinutes = this.dateToMinutes(record.clockInAt);
    const actualClockOutMinutes = record.clockOutAt
      ? this.dateToMinutes(record.clockOutAt)
      : null;
    const rawLateByMinutes = Math.max(
      0,
      actualClockInMinutes - scheduledClockInMinutes,
    );
    const effectiveLateThreshold =
      policy.lateClockInThresholdMinutes + policy.attendanceGracePeriodMinutes;
    const isLate = rawLateByMinutes > effectiveLateThreshold;
    const workedMinutes = record.clockOutAt
      ? this.minutesBetween(record.clockInAt, record.clockOutAt)
      : 0;
    const earlyClockOutByMinutes =
      actualClockOutMinutes === null
        ? 0
        : Math.max(0, scheduledClockOutMinutes - actualClockOutMinutes);
    const isShortShift =
      record.status === AttendanceStatus.CLOCKED_OUT &&
      workedMinutes > 0 &&
      workedMinutes < expectedMinutes;
    const overtimeMinutes = Math.max(0, workedMinutes - expectedMinutes);

    let policyStatus: AttendanceRecordWithPolicy['policyStatus'] = 'COMPLIANT';
    if (record.status === AttendanceStatus.MISSED_CLOCK_OUT) {
      policyStatus = 'MISSED_CLOCK_OUT';
    } else if (record.status === AttendanceStatus.CLOCKED_IN) {
      policyStatus = 'CLOCKED_IN';
    } else if (isLate && isShortShift) {
      policyStatus = 'LATE_AND_SHORT_SHIFT';
    } else if (isLate) {
      policyStatus = 'LATE';
    } else if (isShortShift) {
      policyStatus = 'SHORT_SHIFT';
    }

    return {
      ...record,
      scheduledClockInTime: policy.standardClockInTime,
      scheduledClockOutTime: policy.standardClockOutTime,
      expectedMinutes,
      workedMinutes,
      lateByMinutes: rawLateByMinutes,
      earlyClockOutByMinutes,
      overtimeMinutes,
      isLate,
      isShortShift,
      policyStatus,
    };
  }

  private timeToMinutes(value: string) {
    const [hours, minutes] = value.split(':').map(Number);
    if (
      Number.isNaN(hours) ||
      Number.isNaN(minutes) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59
    ) {
      return 0;
    }
    return hours * 60 + minutes;
  }

  private dateToMinutes(value: Date | string) {
    const date = new Date(value);
    return date.getHours() * 60 + date.getMinutes();
  }

  private minutesBetween(start: Date | string, end: Date | string) {
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    if (
      Number.isNaN(startTime) ||
      Number.isNaN(endTime) ||
      endTime <= startTime
    ) {
      return 0;
    }
    return Math.floor((endTime - startTime) / (1000 * 60));
  }

  private getTodayRange() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    return { startOfDay, endOfDay };
  }

  private cleanNotes(notes?: string) {
    const cleanedNotes = notes?.trim();
    return cleanedNotes || null;
  }
}
