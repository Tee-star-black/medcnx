import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import type { CurrentUser } from '../auth/types/current-user.type';
import { PrismaService } from '../database/prisma.service';
import { UpdateOrganisationDto } from './dto/update-organisation.dto';

@Injectable()
export class OrganisationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForUser(user: CurrentUser) {
    return this.prisma.organisation.findMany({
      where: {
        id: user.organisationId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: this.organisationSelect(),
    });
  }

  async findCurrentForUser(user: CurrentUser) {
    const organisation = await this.prisma.organisation.findUnique({
      where: {
        id: user.organisationId,
      },
      select: this.organisationSelect(),
    });

    if (!organisation) {
      throw new NotFoundException('Organisation not found.');
    }

    return organisation;
  }

  async updateCurrentForUser(user: CurrentUser, dto: UpdateOrganisationDto) {
    const existingOrganisation = await this.prisma.organisation.findUnique({
      where: {
        id: user.organisationId,
      },
      select: {
        id: true,
        standardClockInTime: true,
        standardClockOutTime: true,
      },
    });

    if (!existingOrganisation) {
      throw new NotFoundException('Organisation not found.');
    }

    if (
      dto.standardClockInTime !== undefined &&
      !this.isValidTime(dto.standardClockInTime)
    ) {
      throw new BadRequestException(
        'Standard clock-in time must use HH:mm format.',
      );
    }

    if (
      dto.standardClockOutTime !== undefined &&
      !this.isValidTime(dto.standardClockOutTime)
    ) {
      throw new BadRequestException(
        'Standard clock-out time must use HH:mm format.',
      );
    }

    const clockIn =
      dto.standardClockInTime ?? existingOrganisation.standardClockInTime;
    const clockOut =
      dto.standardClockOutTime ?? existingOrganisation.standardClockOutTime;
    if (this.timeToMinutes(clockOut) <= this.timeToMinutes(clockIn)) {
      throw new BadRequestException(
        'Standard clock-out time must be later than clock-in time.',
      );
    }
    if (dto.attendanceWorkingDays?.length === 0) {
      throw new BadRequestException(
        'Select at least one attendance working day.',
      );
    }

    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.organisation.update({
        where: { id: user.organisationId },
        data: {
          name: this.cleanRequired(dto.name),
          email: this.clean(dto.email),
          phone: this.clean(dto.phone),
          website: this.clean(dto.website),
          addressLine1: this.clean(dto.addressLine1),
          addressLine2: this.clean(dto.addressLine2),
          city: this.clean(dto.city),
          province: this.clean(dto.province),
          country: this.clean(dto.country),
          postalCode: this.clean(dto.postalCode),

          standardClockInTime: this.cleanRequired(dto.standardClockInTime),
          standardClockOutTime: this.cleanRequired(dto.standardClockOutTime),
          lateClockInThresholdMinutes: dto.lateClockInThresholdMinutes,
          defaultWorkingHoursPerDay: dto.defaultWorkingHoursPerDay,
          leaveYearStartMonth: dto.leaveYearStartMonth,
          defaultAnnualLeaveDays: dto.defaultAnnualLeaveDays,
          sickLeaveCycleDays: dto.sickLeaveCycleDays,
          sickLeaveDocumentThresholdDays: dto.sickLeaveDocumentThresholdDays,
          autoMarkMissedClockOut: dto.autoMarkMissedClockOut,
          attendanceWorkingDays: dto.attendanceWorkingDays,
          attendanceGracePeriodMinutes: dto.attendanceGracePeriodMinutes,
          allowEarlyClockIn: dto.allowEarlyClockIn,
          allowEarlyClockOut: dto.allowEarlyClockOut,
          requireLateAttendanceNote: dto.requireLateAttendanceNote,
          requireEarlyClockOutNote: dto.requireEarlyClockOutNote,
          managersMayEditAttendance: dto.managersMayEditAttendance,
          attendanceCorrectionsRequireApproval:
            dto.attendanceCorrectionsRequireApproval,
        },
        select: this.organisationSelect(),
      });
      const attendancePolicyChanged = [
        'standardClockInTime',
        'standardClockOutTime',
        'lateClockInThresholdMinutes',
        'defaultWorkingHoursPerDay',
        'attendanceWorkingDays',
        'attendanceGracePeriodMinutes',
        'allowEarlyClockIn',
        'allowEarlyClockOut',
        'requireLateAttendanceNote',
        'requireEarlyClockOutNote',
        'managersMayEditAttendance',
        'attendanceCorrectionsRequireApproval',
      ].some((key) => dto[key as keyof UpdateOrganisationDto] !== undefined);
      if (attendancePolicyChanged) {
        await transaction.auditLog.create({
          data: {
            organisationId: user.organisationId,
            actorUserId: user.id,
            action: AuditAction.UPDATE,
            entity: 'AttendancePolicy',
            entityId: user.organisationId,
            message: 'Organisation attendance policy updated.',
          },
        });
      }
      return updated;
    });
  }

  private clean(value?: string) {
    if (value === undefined) {
      return undefined;
    }

    const cleaned = value.trim();

    return cleaned.length > 0 ? cleaned : null;
  }

  private cleanRequired(value?: string) {
    if (value === undefined) {
      return undefined;
    }

    const cleaned = value.trim();

    return cleaned.length > 0 ? cleaned : undefined;
  }

  private isValidTime(value: string) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(value.trim());
  }

  private timeToMinutes(value: string) {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private organisationSelect() {
    return {
      id: true,
      name: true,
      slug: true,
      email: true,
      phone: true,
      website: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      province: true,
      country: true,
      postalCode: true,

      standardClockInTime: true,
      standardClockOutTime: true,
      lateClockInThresholdMinutes: true,
      defaultWorkingHoursPerDay: true,
      leaveYearStartMonth: true,
      defaultAnnualLeaveDays: true,
      sickLeaveCycleDays: true,
      sickLeaveDocumentThresholdDays: true,
      autoMarkMissedClockOut: true,
      attendanceWorkingDays: true,
      attendanceGracePeriodMinutes: true,
      allowEarlyClockIn: true,
      allowEarlyClockOut: true,
      requireLateAttendanceNote: true,
      requireEarlyClockOutNote: true,
      managersMayEditAttendance: true,
      attendanceCorrectionsRequireApproval: true,

      createdAt: true,
      updatedAt: true,
    };
  }
}
