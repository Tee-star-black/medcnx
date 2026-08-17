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

async function main() {
  const permission = await prisma.permission.upsert({
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
      permissionId: permission.id,
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

  console.log('MedCNX lifecycle permissions hardened.');
}

main()
  .catch((error) => {
    console.error('Permission hardening failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
