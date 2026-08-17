import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  EmployeeNotificationCategory,
  LeaveStatus,
  LeaveType,
  Prisma,
} from '@prisma/client';
import { AccessScopeService } from '../auth/access-scope.service';
import type { CurrentUser } from '../auth/types/current-user.type';
import { PrismaService } from '../database/prisma.service';
import { EmployeeNotificationService } from '../employee-self-service/employee-notification.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { RejectLeaveRequestDto } from './dto/reject-leave-request.dto';
import { UpdateLeaveRequestDto } from './dto/update-leave-request.dto';

type CreateMyLeaveRequestDto = Omit<CreateLeaveRequestDto, 'employeeId'>;

type OrganisationLeavePolicy = {
  defaultAnnualLeaveDays: number;
  sickLeaveCycleDays: number;
  sickLeaveDocumentThresholdDays: number;
  leaveYearStartMonth: number;
};

const leaveTypesThatRequireDocuments: LeaveType[] = [
  LeaveType.FAMILY_RESPONSIBILITY,
  LeaveType.MATERNITY,
  LeaveType.PATERNITY,
  LeaveType.STUDY,
];

const fallbackLeavePolicyLimits: Record<LeaveType, number> = {
  [LeaveType.ANNUAL]: 15,
  [LeaveType.SICK]: 30,
  [LeaveType.FAMILY_RESPONSIBILITY]: 3,
  [LeaveType.MATERNITY]: 120,
  [LeaveType.PATERNITY]: 10,
  [LeaveType.STUDY]: 0,
  [LeaveType.UNPAID]: 0,
  [LeaveType.OTHER]: 0,
};

const leaveTypesWithHardLimits: LeaveType[] = [
  LeaveType.ANNUAL,
  LeaveType.SICK,
  LeaveType.FAMILY_RESPONSIBILITY,
  LeaveType.MATERNITY,
  LeaveType.PATERNITY,
];

@Injectable()
export class LeaveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: EmployeeNotificationService,
    private readonly accessScope: AccessScopeService,
  ) {}

  async findAll(user: CurrentUser) {
    const employeeScope = await this.accessScope.employeeWhere(user);

    return this.prisma.leaveRequest.findMany({
      where: {
        organisationId: user.organisationId,
        employee: employeeScope,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: this.leaveRequestInclude(),
    });
  }

  async findMyLeave(user: CurrentUser) {
    const employee = await this.getLinkedEmployee(user);

    return this.prisma.leaveRequest.findMany({
      where: {
        organisationId: user.organisationId,
        employeeId: employee.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: this.leaveRequestInclude(),
    });
  }

  async createMyLeave(user: CurrentUser, dto: CreateMyLeaveRequestDto) {
    const employee = await this.getLinkedEmployee(user);
    const leaveType = dto.leaveType as LeaveType;
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    this.validateDateRange(startDate, endDate);
    const totalDays = this.calculateLeaveDays(startDate, endDate);
    const policy = await this.getLeavePolicy(user.organisationId);

    this.validateSupportingDocumentPolicy({
      leaveType,
      totalDays,
      hasDocument: false,
      policy,
    });

    await this.validateLeaveBalance({
      organisationId: user.organisationId,
      employeeId: employee.id,
      leaveType,
      requestedDays: totalDays,
      policy,
    });

    const leaveRequest = await this.prisma.leaveRequest.create({
      data: {
        organisationId: user.organisationId,
        employeeId: employee.id,
        leaveType,
        startDate,
        endDate,
        totalDays,
        reason: dto.reason,
      },
      include: this.leaveRequestInclude(),
    });

    await this.prisma.auditLog.create({
      data: {
        organisationId: user.organisationId,
        actorUserId: user.id,
        employeeId: employee.id,
        action: AuditAction.CREATE,
        entity: 'LeaveRequest',
        entityId: leaveRequest.id,
        message: `Employee ${employee.firstName} ${employee.lastName} submitted a leave request.`,
        metadata: {
          leaveType,
          startDate: dto.startDate,
          endDate: dto.endDate,
          totalDays,
          hasDocument: false,
        },
      },
    });

    return leaveRequest;
  }

  async createMyLeaveWithDocument(
    user: CurrentUser,
    dto: CreateMyLeaveRequestDto,
    file?: Express.Multer.File,
  ) {
    const employee = await this.getLinkedEmployee(user);
    const leaveType = dto.leaveType as LeaveType;
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    this.validateDateRange(startDate, endDate);
    const totalDays = this.calculateLeaveDays(startDate, endDate);
    const policy = await this.getLeavePolicy(user.organisationId);

    this.validateSupportingDocumentPolicy({
      leaveType,
      totalDays,
      hasDocument: Boolean(file),
      policy,
    });

    await this.validateLeaveBalance({
      organisationId: user.organisationId,
      employeeId: employee.id,
      leaveType,
      requestedDays: totalDays,
      policy,
    });

    const leaveRequest = await this.prisma.leaveRequest.create({
      data: {
        organisationId: user.organisationId,
        employeeId: employee.id,
        leaveType,
        startDate,
        endDate,
        totalDays,
        reason: dto.reason,
      },
      include: this.leaveRequestInclude(),
    });

    if (file) {
      const leaveDocument = await this.prisma.leaveDocument.create({
        data: {
          organisationId: user.organisationId,
          employeeId: employee.id,
          leaveRequestId: leaveRequest.id,
          fileName: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          storageKey: `leave-documents/${file.filename}`,
        },
      });

      await this.prisma.auditLog.create({
        data: {
          organisationId: user.organisationId,
          actorUserId: user.id,
          employeeId: employee.id,
          action: AuditAction.UPLOAD,
          entity: 'LeaveDocument',
          entityId: leaveDocument.id,
          message: `Supporting document uploaded for ${this.formatLeaveType(leaveType)}.`,
          metadata: {
            leaveRequestId: leaveRequest.id,
            originalName: file.originalname,
            mimeType: file.mimetype,
            sizeBytes: file.size,
          },
        },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        organisationId: user.organisationId,
        actorUserId: user.id,
        employeeId: employee.id,
        action: AuditAction.CREATE,
        entity: 'LeaveRequest',
        entityId: leaveRequest.id,
        message: `Employee ${employee.firstName} ${employee.lastName} submitted a leave request.`,
        metadata: {
          leaveType,
          startDate: dto.startDate,
          endDate: dto.endDate,
          totalDays,
          hasDocument: Boolean(file),
        },
      },
    });

    return this.findOne(user, leaveRequest.id);
  }

  async findOne(user: CurrentUser, id: string) {
    const employeeScope = await this.accessScope.employeeWhere(user);
    const leaveRequest = await this.prisma.leaveRequest.findFirst({
      where: {
        id,
        organisationId: user.organisationId,
        employee: employeeScope,
      },
      include: this.leaveRequestInclude(),
    });

    if (!leaveRequest) {
      throw new NotFoundException('Leave request not found.');
    }

    return leaveRequest;
  }

  async findLeaveDocumentForDownload(user: CurrentUser, documentId: string) {
    const document = await this.prisma.leaveDocument.findFirst({
      where: {
        id: documentId,
        organisationId: user.organisationId,
      },
      include: {
        leaveRequest: {
          select: {
            id: true,
            leaveType: true,
            status: true,
            employeeId: true,
          },
        },
        employee: {
          select: {
            id: true,
            userId: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('Leave document not found.');
    }

    const isEmployeeOwner = document.employee.userId === user.id;
    const canManageLeave =
      user.roles.includes('SUPER_ADMIN') ||
      user.roles.includes('ORG_ADMIN') ||
      user.roles.includes('HR_MANAGER') ||
      user.roles.includes('MANAGER');

    if (canManageLeave) {
      await this.accessScope.assertEmployeeAccess(user, document.employeeId);
    } else if (!isEmployeeOwner) {
      throw new BadRequestException('You cannot access this document.');
    }

    await this.prisma.auditLog.create({
      data: {
        organisationId: user.organisationId,
        actorUserId: user.id,
        employeeId: document.employeeId,
        action: AuditAction.DOWNLOAD,
        entity: 'LeaveDocument',
        entityId: document.id,
        message: `Leave document downloaded: ${document.originalName}.`,
        metadata: {
          leaveRequestId: document.leaveRequestId,
          originalName: document.originalName,
          mimeType: document.mimeType,
          sizeBytes: document.sizeBytes,
        },
      },
    });

    return document;
  }

  async create(user: CurrentUser, dto: CreateLeaveRequestDto) {
    await this.accessScope.assertEmployeeAccess(user, dto.employeeId);
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: dto.employeeId,
        organisationId: user.organisationId,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    const leaveType = dto.leaveType as LeaveType;
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    this.validateDateRange(startDate, endDate);
    const totalDays = this.calculateLeaveDays(startDate, endDate);
    const policy = await this.getLeavePolicy(user.organisationId);

    await this.validateLeaveBalance({
      organisationId: user.organisationId,
      employeeId: dto.employeeId,
      leaveType,
      requestedDays: totalDays,
      policy,
    });

    const leaveRequest = await this.prisma.leaveRequest.create({
      data: {
        organisationId: user.organisationId,
        employeeId: dto.employeeId,
        leaveType,
        startDate,
        endDate,
        totalDays,
        reason: dto.reason,
      },
      include: this.leaveRequestInclude(),
    });

    await this.prisma.auditLog.create({
      data: {
        organisationId: user.organisationId,
        actorUserId: user.id,
        employeeId: dto.employeeId,
        action: AuditAction.CREATE,
        entity: 'LeaveRequest',
        entityId: leaveRequest.id,
        message: `Leave request created for ${employee.firstName} ${employee.lastName}.`,
        metadata: {
          leaveType,
          startDate: dto.startDate,
          endDate: dto.endDate,
          totalDays,
        },
      },
    });

    return leaveRequest;
  }

  async update(user: CurrentUser, id: string, dto: UpdateLeaveRequestDto) {
    const employeeScope = await this.accessScope.employeeWhere(user);
    const existing = await this.prisma.leaveRequest.findFirst({
      where: {
        id,
        organisationId: user.organisationId,
        employee: employeeScope,
      },
    });

    if (!existing) {
      throw new NotFoundException('Leave request not found.');
    }

    if (existing.status !== LeaveStatus.PENDING) {
      throw new BadRequestException('Only pending leave requests can be updated.');
    }

    const leaveType = (dto.leaveType ?? existing.leaveType) as LeaveType;
    const startDate = dto.startDate ? new Date(dto.startDate) : existing.startDate;
    const endDate = dto.endDate ? new Date(dto.endDate) : existing.endDate;
    this.validateDateRange(startDate, endDate);
    const totalDays = this.calculateLeaveDays(startDate, endDate);
    const policy = await this.getLeavePolicy(user.organisationId);

    await this.validateLeaveBalance({
      organisationId: user.organisationId,
      employeeId: existing.employeeId,
      leaveType,
      requestedDays: totalDays,
      excludeLeaveRequestId: existing.id,
      policy,
    });

    const leaveRequest = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        leaveType,
        startDate,
        endDate,
        totalDays,
        reason: dto.reason ?? existing.reason,
      },
      include: this.leaveRequestInclude(),
    });

    await this.prisma.auditLog.create({
      data: {
        organisationId: user.organisationId,
        actorUserId: user.id,
        employeeId: existing.employeeId,
        action: AuditAction.UPDATE,
        entity: 'LeaveRequest',
        entityId: leaveRequest.id,
        message: 'Leave request updated.',
        metadata: {
          leaveType: leaveRequest.leaveType,
          startDate: leaveRequest.startDate,
          endDate: leaveRequest.endDate,
          totalDays: leaveRequest.totalDays,
        },
      },
    });

    return leaveRequest;
  }

  async approve(user: CurrentUser, id: string) {
    const employeeScope = await this.accessScope.employeeWhere(user);
    const existing = await this.prisma.leaveRequest.findFirst({
      where: {
        id,
        organisationId: user.organisationId,
        employee: employeeScope,
      },
    });

    if (!existing) {
      throw new NotFoundException('Leave request not found.');
    }

    if (existing.status !== LeaveStatus.PENDING) {
      throw new BadRequestException('Only pending leave requests can be approved.');
    }

    const leaveRequest = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: LeaveStatus.APPROVED,
        approvedByUserId: user.id,
        approvedAt: new Date(),
        rejectionNote: null,
      },
      include: this.leaveRequestInclude(),
    });

    await this.prisma.auditLog.create({
      data: {
        organisationId: user.organisationId,
        actorUserId: user.id,
        employeeId: existing.employeeId,
        action: AuditAction.APPROVE,
        entity: 'LeaveRequest',
        entityId: leaveRequest.id,
        message: 'Leave request approved.',
      },
    });

    await this.notifications.notifyEmployee({
      organisationId: user.organisationId,
      employeeId: existing.employeeId,
      category: EmployeeNotificationCategory.LEAVE,
      title: 'Leave request approved',
      message: 'Your leave request has been approved.',
      href: '/employee/leave',
    });

    return leaveRequest;
  }

  async reject(user: CurrentUser, id: string, dto: RejectLeaveRequestDto) {
    const employeeScope = await this.accessScope.employeeWhere(user);
    const existing = await this.prisma.leaveRequest.findFirst({
      where: {
        id,
        organisationId: user.organisationId,
        employee: employeeScope,
      },
    });

    if (!existing) {
      throw new NotFoundException('Leave request not found.');
    }

    if (existing.status !== LeaveStatus.PENDING) {
      throw new BadRequestException('Only pending leave requests can be rejected.');
    }

    const leaveRequest = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: LeaveStatus.REJECTED,
        approvedByUserId: user.id,
        approvedAt: new Date(),
        rejectionNote: dto.rejectionNote,
      },
      include: this.leaveRequestInclude(),
    });

    await this.prisma.auditLog.create({
      data: {
        organisationId: user.organisationId,
        actorUserId: user.id,
        employeeId: existing.employeeId,
        action: AuditAction.REJECT,
        entity: 'LeaveRequest',
        entityId: leaveRequest.id,
        message: 'Leave request rejected.',
        metadata: { rejectionNote: dto.rejectionNote },
      },
    });

    await this.notifications.notifyEmployee({
      organisationId: user.organisationId,
      employeeId: existing.employeeId,
      category: EmployeeNotificationCategory.LEAVE,
      title: 'Leave request rejected',
      message: `Your leave request was rejected. ${dto.rejectionNote}`,
      href: '/employee/leave',
    });

    return leaveRequest;
  }

  async cancel(user: CurrentUser, id: string) {
    const employee = await this.getLinkedEmployee(user);
    const existing = await this.prisma.leaveRequest.findFirst({
      where: {
        id,
        organisationId: user.organisationId,
        employeeId: employee.id,
      },
    });

    if (!existing) {
      throw new NotFoundException('Leave request not found.');
    }

    if (existing.status !== LeaveStatus.PENDING) {
      throw new BadRequestException('Only pending leave requests can be cancelled.');
    }

    const leaveRequest = await this.prisma.leaveRequest.update({
      where: { id },
      data: { status: LeaveStatus.CANCELLED },
      include: this.leaveRequestInclude(),
    });

    await this.prisma.auditLog.create({
      data: {
        organisationId: user.organisationId,
        actorUserId: user.id,
        employeeId: existing.employeeId,
        action: AuditAction.UPDATE,
        entity: 'LeaveRequest',
        entityId: leaveRequest.id,
        message: 'Leave request cancelled.',
      },
    });

    return leaveRequest;
  }

  private async getLinkedEmployee(user: CurrentUser) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        organisationId: user.organisationId,
        userId: user.id,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee profile not found.');
    }

    return employee;
  }

  private async validateLeaveBalance({
    organisationId,
    employeeId,
    leaveType,
    requestedDays,
    excludeLeaveRequestId,
    policy,
  }: {
    organisationId: string;
    employeeId: string;
    leaveType: LeaveType;
    requestedDays: number;
    excludeLeaveRequestId?: string;
    policy: OrganisationLeavePolicy;
  }) {
    if (!leaveTypesWithHardLimits.includes(leaveType)) return;
    const allocatedDays = this.getAllocatedLeaveDays(leaveType, policy);
    if (allocatedDays <= 0) return;

    const existingLeaveRequests = await this.prisma.leaveRequest.findMany({
      where: {
        organisationId,
        employeeId,
        leaveType,
        id: excludeLeaveRequestId ? { not: excludeLeaveRequestId } : undefined,
        status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
      },
      select: { totalDays: true },
    });

    const usedOrReservedDays = existingLeaveRequests.reduce(
      (total, request) => total + Number(request.totalDays),
      0,
    );
    const availableDays = allocatedDays - usedOrReservedDays;

    if (requestedDays > availableDays) {
      throw new BadRequestException(
        `You only have ${Math.max(availableDays, 0)} day${availableDays === 1 ? '' : 's'} available for ${this.formatLeaveType(leaveType)}.`,
      );
    }
  }

  private async getLeavePolicy(
    organisationId: string,
  ): Promise<OrganisationLeavePolicy> {
    const organisation = await this.prisma.organisation.findUnique({
      where: { id: organisationId },
      select: {
        defaultAnnualLeaveDays: true,
        sickLeaveCycleDays: true,
        sickLeaveDocumentThresholdDays: true,
        leaveYearStartMonth: true,
      },
    });

    return {
      defaultAnnualLeaveDays: organisation?.defaultAnnualLeaveDays ?? 15,
      sickLeaveCycleDays: organisation?.sickLeaveCycleDays ?? 30,
      sickLeaveDocumentThresholdDays:
        organisation?.sickLeaveDocumentThresholdDays ?? 2,
      leaveYearStartMonth: organisation?.leaveYearStartMonth ?? 1,
    };
  }

  private getAllocatedLeaveDays(
    leaveType: LeaveType,
    policy: OrganisationLeavePolicy,
  ) {
    if (leaveType === LeaveType.ANNUAL) return policy.defaultAnnualLeaveDays;
    if (leaveType === LeaveType.SICK) return policy.sickLeaveCycleDays;
    return fallbackLeavePolicyLimits[leaveType];
  }

  private validateSupportingDocumentPolicy({
    leaveType,
    totalDays,
    hasDocument,
    policy,
  }: {
    leaveType: LeaveType;
    totalDays: number;
    hasDocument: boolean;
    policy: OrganisationLeavePolicy;
  }) {
    const requiresDocument = this.leaveTypeRequiresDocument({
      leaveType,
      totalDays,
      policy,
    });

    if (!requiresDocument || hasDocument) return;

    if (leaveType === LeaveType.SICK) {
      throw new BadRequestException(
        `Sick leave of ${totalDays} day${totalDays === 1 ? '' : 's'} requires a supporting document. Current policy requires a sick note after ${policy.sickLeaveDocumentThresholdDays} day${policy.sickLeaveDocumentThresholdDays === 1 ? '' : 's'}.`,
      );
    }

    throw new BadRequestException(
      `${this.formatLeaveType(leaveType)} requires a supporting document.`,
    );
  }

  private leaveTypeRequiresDocument({
    leaveType,
    totalDays,
    policy,
  }: {
    leaveType: LeaveType;
    totalDays: number;
    policy: OrganisationLeavePolicy;
  }) {
    if (leaveType === LeaveType.SICK) {
      return totalDays >= policy.sickLeaveDocumentThresholdDays;
    }
    return leaveTypesThatRequireDocuments.includes(leaveType);
  }

  private validateDateRange(startDate: Date, endDate: Date) {
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid leave date range.');
    }
    if (endDate < startDate) {
      throw new BadRequestException('End date cannot be before start date.');
    }
  }

  private calculateLeaveDays(startDate: Date, endDate: Date) {
    const millisecondsPerDay = 1000 * 60 * 60 * 24;
    const start = Date.UTC(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate(),
    );
    const end = Date.UTC(
      endDate.getFullYear(),
      endDate.getMonth(),
      endDate.getDate(),
    );
    return Math.floor((end - start) / millisecondsPerDay) + 1;
  }

  private formatLeaveType(leaveType: LeaveType) {
    return leaveType
      .split('_')
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  }

  private leaveRequestInclude(): Prisma.LeaveRequestInclude {
    return {
      documents: true,
      employee: {
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          email: true,
          jobTitle: true,
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      approvedBy: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    };
  }
}
