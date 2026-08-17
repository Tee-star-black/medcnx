import { Test, TestingModule } from '@nestjs/testing';
import { AccessScopeService } from '../auth/access-scope.service';
import { PrismaService } from '../database/prisma.service';
import { DepartmentsService } from './departments.service';

describe('DepartmentsService', () => {
  const user = {
    id: 'user-1',
    organisationId: 'org-1',
    email: 'manager@example.com',
    firstName: 'Manager',
    lastName: 'User',
    status: 'ACTIVE',
    roles: ['MANAGER'],
    permissions: ['departments:read'],
    sessionId: 'session-1',
  };

  const employeeScope = {
    organisationId: 'org-1',
    OR: [{ id: 'manager-employee' }, { managerId: 'manager-employee' }],
  };

  function createService() {
    const prisma = {
      department: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      employee: {
        findMany: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    const accessScope = {
      employeeWhere: jest.fn().mockResolvedValue(employeeScope),
    };

    return {
      service: new DepartmentsService(
        prisma as unknown as PrismaService,
        accessScope as unknown as AccessScopeService,
      ),
      prisma,
      accessScope,
    };
  }

  it('is defined', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentsService,
        { provide: PrismaService, useValue: { department: {}, employee: {} } },
        {
          provide: AccessScopeService,
          useValue: { employeeWhere: jest.fn().mockResolvedValue(employeeScope) },
        },
      ],
    }).compile();

    expect(module.get<DepartmentsService>(DepartmentsService)).toBeDefined();
  });

  it('returns only visible employees in a department', async () => {
    const { service, prisma } = createService();
    prisma.department.findFirst.mockResolvedValue({
      id: 'department-1',
      name: 'Surgical Unit',
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma.employee.findMany.mockResolvedValue([
      {
        id: 'employee-2',
        employeeNumber: 'EMP002',
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        jobTitle: 'Nurse',
        employmentStatus: 'ACTIVE',
        managerId: 'manager-employee',
      },
    ]);

    const result = await service.findOne(user, 'department-1');

    expect(prisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [employeeScope, { departmentId: 'department-1' }],
        },
      }),
    );
    expect(result.employees).toHaveLength(1);
  });

  it('builds a reporting tree from visible employees only', async () => {
    const { service, prisma } = createService();
    prisma.department.findMany.mockResolvedValue([
      { id: 'department-1', name: 'Clinical', description: null },
    ]);
    prisma.employee.findMany.mockResolvedValue([
      {
        id: 'manager-employee',
        employeeNumber: 'EMP001',
        firstName: 'Grace',
        lastName: 'Hopper',
        preferredName: null,
        email: 'grace@example.com',
        jobTitle: 'Clinical Manager',
        employmentType: 'FULL_TIME',
        employmentStatus: 'ACTIVE',
        departmentId: 'department-1',
        managerId: null,
      },
      {
        id: 'employee-2',
        employeeNumber: 'EMP002',
        firstName: 'Ada',
        lastName: 'Lovelace',
        preferredName: null,
        email: 'ada@example.com',
        jobTitle: 'Nurse',
        employmentType: 'FULL_TIME',
        employmentStatus: 'ACTIVE',
        departmentId: 'department-1',
        managerId: 'manager-employee',
      },
    ]);

    const result = await service.getStructure(user);

    expect(result.visibleEmployeeCount).toBe(2);
    expect(result.departments[0].employeeCount).toBe(2);
    expect(result.reportingTree).toHaveLength(1);
    expect(result.reportingTree[0]).toEqual(
      expect.objectContaining({
        id: 'manager-employee',
        directReports: [expect.objectContaining({ id: 'employee-2' })],
      }),
    );
  });
});
