import { NotFoundException } from '@nestjs/common';
import { DocumentTemplatesService } from './document-templates.service';
describe('DocumentTemplatesService tenant isolation', () => {
  const prisma = {
    documentTemplate: { findMany: jest.fn(), findFirst: jest.fn() },
  } as any;
  const service = new DocumentTemplatesService(
    prisma,
    {} as any,
    {} as any,
    {} as any,
  );
  const user = {
    id: 'user-a',
    organisationId: 'org-a',
    permissions: [],
    roles: [],
    email: 'a@example.com',
    firstName: 'A',
    lastName: 'User',
    status: 'ACTIVE',
  };
  beforeEach(() => jest.clearAllMocks());
  it('always scopes template listings to the authenticated organisation', async () => {
    prisma.documentTemplate.findMany.mockResolvedValue([]);
    await service.list(user);
    expect(prisma.documentTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organisationId: 'org-a' }),
      }),
    );
  });
  it('does not reveal a template from another organisation', async () => {
    prisma.documentTemplate.findFirst.mockResolvedValue(null);
    await expect(
      service.get(user, 'template-from-org-b'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.documentTemplate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'template-from-org-b',
          organisationId: 'org-a',
        }),
      }),
    );
  });
});
