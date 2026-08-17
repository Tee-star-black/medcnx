import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, EmploymentStatus } from '@prisma/client';
import type { CurrentUser } from '../auth/types/current-user.type';
import { PrismaService } from '../database/prisma.service';
import { DepartmentsService } from './departments.service';
import { UpdateDepartmentStructureDto } from './dto/update-department-structure.dto';

@Injectable()
export class DepartmentStructureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly departmentsService: DepartmentsService,
  ) {}

  async getStructure(user: CurrentUser) {
    const base = await this.departmentsService.getStructure(user);
    const [structures, positions, assignments] = await Promise.all([
      this.prisma.departmentStructure.findMany({
        where: { organisationId: user.organisationId, active: true },
      }),
      this.prisma.position.findMany({
        where: { organisationId: user.organisationId, active: true },
        orderBy: { title: 'asc' },
      }),
      this.prisma.employeePositionAssignment.findMany({
        where: { organisationId: user.organisationId, effectiveTo: null },
        select: { positionId: true },
      }),
    ]);

    const headIds = [
      ...new Set(structures.map((structure) => structure.headEmployeeId).filter(Boolean)),
    ] as string[];
    const heads = headIds.length
      ? await this.prisma.employee.findMany({
          where: {
            organisationId: user.organisationId,
            id: { in: headIds },
          },
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
            jobTitle: true,
            employmentStatus: true,
          },
        })
      : [];

    const headById = new Map(heads.map((head) => [head.id, head]));
    const structureByDepartment = new Map(
      structures.map((structure) => [structure.departmentId, structure]),
    );
    const headcountByPosition = assignments.reduce<Record<string, number>>(
      (accumulator, assignment) => {
        accumulator[assignment.positionId] =
          (accumulator[assignment.positionId] ?? 0) + 1;
        return accumulator;
      },
      {},
    );
    const positionsByDepartment = positions.reduce<Record<string, typeof positions>>(
      (accumulator, position) => {
        const key = position.departmentId ?? 'UNASSIGNED';
        (accumulator[key] ??= []).push(position);
        return accumulator;
      },
      {},
    );

    const departments = base.departments.map((department) => {
      const structure = structureByDepartment.get(department.id);
      const departmentPositions = positionsByDepartment[department.id] ?? [];
      return {
        ...department,
        parentDepartmentId: structure?.parentDepartmentId ?? null,
        headEmployee: structure?.headEmployeeId
          ? headById.get(structure.headEmployeeId) ?? null
          : null,
        active: structure?.active ?? true,
        positions: departmentPositions.map((position) => {
          const currentHeadcount = headcountByPosition[position.id] ?? 0;
          return {
            ...position,
            currentHeadcount,
            vacancies: Math.max(position.approvedHeadcount - currentHeadcount, 0),
          };
        }),
      };
    });

    const byParent = departments.reduce<Record<string, typeof departments>>(
      (accumulator, department) => {
        const key = department.parentDepartmentId ?? 'ROOT';
        (accumulator[key] ??= []).push(department);
        return accumulator;
      },
      {},
    );

    const buildDepartmentNode = (
      department: (typeof departments)[number],
      path = new Set<string>(),
    ): Record<string, unknown> => {
      if (path.has(department.id)) {
        return { ...department, children: [], hierarchyWarning: 'Department cycle detected.' };
      }
      const nextPath = new Set(path);
      nextPath.add(department.id);
      return {
        ...department,
        children: (byParent[department.id] ?? []).map((child) =>
          buildDepartmentNode(child, nextPath),
        ),
      };
    };

    return {
      ...base,
      departments,
      departmentTree: (byParent.ROOT ?? []).map((department) =>
        buildDepartmentNode(department),
      ),
      unassignedPositions: (positionsByDepartment.UNASSIGNED ?? []).map((position) => {
        const currentHeadcount = headcountByPosition[position.id] ?? 0;
        return {
          ...position,
          currentHeadcount,
          vacancies: Math.max(position.approvedHeadcount - currentHeadcount, 0),
        };
      }),
    };
  }

  async updateStructure(
    user: CurrentUser,
    departmentId: string,
    dto: UpdateDepartmentStructureDto,
  ) {
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, organisationId: user.organisationId },
      select: { id: true, name: true },
    });
    if (!department) throw new NotFoundException('Department not found.');

    if (dto.parentDepartmentId === departmentId) {
      throw new BadRequestException('A department cannot be its own parent.');
    }
    if (dto.parentDepartmentId) {
      const parent = await this.prisma.department.findFirst({
        where: {
          id: dto.parentDepartmentId,
          organisationId: user.organisationId,
        },
        select: { id: true },
      });
      if (!parent) throw new NotFoundException('Parent department not found.');
      await this.assertNoDepartmentCycle(
        user.organisationId,
        departmentId,
        dto.parentDepartmentId,
      );
    }

    if (dto.headEmployeeId) {
      const head = await this.prisma.employee.findFirst({
        where: {
          id: dto.headEmployeeId,
          organisationId: user.organisationId,
          employmentStatus: {
            notIn: [EmploymentStatus.TERMINATED, EmploymentStatus.RESIGNED],
          },
        },
        select: { id: true },
      });
      if (!head) {
        throw new NotFoundException(
          'Department head must be an active employee in this organisation.',
        );
      }
    }

    const previous = await this.prisma.departmentStructure.findUnique({
      where: { departmentId },
    });
    const structure = await this.prisma.departmentStructure.upsert({
      where: { departmentId },
      create: {
        organisationId: user.organisationId,
        departmentId,
        parentDepartmentId: dto.parentDepartmentId ?? null,
        headEmployeeId: dto.headEmployeeId ?? null,
        active: dto.active ?? true,
      },
      update: {
        parentDepartmentId:
          dto.parentDepartmentId === undefined
            ? previous?.parentDepartmentId
            : dto.parentDepartmentId,
        headEmployeeId:
          dto.headEmployeeId === undefined ? previous?.headEmployeeId : dto.headEmployeeId,
        active: dto.active,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organisationId: user.organisationId,
        actorUserId: user.id,
        action: AuditAction.UPDATE,
        entity: 'DepartmentStructure',
        entityId: departmentId,
        message: `Department structure updated: ${department.name}.`,
        metadata: { previous, next: structure },
      },
    });

    return structure;
  }

  private async assertNoDepartmentCycle(
    organisationId: string,
    departmentId: string,
    parentDepartmentId: string,
  ) {
    const structures = await this.prisma.departmentStructure.findMany({
      where: { organisationId },
      select: { departmentId: true, parentDepartmentId: true },
    });
    const parentByDepartment = new Map(
      structures.map((structure) => [structure.departmentId, structure.parentDepartmentId]),
    );

    let cursor: string | null | undefined = parentDepartmentId;
    const visited = new Set<string>();
    while (cursor) {
      if (cursor === departmentId) {
        throw new BadRequestException('Department hierarchy cycle detected.');
      }
      if (visited.has(cursor)) {
        throw new BadRequestException('Existing department hierarchy cycle detected.');
      }
      visited.add(cursor);
      cursor = parentByDepartment.get(cursor);
    }
  }
}
