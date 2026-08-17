import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CurrentUser } from '../auth/types/current-user.type';
import { PrismaService } from '../database/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: CurrentUser) {
    return this.prisma.department.findMany({
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
        _count: {
          select: {
            employees: true,
          },
        },
      },
    });
  }

  async findOne(user: CurrentUser, departmentId: string) {
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
        employees: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
            email: true,
            jobTitle: true,
            employmentStatus: true,
          },
          orderBy: {
            firstName: 'asc',
          },
        },
      },
    });

    if (!department) {
      throw new NotFoundException('Department not found.');
    }

    return department;
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
