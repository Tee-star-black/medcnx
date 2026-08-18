import { PositionsService } from './positions.service';
import { PrismaService } from '../database/prisma.service';
import { AccessScopeService } from '../auth/access-scope.service';

describe('PositionsService position department updates', () => {
  const actor = {
    id: 'actor-1',
    organisationId: 'org-1',
    email: 'hr@example.com',
    firstName: 'HR',
    lastName: 'User',
    status: 'ACTIVE',
    roles: ['HR_MANAGER'],
    permissions: ['departments:update'],
    sessionId: 'session-1',
  };

  it('persists null when an existing position department is cleared', async () => {
    const existing = {
      id: 'position-1',
      organisationId: 'org-1',
      departmentId: 'department-1',
      code: 'RN-001',
      title: 'Registered Nurse',
      description: null,
      level: null,
      employmentCategory: 'FULL_TIME',
      approvedHeadcount: 3,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updated = {
      ...existing,
      departmentId: null,
    };

    const prisma = {
      position: {
        findFirst: jest.fn().mockResolvedValue(existing),
        update: jest.fn().mockResolvedValue(updated),
      },
      department: {
        findFirst: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    } as unknown as PrismaService;

    const service = new PositionsService(
      prisma,
      {} as AccessScopeService,
    );

    const result = await service.update(actor, existing.id, {
      departmentId: null,
    });

    expect(prisma.department.findFirst).not.toHaveBeenCalled();
    expect(prisma.position.update).toHaveBeenCalledWith({
      where: { id: existing.id },
      data: expect.objectContaining({
        departmentId: null,
      }),
    });
    expect(result.departmentId).toBeNull();
  });
});
