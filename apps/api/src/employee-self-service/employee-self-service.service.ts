import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  EmployeeNotificationCategory,
  EmployeeProfileChangeField,
  ProfileChangeRequestStatus,
} from '@prisma/client';
import type { CurrentUser } from '../auth/types/current-user.type';
import { PrismaService } from '../database/prisma.service';
import { CreateProfileChangeRequestDto } from './dto/create-profile-change-request.dto';
import { ReviewProfileChangeRequestDto } from './dto/review-profile-change-request.dto';
import { EmployeeContextService } from './employee-context.service';

@Injectable()
export class EmployeeSelfServiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employeeContext: EmployeeContextService,
  ) {}

  async getProfile(user: CurrentUser) {
    const employee = await this.employeeContext.resolve(user);
    return {
      ...employee,
      compensationProfile: employee.compensationProfile
        ? {
            bankName: employee.compensationProfile.bankName,
            bankAccountNumber: this.maskAccountNumber(
              employee.compensationProfile.bankAccountNumber,
            ),
          }
        : null,
    };
  }

  async createProfileChangeRequest(
    user: CurrentUser,
    dto: CreateProfileChangeRequestDto,
  ) {
    const employee = await this.employeeContext.resolve(user);
    const currentValue = this.getCurrentValue(employee, dto.field);
    const requestedValue = dto.requestedValue.trim();

    if (!requestedValue) {
      throw new BadRequestException('The requested value cannot be empty.');
    }

    const existing = await this.prisma.employeeProfileChangeRequest.findFirst({
      where: {
        organisationId: user.organisationId,
        employeeId: employee.id,
        field: dto.field,
        status: ProfileChangeRequestStatus.PENDING,
      },
    });

    if (existing) {
      throw new ConflictException(
        'A pending request already exists for this profile field.',
      );
    }

    const request = await this.prisma.employeeProfileChangeRequest.create({
      data: {
        organisationId: user.organisationId,
        employeeId: employee.id,
        requestedByUserId: user.id,
        field: dto.field,
        currentValue: this.isBankAccount(dto.field)
          ? this.maskAccountNumber(currentValue)
          : currentValue,
        requestedValue,
        reason: dto.reason.trim(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organisationId: user.organisationId,
        actorUserId: user.id,
        employeeId: employee.id,
        action: AuditAction.CREATE,
        entity: 'EmployeeProfileChangeRequest',
        entityId: request.id,
        message: `Profile change requested for ${dto.field}.`,
      },
    });

    return this.sanitiseRequest(request);
  }

  async getMyProfileChangeRequests(user: CurrentUser) {
    const employee = await this.employeeContext.resolve(user);
    const requests = await this.prisma.employeeProfileChangeRequest.findMany({
      where: {
        organisationId: user.organisationId,
        employeeId: employee.id,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        reviewer: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
    return requests.map((request) => this.sanitiseRequest(request));
  }

  async cancelProfileChangeRequest(user: CurrentUser, requestId: string) {
    const employee = await this.employeeContext.resolve(user);
    const request = await this.prisma.employeeProfileChangeRequest.findFirst({
      where: {
        id: requestId,
        organisationId: user.organisationId,
        employeeId: employee.id,
      },
    });

    if (!request) throw new NotFoundException('Profile change request not found.');
    if (request.status !== ProfileChangeRequestStatus.PENDING) {
      throw new ConflictException('Only pending requests can be cancelled.');
    }

    return this.prisma.employeeProfileChangeRequest.update({
      where: { id: request.id },
      data: { status: ProfileChangeRequestStatus.CANCELLED },
    });
  }

  getProfileChangeRequests(user: CurrentUser) {
    return this.prisma.employeeProfileChangeRequest.findMany({
      where: { organisationId: user.organisationId },
      orderBy: { createdAt: 'desc' },
      include: {
        employee: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
          },
        },
        reviewer: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async reviewProfileChangeRequest(
    user: CurrentUser,
    requestId: string,
    dto: ReviewProfileChangeRequestDto,
  ) {
    const request = await this.prisma.employeeProfileChangeRequest.findFirst({
      where: { id: requestId, organisationId: user.organisationId },
      include: { employee: true },
    });

    if (!request) throw new NotFoundException('Profile change request not found.');
    if (request.status !== ProfileChangeRequestStatus.PENDING) {
      throw new ConflictException('This request has already been reviewed.');
    }

    const approved = dto.decision === 'APPROVED';
    const result = await this.prisma.$transaction(async (tx) => {
      if (approved) {
        await this.applyApprovedValue(
          tx,
          request.employeeId,
          request.organisationId,
          request.field,
          request.requestedValue,
        );
      }

      const updated = await tx.employeeProfileChangeRequest.update({
        where: { id: request.id },
        data: {
          status: approved
            ? ProfileChangeRequestStatus.APPROVED
            : ProfileChangeRequestStatus.REJECTED,
          reviewerUserId: user.id,
          reviewComments: dto.comments?.trim(),
          reviewedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          organisationId: user.organisationId,
          actorUserId: user.id,
          employeeId: request.employeeId,
          action: approved ? AuditAction.APPROVE : AuditAction.REJECT,
          entity: 'EmployeeProfileChangeRequest',
          entityId: request.id,
          message: `Profile change request ${dto.decision.toLowerCase()}.`,
        },
      });

      if (request.employee.userId) {
        await tx.employeeNotification.create({
          data: {
            organisationId: user.organisationId,
            userId: request.employee.userId,
            category: EmployeeNotificationCategory.PROFILE,
            title: `Profile request ${dto.decision.toLowerCase()}`,
            message: `Your request to change ${request.field.toLowerCase().replaceAll('_', ' ')} was ${dto.decision.toLowerCase()}.`,
            href: '/employee/profile',
          },
        });
      }

      return updated;
    });

    return this.sanitiseRequest(result);
  }

  async getNotifications(user: CurrentUser) {
    await this.employeeContext.resolve(user);
    const notifications = await this.prisma.employeeNotification.findMany({
      where: { organisationId: user.organisationId, userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return {
      unreadCount: notifications.filter((item) => !item.readAt).length,
      notifications,
    };
  }

  async markNotificationRead(user: CurrentUser, notificationId: string) {
    const result = await this.prisma.employeeNotification.updateMany({
      where: {
        id: notificationId,
        organisationId: user.organisationId,
        userId: user.id,
      },
      data: { readAt: new Date() },
    });
    if (!result.count) throw new NotFoundException('Notification not found.');
    return { success: true };
  }

  async markAllNotificationsRead(user: CurrentUser) {
    const result = await this.prisma.employeeNotification.updateMany({
      where: {
        organisationId: user.organisationId,
        userId: user.id,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  private getCurrentValue(employee: any, field: EmployeeProfileChangeField) {
    const values: Record<EmployeeProfileChangeField, string | null | undefined> = {
      PERSONAL_EMAIL: employee.personalEmail,
      PHONE: employee.phone,
      PREFERRED_NAME: employee.preferredName,
      RESIDENTIAL_ADDRESS: employee.residentialAddress,
      EMERGENCY_CONTACT_NAME: employee.emergencyContactName,
      EMERGENCY_CONTACT_PHONE: employee.emergencyContactPhone,
      EMERGENCY_CONTACT_RELATION: employee.emergencyContactRelation,
      BANK_NAME: employee.compensationProfile?.bankName,
      BANK_ACCOUNT_NUMBER: employee.compensationProfile?.bankAccountNumber,
    };
    return values[field] ?? null;
  }

  private async applyApprovedValue(
    tx: any,
    employeeId: string,
    organisationId: string,
    field: EmployeeProfileChangeField,
    value: string,
  ) {
    if (field === EmployeeProfileChangeField.BANK_NAME || this.isBankAccount(field)) {
      await tx.employeeCompensationProfile.upsert({
        where: { employeeId },
        update:
          field === EmployeeProfileChangeField.BANK_NAME
            ? { bankName: value }
            : { bankAccountNumber: value },
        create: {
          organisationId,
          employeeId,
          ...(field === EmployeeProfileChangeField.BANK_NAME
            ? { bankName: value }
            : { bankAccountNumber: value }),
        },
      });
      return;
    }

    const fieldMap: Record<string, string> = {
      PERSONAL_EMAIL: 'personalEmail',
      PHONE: 'phone',
      PREFERRED_NAME: 'preferredName',
      RESIDENTIAL_ADDRESS: 'residentialAddress',
      EMERGENCY_CONTACT_NAME: 'emergencyContactName',
      EMERGENCY_CONTACT_PHONE: 'emergencyContactPhone',
      EMERGENCY_CONTACT_RELATION: 'emergencyContactRelation',
    };
    await tx.employee.update({
      where: { id: employeeId },
      data: { [fieldMap[field]]: value },
    });
  }

  private isBankAccount(field: EmployeeProfileChangeField) {
    return field === EmployeeProfileChangeField.BANK_ACCOUNT_NUMBER;
  }

  private maskAccountNumber(value?: string | null) {
    if (!value) return null;
    return `•••• ${value.slice(-4)}`;
  }

  private sanitiseRequest<T extends { field: EmployeeProfileChangeField; requestedValue: string }>(request: T) {
    return this.isBankAccount(request.field)
      ? { ...request, requestedValue: this.maskAccountNumber(request.requestedValue) }
      : request;
  }
}
