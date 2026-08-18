import { Injectable, NotFoundException } from '@nestjs/common';
import type { CurrentUser } from '../auth/types/current-user.type';
import { PrismaService } from '../database/prisma.service';
import { AttendanceService } from './attendance.service';

@Injectable()
export class ManagerAttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendanceService: AttendanceService,
  ) {}

  async findExceptions(user: CurrentUser, days = 14) {
    const manager = await this.prisma.employee.findFirst({
      where: {
        organisationId: user.organisationId,
        userId: user.id,
      },
      select: { id: true },
    });

    if (!manager) {
      throw new NotFoundException('No employee profile is linked to the current user.');
    }

    const safeDays = Math.min(Math.max(Number.isFinite(days) ? Math.trunc(days) : 14, 1), 31);
    const dateTo = new Date();
    const dateFrom = new Date(dateTo);
    dateFrom.setDate(dateFrom.getDate() - (safeDays - 1));

    const managerScopedUser: CurrentUser = {
      ...user,
      roles: ['MANAGER'],
    };

    const records = await this.attendanceService.findAll(managerScopedUser, {
      dateFrom: this.toDateInput(dateFrom),
      dateTo: this.toDateInput(dateTo),
    });

    const exceptions = records.filter((record: any) => {
      const isDirectReport = record.employee?.managerId === manager.id;
      const isException = [
        'LATE',
        'SHORT_SHIFT',
        'LATE_AND_SHORT_SHIFT',
        'MISSED_CLOCK_OUT',
      ].includes(record.policyStatus);

      return isDirectReport && isException;
    });

    const byStatus = exceptions.reduce<Record<string, number>>((summary, record: any) => {
      const status = String(record.policyStatus);
      summary[status] = (summary[status] ?? 0) + 1;
      return summary;
    }, {});

    return {
      windowDays: safeDays,
      total: exceptions.length,
      byStatus,
      records: exceptions,
    };
  }

  private toDateInput(value: Date) {
    const offset = value.getTimezoneOffset();
    return new Date(value.getTime() - offset * 60_000).toISOString().slice(0, 10);
  }
}
