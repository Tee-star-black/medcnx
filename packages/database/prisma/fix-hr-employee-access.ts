import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is missing in packages/database/.env');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const password = 'Password123!';

const hrPermissions = [
  'organisation:read',

  'departments:read',
  'departments:create',
  'departments:update',
  'departments:delete',

  'employees:read',
  'employees:create',
  'employees:update',
  'employees:delete',

  'leave:read',
  'leave:create',
  'leave:update',
  'leave:approve',
  'leave:reject',
  'leave:cancel',
];

const employeePermissions = [
  'organisation:read',
  'leave:read',
  'leave:create',
  'leave:update',
  'leave:cancel',
];

async function getOrganisation() {
  const organisation = await prisma.organisation.findFirst({
    where: {
      slug: 'medcnx-demo-clinic',
    },
  });

  if (!organisation) {
    throw new Error('Organisation medcnx-demo-clinic not found.');
  }

  return organisation;
}

async function getRole(organisationId: string, name: string) {
  const role = await prisma.role.findFirst({
    where: {
      organisationId,
      name,
    },
  });

  if (!role) {
    throw new Error(`Role ${name} not found.`);
  }

  return role;
}

async function ensurePermission(key: string) {
  return prisma.permission.upsert({
    where: {
      key,
    },
    update: {},
    create: {
      key,
      description: key,
    },
  });
}

async function assignPermissionsToRole(roleId: string, permissionKeys: string[]) {
  for (const key of permissionKeys) {
    const permission = await ensurePermission(key);

    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId,
        permissionId: permission.id,
      },
    });
  }
}

async function ensureUserRole(userId: string, roleId: string) {
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId,
        roleId,
      },
    },
    update: {},
    create: {
      userId,
      roleId,
    },
  });
}

async function main() {
  console.log('Fixing HR and employee access...');

  const organisation = await getOrganisation();

  const passwordHash = await bcrypt.hash(password, 12);

  const hrRole = await getRole(organisation.id, 'HR_MANAGER');
  const employeeRole = await getRole(organisation.id, 'EMPLOYEE');

  await assignPermissionsToRole(hrRole.id, hrPermissions);
  await assignPermissionsToRole(employeeRole.id, employeePermissions);

  const hrUser = await prisma.user.upsert({
    where: {
      organisationId_email: {
        organisationId: organisation.id,
        email: 'hr@medcnx.local',
      },
    },
    update: {
      passwordHash,
      firstName: 'HR',
      lastName: 'Manager',
      status: 'ACTIVE',
    },
    create: {
      organisationId: organisation.id,
      email: 'hr@medcnx.local',
      passwordHash,
      firstName: 'HR',
      lastName: 'Manager',
      status: 'ACTIVE',
      phone: '+27 82 000 0100',
    },
  });

  await ensureUserRole(hrUser.id, hrRole.id);

  const employeeRecord =
    (await prisma.employee.findFirst({
      where: {
        organisationId: organisation.id,
        employeeNumber: 'MED-005',
      },
    })) ??
    (await prisma.employee.findFirst({
      where: {
        organisationId: organisation.id,
      },
      orderBy: {
        createdAt: 'asc',
      },
    }));

  if (!employeeRecord) {
    throw new Error('No employee record found to link employee login to.');
  }

  const existingEmployeeUser = await prisma.user.findUnique({
    where: {
      organisationId_email: {
        organisationId: organisation.id,
        email: 'employee@medcnx.local',
      },
    },
  });

  if (existingEmployeeUser) {
    await prisma.employee.updateMany({
      where: {
        userId: existingEmployeeUser.id,
      },
      data: {
        userId: null,
      },
    });
  }

  const employeeUser = await prisma.user.upsert({
    where: {
      organisationId_email: {
        organisationId: organisation.id,
        email: 'employee@medcnx.local',
      },
    },
    update: {
      passwordHash,
      firstName: employeeRecord.firstName,
      lastName: employeeRecord.lastName,
      phone: employeeRecord.phone,
      status: 'ACTIVE',
    },
    create: {
      organisationId: organisation.id,
      email: 'employee@medcnx.local',
      passwordHash,
      firstName: employeeRecord.firstName,
      lastName: employeeRecord.lastName,
      phone: employeeRecord.phone,
      status: 'ACTIVE',
    },
  });

  await ensureUserRole(employeeUser.id, employeeRole.id);

  await prisma.employee.update({
    where: {
      id: employeeRecord.id,
    },
    data: {
      userId: employeeUser.id,
      email: employeeUser.email,
    },
  });

  console.log('Access fixed successfully.');

  console.table([
    {
      login: 'HR',
      email: 'hr@medcnx.local',
      password,
      role: 'HR_MANAGER',
      permissions: hrPermissions.length,
    },
    {
      login: 'Employee',
      email: 'employee@medcnx.local',
      password,
      role: 'EMPLOYEE',
      linkedEmployee: `${employeeRecord.employeeNumber} - ${employeeRecord.firstName} ${employeeRecord.lastName}`,
      permissions: employeePermissions.length,
    },
  ]);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });