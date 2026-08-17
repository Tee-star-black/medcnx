import 'dotenv/config';
import bcrypt from 'bcrypt';
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

const password = 'Password123!';

async function getOrCreateRole(organisationId: string, roleName: string) {
  const role = await prisma.role.findFirst({
    where: {
      organisationId,
      name: roleName,
    },
  });

  if (!role) {
    throw new Error(`Role ${roleName} not found for this organisation.`);
  }

  return role;
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
  console.log('Creating demo HR and Employee users...');

  const organisation = await prisma.organisation.findFirst({
    where: {
      slug: 'medcnx-demo-clinic',
    },
  });

  if (!organisation) {
    throw new Error('MedCNX Demo Clinic organisation not found.');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const hrRole = await getOrCreateRole(organisation.id, 'HR_MANAGER');
  const employeeRole = await getOrCreateRole(organisation.id, 'EMPLOYEE');

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

  const employeeRecord = await prisma.employee.findFirst({
    where: {
      organisationId: organisation.id,
      userId: null,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  if (!employeeRecord) {
    throw new Error(
      'No unlinked employee record found. Create an employee first or unlink one employee userId.',
    );
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
      status: 'ACTIVE',
      phone: employeeRecord.phone,
    },
    create: {
      organisationId: organisation.id,
      email: 'employee@medcnx.local',
      passwordHash,
      firstName: employeeRecord.firstName,
      lastName: employeeRecord.lastName,
      status: 'ACTIVE',
      phone: employeeRecord.phone,
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

  console.log('Demo users created successfully.');

  console.table([
    {
      role: 'HR Manager',
      email: 'hr@medcnx.local',
      password,
      linkedEmployee: 'No',
    },
    {
      role: 'Employee',
      email: 'employee@medcnx.local',
      password,
      linkedEmployee: `${employeeRecord.employeeNumber} - ${employeeRecord.firstName} ${employeeRecord.lastName}`,
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