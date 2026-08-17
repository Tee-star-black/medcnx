import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  EmployeeDocumentCategory,
  EmployeeNotificationCategory,
} from '@prisma/client';
import type { CurrentUser } from '../auth/types/current-user.type';
import { PrismaService } from '../database/prisma.service';
import { EmployeeNotificationService } from '../employee-self-service/employee-notification.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { UploadEmployeeDocumentDto } from './dto/upload-employee-document.dto';
import { UpdateEmployeeDocumentDto } from './dto/update-employee-document.dto';

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: EmployeeNotificationService,
  ) {}

  async findAll(user: CurrentUser) {
    return this.prisma.employee.findMany({
      where: {
        organisationId: user.organisationId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async findMe(user: CurrentUser) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        organisationId: user.organisationId,
        userId: user.id,
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            status: true,
          },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee profile not found.');
    }

    return employee;
  }

  async findOne(user: CurrentUser, id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        id,
        organisationId: user.organisationId,
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            status: true,
          },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    return employee;
  }

  async create(user: CurrentUser, dto: CreateEmployeeDto) {
    await this.validateEmployeeNumberIsUnique(
      user.organisationId,
      dto.employeeNumber,
    );

    if (dto.email) {
      await this.validateEmailIsUnique(user.organisationId, dto.email);
    }

    if (dto.departmentId) {
      await this.validateDepartmentBelongsToOrganisation(
        user.organisationId,
        dto.departmentId,
      );
    }

    const employee = await this.prisma.employee.create({
      data: {
        organisationId: user.organisationId,
        employeeNumber: dto.employeeNumber,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        departmentId: dto.departmentId,
        jobTitle: dto.jobTitle,
        employmentType: dto.employmentType,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        idNumber: dto.idNumber,
        passportNumber: dto.passportNumber,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        gender: dto.gender,
        nationality: dto.nationality,
        emergencyContactName: dto.emergencyContactName,
        emergencyContactPhone: dto.emergencyContactPhone,
        emergencyContactRelation: dto.emergencyContactRelation,
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organisationId: user.organisationId,
        actorUserId: user.id,
        employeeId: employee.id,
        action: AuditAction.CREATE,
        entity: 'Employee',
        entityId: employee.id,
        message: `Employee ${employee.firstName} ${employee.lastName} created.`,
      },
    });

    return employee;
  }

  async update(user: CurrentUser, id: string, dto: UpdateEmployeeDto) {
    const existingEmployee = await this.prisma.employee.findFirst({
      where: {
        id,
        organisationId: user.organisationId,
      },
    });

    if (!existingEmployee) {
      throw new NotFoundException('Employee not found.');
    }

    if (
      dto.employeeNumber &&
      dto.employeeNumber !== existingEmployee.employeeNumber
    ) {
      await this.validateEmployeeNumberIsUnique(
        user.organisationId,
        dto.employeeNumber,
        id,
      );
    }

    if (dto.email && dto.email !== existingEmployee.email) {
      await this.validateEmailIsUnique(user.organisationId, dto.email, id);
    }

    if (dto.departmentId) {
      await this.validateDepartmentBelongsToOrganisation(
        user.organisationId,
        dto.departmentId,
      );
    }

    const employee = await this.prisma.employee.update({
      where: {
        id,
      },
      data: {
        employeeNumber: dto.employeeNumber,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        departmentId: dto.departmentId,
        jobTitle: dto.jobTitle,
        employmentType: dto.employmentType,
        employmentStatus: dto.employmentStatus,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        idNumber: dto.idNumber,
        passportNumber: dto.passportNumber,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        gender: dto.gender,
        nationality: dto.nationality,
        emergencyContactName: dto.emergencyContactName,
        emergencyContactPhone: dto.emergencyContactPhone,
        emergencyContactRelation: dto.emergencyContactRelation,
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            status: true,
          },
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organisationId: user.organisationId,
        actorUserId: user.id,
        employeeId: employee.id,
        action: AuditAction.UPDATE,
        entity: 'Employee',
        entityId: employee.id,
        message: `Employee ${employee.firstName} ${employee.lastName} updated.`,
      },
    });

    return employee;
  }

  async remove(user: CurrentUser, id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        id,
        organisationId: user.organisationId,
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    await this.prisma.employee.delete({
      where: {
        id,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organisationId: user.organisationId,
        actorUserId: user.id,
        action: AuditAction.DELETE,
        entity: 'Employee',
        entityId: employee.id,
        message: `Employee ${employee.firstName} ${employee.lastName} deleted.`,
      },
    });

    return {
      message: 'Employee deleted successfully.',
    };
  }

  async findAllEmployeeDocuments(user: CurrentUser) {
    return this.prisma.employeeDocument.findMany({
      where: {
        organisationId: user.organisationId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
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
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  async findEmployeeDocuments(user: CurrentUser, employeeId: string) {
    await this.validateEmployeeBelongsToOrganisation(
      user.organisationId,
      employeeId,
    );

    return this.prisma.employeeDocument.findMany({
      where: {
        organisationId: user.organisationId,
        employeeId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  async findMyDocuments(user: CurrentUser) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        organisationId: user.organisationId,
        userId: user.id,
      },
      select: {
        id: true,
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee profile not found.');
    }

    return this.prisma.employeeDocument.findMany({
      where: {
        organisationId: user.organisationId,
        employeeId: employee.id,
        visibleToEmployee: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async uploadEmployeeDocument(
    user: CurrentUser,
    employeeId: string,
    dto: UploadEmployeeDocumentDto,
    file?: Express.Multer.File,
  ) {
    const employee = await this.validateEmployeeBelongsToOrganisation(
      user.organisationId,
      employeeId,
    );

    if (!file) {
      throw new NotFoundException('Document file is required.');
    }

    const document = await this.prisma.employeeDocument.create({
      data: {
        organisationId: user.organisationId,
        employeeId: employee.id,
        category: dto.category ?? EmployeeDocumentCategory.OTHER,
        title: dto.title,
        description: dto.description,
        fileName: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storageKey: `employee-documents/${file.filename}`,
        isConfidential: dto.isConfidential === 'true',
        visibleToEmployee: dto.visibleToEmployee !== 'false',
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
        uploadedByUserId: user.id,
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organisationId: user.organisationId,
        actorUserId: user.id,
        employeeId: employee.id,
        action: AuditAction.UPLOAD,
        entity: 'EmployeeDocument',
        entityId: document.id,
        message: `Employee document uploaded: ${document.title}.`,
        metadata: {
          category: document.category,
          originalName: document.originalName,
          mimeType: document.mimeType,
          sizeBytes: document.sizeBytes,
          visibleToEmployee: document.visibleToEmployee,
          isConfidential: document.isConfidential,
        },
      },
    });

    if (document.visibleToEmployee) {
      await this.notifications.notifyEmployee({
        organisationId: user.organisationId,
        employeeId: employee.id,
        category: EmployeeNotificationCategory.DOCUMENT,
        title: 'New document available',
        message: `${document.title} is now available in your employee documents.`,
        href: '/employee/documents',
      });
    }

    return document;
  }

  async findEmployeeDocumentForDownload(
    user: CurrentUser,
    documentId: string,
  ) {
    const document = await this.prisma.employeeDocument.findFirst({
      where: {
        id: documentId,
        organisationId: user.organisationId,
      },
      include: {
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
      throw new NotFoundException('Employee document not found.');
    }

    const isEmployeeOwner = document.employee.userId === user.id;

    const canManageDocuments =
      user.permissions.includes('employees:read') &&
      user.permissions.includes('documents:download');

    if (!canManageDocuments) {
      if (!isEmployeeOwner || !document.visibleToEmployee) {
        throw new ForbiddenException('You cannot access this document.');
      }
    }

    await this.prisma.auditLog.create({
      data: {
        organisationId: user.organisationId,
        actorUserId: user.id,
        employeeId: document.employeeId,
        action: AuditAction.DOWNLOAD,
        entity: 'EmployeeDocument',
        entityId: document.id,
        message: `Employee document downloaded: ${document.originalName}.`,
        metadata: {
          category: document.category,
          originalName: document.originalName,
          mimeType: document.mimeType,
          sizeBytes: document.sizeBytes,
        },
      },
    });

    return document;
  }

  async updateEmployeeDocument(
    user: CurrentUser,
    documentId: string,
    dto: UpdateEmployeeDocumentDto,
  ) {
    const existingDocument = await this.prisma.employeeDocument.findFirst({
      where: {
        id: documentId,
        organisationId: user.organisationId,
      },
    });

    if (!existingDocument) {
      throw new NotFoundException('Employee document not found.');
    }

    const document = await this.prisma.employeeDocument.update({
      where: {
        id: existingDocument.id,
      },
      data: {
        title: dto.title ?? existingDocument.title,
        description: dto.description ?? existingDocument.description,
        category: dto.category ?? existingDocument.category,
        isConfidential:
          dto.isConfidential === undefined
            ? existingDocument.isConfidential
            : dto.isConfidential === 'true',
        visibleToEmployee:
          dto.visibleToEmployee === undefined
            ? existingDocument.visibleToEmployee
            : dto.visibleToEmployee === 'true',
        expiryDate:
          dto.expiryDate === undefined
            ? existingDocument.expiryDate
            : dto.expiryDate
              ? new Date(dto.expiryDate)
              : null,
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organisationId: user.organisationId,
        actorUserId: user.id,
        employeeId: document.employeeId,
        action: AuditAction.UPDATE,
        entity: 'EmployeeDocument',
        entityId: document.id,
        message: `Employee document updated: ${document.title}.`,
        metadata: {
          category: document.category,
          visibleToEmployee: document.visibleToEmployee,
          isConfidential: document.isConfidential,
          expiryDate: document.expiryDate,
        },
      },
    });

    return document;
  }

  async deleteEmployeeDocument(user: CurrentUser, documentId: string) {
    const document = await this.prisma.employeeDocument.findFirst({
      where: {
        id: documentId,
        organisationId: user.organisationId,
      },
    });

    if (!document) {
      throw new NotFoundException('Employee document not found.');
    }

    await this.prisma.employeeDocument.delete({
      where: {
        id: document.id,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organisationId: user.organisationId,
        actorUserId: user.id,
        employeeId: document.employeeId,
        action: AuditAction.DELETE,
        entity: 'EmployeeDocument',
        entityId: document.id,
        message: `Employee document deleted: ${document.title}.`,
        metadata: {
          category: document.category,
          originalName: document.originalName,
          mimeType: document.mimeType,
          sizeBytes: document.sizeBytes,
        },
      },
    });

    return {
      message: 'Employee document deleted successfully.',
    };
  }

  private async validateEmployeeNumberIsUnique(
    organisationId: string,
    employeeNumber: string,
    excludeEmployeeId?: string,
  ) {
    const existingEmployee = await this.prisma.employee.findFirst({
      where: {
        organisationId,
        employeeNumber,
        id: excludeEmployeeId
          ? {
              not: excludeEmployeeId,
            }
          : undefined,
      },
    });

    if (existingEmployee) {
      throw new ConflictException('Employee number already exists.');
    }
  }

  private async validateEmailIsUnique(
    organisationId: string,
    email: string,
    excludeEmployeeId?: string,
  ) {
    const existingEmployee = await this.prisma.employee.findFirst({
      where: {
        organisationId,
        email,
        id: excludeEmployeeId
          ? {
              not: excludeEmployeeId,
            }
          : undefined,
      },
    });

    if (existingEmployee) {
      throw new ConflictException('Employee email already exists.');
    }
  }

  private async validateDepartmentBelongsToOrganisation(
    organisationId: string,
    departmentId: string,
  ) {
    const department = await this.prisma.department.findFirst({
      where: {
        id: departmentId,
        organisationId,
      },
    });

    if (!department) {
      throw new NotFoundException('Department not found.');
    }
  }

  private async validateEmployeeBelongsToOrganisation(
    organisationId: string,
    employeeId: string,
  ) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: employeeId,
        organisationId,
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

    return employee;
  }
}
