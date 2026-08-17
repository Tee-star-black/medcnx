import 'dotenv/config';

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is missing in packages/database/.env');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const terminatePermission = {
  key: 'employees:terminate',
  description: 'Terminate employee employment while preserving HR history',
};

const lifecycleRoleNames = ['SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'];

const managerSensitivePermissionKeys = [
  'payroll:read',
  'payroll:view-findings',
  'payroll:finance-review',
  'payroll:view-reports',
  'compensation:read',
  'payslips:view-all',
];

const financeManagerPermissionKeys = [
  'organisation:read',
  'employees:read',
  'departments:read',
  'payroll:read',
  'payroll:view-findings',
  'payroll:finance-review',
  'payroll:view-reports',
  'payroll:export',
  'payroll:view-bank-details',
  'payroll:export-bank-file',
  'compensation:read',
  'compensation:view-sensitive',
  'payslips:view-all',
  'reports:read',
];

async function main() {
  const terminate = await prisma.permission.upsert({
    where: { key: terminatePermission.key },
    update: { description: terminatePermission.description },
    create: terminatePermission,
  });

  const lifecycleRoles = await prisma.role.findMany({
    where: {
      name: { in: lifecycleRoleNames },
      isSystem: true,
    },
    select: { id: true },
  });

  await prisma.rolePermission.createMany({
    data: lifecycleRoles.map((role) => ({
      roleId: role.id,
      permissionId: terminate.id,
    })),
    skipDuplicates: true,
  });

  const destructivePermission = await prisma.permission.findUnique({
    where: { key: 'employees:delete' },
    select: { id: true },
  });

  if (destructivePermission) {
    await prisma.rolePermission.deleteMany({
      where: { permissionId: destructivePermission.id },
    });
    await prisma.permission.delete({
      where: { id: destructivePermission.id },
    });
  }

  const managerSensitivePermissions = await prisma.permission.findMany({
    where: { key: { in: managerSensitivePermissionKeys } },
    select: { id: true },
  });

  const managerRoles = await prisma.role.findMany({
    where: { name: 'MANAGER', isSystem: true },
    select: { id: true },
  });

  if (managerRoles.length && managerSensitivePermissions.length) {
    await prisma.rolePermission.deleteMany({
      where: {
        roleId: { in: managerRoles.map((role) => role.id) },
        permissionId: {
          in: managerSensitivePermissions.map((permission) => permission.id),
        },
      },
    });
  }

  const financePermissions = await prisma.permission.findMany({
    where: { key: { in: financeManagerPermissionKeys } },
    select: { id: true, key: true },
  });

  const foundFinanceKeys = new Set(financePermissions.map((item) => item.key));
  const missingFinanceKeys = financeManagerPermissionKeys.filter(
    (key) => !foundFinanceKeys.has(key),
  );

  if (missingFinanceKeys.length) {
    throw new Error(
      `Missing FINANCE_MANAGER permissions: ${missingFinanceKeys.join(', ')}`,
    );
  }

  const organisations = await prisma.organisation.findMany({
    select: { id: true },
  });

  for (const organisation of organisations) {
    const financeRole = await prisma.role.upsert({
      where: {
        organisationId_name: {
          organisationId: organisation.id,
          name: 'FINANCE_MANAGER',
        },
      },
      update: {
        description: 'Finance manager with payroll and compensation visibility',
        isSystem: true,
      },
      create: {
        organisationId: organisation.id,
        name: 'FINANCE_MANAGER',
        description: 'Finance manager with payroll and compensation visibility',
        isSystem: true,
      },
    });

    await prisma.rolePermission.deleteMany({
      where: { roleId: financeRole.id },
    });

    await prisma.rolePermission.createMany({
      data: financePermissions.map((permission) => ({
        roleId: financeRole.id,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    });

    const demoFinanceUser = await prisma.user.findUnique({
      where: {
        organisationId_email: {
          organisationId: organisation.id,
          email: 'finance@medcnx.local',
        },
      },
      select: { id: true },
    });

    if (demoFinanceUser) {
      const managerRole = await prisma.role.findUnique({
        where: {
          organisationId_name: {
            organisationId: organisation.id,
            name: 'MANAGER',
          },
        },
        select: { id: true },
      });

      if (managerRole) {
        await prisma.userRole.deleteMany({
          where: { userId: demoFinanceUser.id, roleId: managerRole.id },
        });
      }

      await prisma.userRole.upsert({
        where: {
          userId_roleId: {
            userId: demoFinanceUser.id,
            roleId: financeRole.id,
          },
        },
        update: {},
        create: {
          userId: demoFinanceUser.id,
          roleId: financeRole.id,
        },
      });
    }
  }

  console.log('MedCNX lifecycle and finance permissions hardened.');
}

main()
  .catch((error) => {
    console.error('Permission hardening failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
