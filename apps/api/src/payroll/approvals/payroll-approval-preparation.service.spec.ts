import { PayrollApprovalPreparationService } from './payroll-approval-preparation.service';

describe('PayrollApprovalPreparationService approver resolution', () => {
  const prisma = {
    user: {
      findMany: jest.fn(),
    },
  };
  const service = new PayrollApprovalPreparationService(
    prisma as never,
    {} as never,
    {} as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('lists only active, authorised approvers in the same organisation', async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'executive-1',
        email: 'executive@example.com',
        firstName: 'Executive',
        lastName: 'Approver',
        userRoles: [{ role: { name: 'CEO' } }],
      },
    ]);

    await expect(
      service.listCeoApprovers('organisation-1', 'requester-1'),
    ).resolves.toEqual([
      {
        id: 'executive-1',
        email: 'executive@example.com',
        firstName: 'Executive',
        lastName: 'Approver',
        roles: ['CEO'],
      },
    ]);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organisationId: 'organisation-1',
          status: 'ACTIVE',
          id: { not: 'requester-1' },
          userRoles: {
            some: {
              role: {
                rolePermissions: {
                  some: {
                    permission: {
                      key: 'payroll:approve',
                    },
                  },
                },
              },
            },
          },
        }),
      }),
    );
  });
});
