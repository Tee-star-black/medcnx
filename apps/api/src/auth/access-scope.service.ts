import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import type { CurrentUser } from './types/current-user.type';

export enum EmployeeAccessScope {
  OWN = 'OWN',
  DIRECT_REPORTS = 'DIRECT_REPORTS',
  DEPARTMENT = 'DEPARTMENT',
  ORGANISATION = 'ORGANISATION',
}

const organisationWideEmployeeRoles = new Set([
  'SUPER_ADMIN',
  'ORG_ADMIN',
  'HR_MANAGER',
]);

@Injectable()
export class AccessScopeService {
  constructor(private readonly prisma: PrismaService) {}

  defaultEmployeeScope(user: CurrentUser): EmployeeAccessScope {
    if (user.roles.some((role) => organisationWideEmployeeRoles.has(role))) {
      return EmployeeAccessScope.ORGANISATION;
    }

    if (user.roles.includes('MANAGER')) {
      return EmployeeAccessScope.DIRECT_REPORTS;
    }

    return EmployeeAccessScope.OWN;
  }

  async employeeWhere(user: CurrentUser): Promise<Prisma.EmployeeWhereInput> {
    const scope = this.defaultEmployeeScope(user);

    if (scope === EmployeeAccessScope.ORGANISATION) {
      return { organisationId: user.organisationId };
    }

    const employee = await this.prisma.employee.findFirst({
      where: {
        organisationId: user.organisationId,
        userId: user.id,
      },
      select: {
        id: true,
        departmentId: true,
      },
    });

    if (!employee) {
      throw new ForbiddenException(
        'This account is not linked to an employee profile.',
      );
    }

    if (scope === EmployeeAccessScope.DIRECT_REPORTS) {
      return {
        organisationId: user.organisationId,
        OR: [{ id: employee.id }, { managerId: employee.id }],
      };
    }

    if (scope === EmployeeAccessScope.DEPARTMENT) {
      if (!employee.departmentId) {
        return { organisationId: user.organisationId, id: employee.id };
      }

      return {
        organisationId: user.organisationId,
        departmentId: employee.departmentId,
      };
    }

    return {
      organisationId: user.organisationId,
      id: employee.id,
    };
  }
}
