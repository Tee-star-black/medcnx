import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import type { CurrentUser } from '../auth/types/current-user.type';
import { PrismaService } from '../database/prisma.service';
import { UpsertCompensationProfileDto } from './dto/upsert-compensation-profile.dto';

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value);
}

function clean(value?: string) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}

@Injectable()
export class PayrollCompensationService {
  constructor(private readonly prisma: PrismaService) {}

  async getCompensationProfile(user: CurrentUser, employeeId: string) {
    const employee = await this.findEmployee(user, employeeId);

    const profile = await this.prisma.employeeCompensationProfile.findUnique({
      where: {
        employeeId: employee.id,
      },
    });

    return {
      employee: {
        id: employee.id,
        employeeNumber: employee.employeeNumber,
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        jobTitle: employee.jobTitle,
        department: employee.department,
      },

      profile: profile
        ? this.mapProfile(profile)
        : {
            id: null,
            organisationId: user.organisationId,
            employeeId: employee.id,
            paymentFrequency: 'MONTHLY',
            basicSalary: 0,
            autoPaye: true,
            uifEnabled: true,
            pensionEmployee: 0,
            pensionEmployer: 0,
            medicalAidEmployee: 0,
            medicalAidEmployer: 0,
            medicalSchemeMembers: 0,
            taxDirectiveMode: 'NONE',
            taxDirectiveReference: null,
            taxDirectiveValue: null,
            taxDirectiveValidFrom: null,
            taxDirectiveValidTo: null,
            defaultAllowances: 0,
            defaultOtherDeductions: 0,
            bankName: null,
            bankAccountNumber: null,
            paymentReference: null,
            notes: null,
            createdAt: null,
            updatedAt: null,
          },
    };
  }

  async upsertCompensationProfile(
    user: CurrentUser,
    employeeId: string,
    dto: UpsertCompensationProfileDto,
  ) {
    const employee = await this.findEmployee(user, employeeId);

    if (
      dto.taxDirectiveMode &&
      dto.taxDirectiveMode !== 'NONE' &&
      (!clean(dto.taxDirectiveReference) ||
        !dto.taxDirectiveValue ||
        !dto.taxDirectiveValidFrom ||
        !dto.taxDirectiveValidTo)
    ) {
      throw new BadRequestException(
        'A SARS directive requires its reference, value, valid-from date and valid-to date.',
      );
    }

    if (
      dto.taxDirectiveMode === 'FIXED_PERCENTAGE' &&
      (dto.taxDirectiveValue ?? 0) > 100
    ) {
      throw new BadRequestException(
        'A fixed-percentage SARS directive cannot exceed 100%.',
      );
    }

    if (
      dto.taxDirectiveValidFrom &&
      dto.taxDirectiveValidTo &&
      new Date(dto.taxDirectiveValidFrom) > new Date(dto.taxDirectiveValidTo)
    ) {
      throw new BadRequestException(
        'The SARS directive valid-to date must be on or after its valid-from date.',
      );
    }

    const existing = await this.prisma.employeeCompensationProfile.findUnique({
      where: {
        employeeId: employee.id,
      },
      select: {
        id: true,
      },
    });

    const profile = await this.prisma.employeeCompensationProfile.upsert({
      where: {
        employeeId: employee.id,
      },
      create: {
        organisationId: user.organisationId,
        employeeId: employee.id,
        paymentFrequency: dto.paymentFrequency ?? 'MONTHLY',
        basicSalary: dto.basicSalary ?? 0,
        autoPaye: dto.autoPaye ?? true,
        uifEnabled: dto.uifEnabled ?? true,
        pensionEmployee: dto.pensionEmployee ?? 0,
        pensionEmployer: dto.pensionEmployer ?? 0,
        medicalAidEmployee: dto.medicalAidEmployee ?? 0,
        medicalAidEmployer: dto.medicalAidEmployer ?? 0,
        medicalSchemeMembers: dto.medicalSchemeMembers ?? 0,
        taxDirectiveMode: dto.taxDirectiveMode ?? 'NONE',
        taxDirectiveReference: clean(dto.taxDirectiveReference),
        taxDirectiveValue: dto.taxDirectiveValue,
        taxDirectiveValidFrom: dto.taxDirectiveValidFrom
          ? new Date(dto.taxDirectiveValidFrom)
          : null,
        taxDirectiveValidTo: dto.taxDirectiveValidTo
          ? new Date(dto.taxDirectiveValidTo)
          : null,
        defaultAllowances: dto.defaultAllowances ?? 0,
        defaultOtherDeductions: dto.defaultOtherDeductions ?? 0,
        bankName: clean(dto.bankName),
        bankAccountNumber: clean(dto.bankAccountNumber),
        paymentReference: clean(dto.paymentReference),
        notes: clean(dto.notes),
      },
      update: {
        paymentFrequency: dto.paymentFrequency,
        basicSalary: dto.basicSalary,
        autoPaye: dto.autoPaye,
        uifEnabled: dto.uifEnabled,
        pensionEmployee: dto.pensionEmployee,
        pensionEmployer: dto.pensionEmployer,
        medicalAidEmployee: dto.medicalAidEmployee,
        medicalAidEmployer: dto.medicalAidEmployer,
        medicalSchemeMembers: dto.medicalSchemeMembers,
        taxDirectiveMode: dto.taxDirectiveMode,
        taxDirectiveReference:
          dto.taxDirectiveReference === undefined
            ? undefined
            : clean(dto.taxDirectiveReference),
        taxDirectiveValue: dto.taxDirectiveValue,
        taxDirectiveValidFrom:
          dto.taxDirectiveValidFrom === undefined
            ? undefined
            : dto.taxDirectiveValidFrom
              ? new Date(dto.taxDirectiveValidFrom)
              : null,
        taxDirectiveValidTo:
          dto.taxDirectiveValidTo === undefined
            ? undefined
            : dto.taxDirectiveValidTo
              ? new Date(dto.taxDirectiveValidTo)
              : null,
        defaultAllowances: dto.defaultAllowances,
        defaultOtherDeductions: dto.defaultOtherDeductions,
        bankName: dto.bankName === undefined ? undefined : clean(dto.bankName),
        bankAccountNumber:
          dto.bankAccountNumber === undefined
            ? undefined
            : clean(dto.bankAccountNumber),
        paymentReference:
          dto.paymentReference === undefined
            ? undefined
            : clean(dto.paymentReference),
        notes: dto.notes === undefined ? undefined : clean(dto.notes),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organisationId: user.organisationId,
        actorUserId: user.id,
        action: existing ? AuditAction.UPDATE : AuditAction.CREATE,
        entity: 'EmployeeCompensationProfile',
        entityId: profile.id,
        metadata: {
          employeeId: employee.id,
          employeeNumber: employee.employeeNumber,
          basicSalary: dto.basicSalary,
          paymentFrequency: dto.paymentFrequency,
          autoPaye: dto.autoPaye,
          taxDirectiveMode: dto.taxDirectiveMode,
          taxDirectiveReference: clean(dto.taxDirectiveReference),
        },
      },
    });

    return {
      message: existing
        ? 'Compensation profile updated.'
        : 'Compensation profile created.',
      employee: {
        id: employee.id,
        employeeNumber: employee.employeeNumber,
        firstName: employee.firstName,
        lastName: employee.lastName,
      },
      profile: this.mapProfile(profile),
    };
  }

  private async findEmployee(user: CurrentUser, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: employeeId,
        organisationId: user.organisationId,
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

    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    return employee;
  }

  private mapProfile(profile: any) {
    return {
      ...profile,
      basicSalary: toNumber(profile.basicSalary),
      pensionEmployee: toNumber(profile.pensionEmployee),
      pensionEmployer: toNumber(profile.pensionEmployer),
      medicalAidEmployee: toNumber(profile.medicalAidEmployee),
      medicalAidEmployer: toNumber(profile.medicalAidEmployer),
      taxDirectiveValue:
        profile.taxDirectiveValue === null
          ? null
          : toNumber(profile.taxDirectiveValue),
      defaultAllowances: toNumber(profile.defaultAllowances),
      defaultOtherDeductions: toNumber(profile.defaultOtherDeductions),
    };
  }
}
