import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccessScopeService } from '../auth/access-scope.service';
import type { CurrentUser } from '../auth/types/current-user.type';
import { PrismaService } from '../database/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessScope: AccessScopeService,
  ) {}

  async findAll(user: CurrentUser) {
    const employeeScope = await this.accessScope.employeeWhere(user);

    const departments = await this.prisma.department.findMany({
      where: {
        organisationId: user.organisationId,
      },
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const visibleEmployees = await this.prisma.employee.findMany({
      where: employeeScope,
      select: { departmentId: true },
    });

    const counts = visibleEmployees.reduce<Record<string, number>>(
      (accumulator, employee) => {
        if (employee.departmentId) {
          accumulator[employee.departmentId] =
            (accumulator[employee.departmentId] ?? 0) + 1;
        }
        return accumulator;
      },
      {},
    );

    return departments.map((department) => ({
      ...department,
      _count: {
        employees: counts[department.id] ?? 0,
      },
    }));
  }

  async findOne(user: CurrentUser, departmentId: string) {
    const employeeScope = await this.accessScope.employeeWhere(user);
    const department = await this.prisma.department.findFirst({
      where: {
        id: departmentId,
        organisationId: user.organisationId,
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!department) {
      throw new NotFoundException('Department not found.');
    }

    const employees = await this.prisma.employee.findMany({
      where: {
        AND: [employeeScope, { departmentId }],
      },
      select: {
        id: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,
        email: true,
        jobTitle: true,
        employmentStatus: true,
        managerId: true,
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    return {
      ...department,
      employees,
    };
  }

  async getStructure(user: CurrentUser) {
    const employeeScope = await this.accessScope.employeeWhere(user);

    const [departments, employees] = await Promise.all([
      this.prisma.department.findMany({
        where: { organisationId: user.organisationId },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          description: true,
        },
      }),
      this.prisma.employee.findMany({
        where: employeeScope,
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          preferredName: true,
          email: true,
          jobTitle: true,
          employmentType: true,
          employmentStatus: true,
          departmentId: true,
          managerId: true,
        },
      }),
    ]);

    const visibleEmployeeIds = new Set(employees.map((employee) => employee.id));
    const childrenByManager = new Map<string, typeof employees>();

    for (const employee of employees) {
      if (!employee.managerId || !visibleEmployeeIds.has(employee.managerId)) continue;
      const children = childrenByManager.get(employee.managerId) ?? [];
      children.push(employee);
      childrenByManager.set(employee.managerId, children);
    }

    const buildNode = (
      employee: (typeof employees)[number],
      path = new Set<string>(),
    ): Record<string, unknown> => {
      if (path.has(employee.id)) {
        return {
          ...employee,
          directReports: [],
          hierarchyWarning: 'Reporting cycle detected.',
        };
      }

      const nextPath = new Set(path);
      nextPath.add(employee.id);

      return {
        ...employee,
        directReports: (childrenByManager.get(employee.id) ?? []).map((child) =>
          buildNode(child, nextPath),
        ),
      };
    };

    const roots = employees.filter(
      (employee) =>
        !employee.managerId || !visibleEmployeeIds.has(employee.managerId),
    );

    const employeesByDepartment = employees.reduce<
      Record<string, typeof employees>
    >((accumulator, employee) => {
      const key = employee.departmentId ?? 'UNASSIGNED';
      (accumulator[key] ??= []).push(employee);
      return accumulator;
    }, {});

    return {
      departments: departments.map((department) => ({
        ...department,
        employeeCount: employeesByDepartment[department.id]?.length ?? 0,
        employees: employeesByDepartment[department.id] ?? [],
      })),
      unassignedEmployees: employeesByDepartment.UNASSIGNED ?? [],
      reportingTree: roots.map((employee) => buildNode(employee)),
      visibleEmployeeCount: employees.length,
    };
  }

  async create(user: CurrentUser, createDepartmentDto: CreateDepartmentDto) {
    const existingDepartment = await this.prisma.department.findFirst({
      where: {
        organisationId: user.organisationId,
        name: createDepartmentDto.name,
      },
    });

    if (existingDepartment) {
      throw new ConflictException('A department with this name already exists.');
    }

    const department = await this.prisma.department.create({
      data: {
        organisationId: user.organisationId,
        name: createDepartmentDto.name,
        description: createDepartmentDto.description,
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organisationId: user.organisationId,
        actorUserId: user.id,
        action: 'CREATE',
        entity: 'Department',
        entityId: department.id,
        message: `Department created: ${department.name}`,
      },
    });

    return department;
  }

  async update(
    user: CurrentUser,
    departmentId: string,
    updateDepartmentDto: UpdateDepartmentDto,
  ) {
    const existingDepartment = await this.prisma.department.findFirst({
      where: {
        id: departmentId,
        organisationId: user.organisationId,
      },
    });

    if (!existingDepartment) {
      throw new NotFoundException('Department not found.');
    }

    if (updateDepartmentDto.name) {
      const duplicateDepartment = await this.prisma.department.findFirst({
        where: {
          organisationId: user.organisationId,
          name: updateDepartmentDto.name,
          NOT: {
            id: departmentId,
          },
        },
      });

      if (duplicateDepartment) {
        throw new ConflictException(
          'A department with this name already exists.',
        );
      }
    }

    const department = await this.prisma.department.update({
      where: {
        id: departmentId,
      },
      data: updateDepartmentDto,
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organisationId: user.organisationId,
        actorUserId: user.id,
        action: 'UPDATE',
        entity: 'Department',
        entityId: department.id,
        message: `Department updated: ${department.name}`,
      },
    });

    return department;
  }

  async remove(user: CurrentUser, departmentId: string) {
    const department = await this.prisma.department.findFirst({
      where: {
        id: departmentId,
        organisationId: user.organisationId,
      },
      include: {
        _count: {
          select: {
            employees: true,
          },
        },
      },
    });

    if (!department) {
      throw new NotFoundException('Department not found.');
    }

    if (department._count.employees > 0) {
      throw new ConflictException(
        'Cannot delete a department that still has employees assigned to it.',
      );
    }

    await this.prisma.department.delete({
      where: {
        id: departmentId,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organisationId: user.organisationId,
        actorUserId: user.id,
        action: 'DELETE',
        entity: 'Department',
        entityId: department.id,
        message: `Department deleted: ${department.name}`,
      },
    });

    return {
      message: 'Department deleted successfully.',
    };
  }
}
