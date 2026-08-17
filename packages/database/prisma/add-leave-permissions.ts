import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is missing in packages/database/.env');
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

const leavePermissions = [
  {
    key: 'leave:read',
    description: 'View leave requests.',
  },
  {
    key: 'leave:create',
    description: 'Create leave requests.',
  },
  {
    key: 'leave:update',
    description: 'Update pending leave requests.',
  },
  {
    key: 'leave:approve',
    description: 'Approve pending leave requests.',
  },
  {
    key: 'leave:reject',
    description: 'Reject pending leave requests.',
  },
  {
    key: 'leave:cancel',
    description: 'Cancel pending leave requests.',
  },
];

const roleNamesToUpdate = ['SUPER_ADMIN', 'ORG_ADMIN', 'HR_MANAGER'];

async function main() {
  console.log('Adding leave permissions...');

  const permissions = [];

  for (const permission of leavePermissions) {
    const savedPermission = await prisma.permission.upsert({
      where: {
        key: permission.key,
      },
      update: {
        description: permission.description,
      },
      create: permission,
    });

    permissions.push(savedPermission);
  }

  const roles = await prisma.role.findMany({
    where: {
      name: {
        in: roleNamesToUpdate,
      },
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (roles.length === 0) {
    throw new Error('No matching roles found. Please check your seed data.');
  }

  const rolePermissionRows = roles.flatMap((role) =>
    permissions.map((permission) => ({
      roleId: role.id,
      permissionId: permission.id,
    })),
  );

  await prisma.rolePermission.createMany({
    data: rolePermissionRows,
    skipDuplicates: true,
  });

  console.log('Leave permissions added successfully.');
  console.table(
    roles.map((role) => ({
      role: role.name,
      permissionsAdded: permissions.length,
    })),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });