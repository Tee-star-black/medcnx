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

async function main() {
  const organisation = await prisma.organisation.findFirst({
    where: {
      slug: 'medcnx-demo-clinic',
    },
  });

  if (!organisation) {
    throw new Error('Organisation not found.');
  }

  const user = await prisma.user.findUnique({
    where: {
      organisationId_email: {
        organisationId: organisation.id,
        email: 'employee@medcnx.local',
      },
    },
  });

  if (!user) {
    throw new Error('employee@medcnx.local not found.');
  }

  const employeeRole = await prisma.role.findFirst({
    where: {
      organisationId: organisation.id,
      name: 'EMPLOYEE',
    },
  });

  if (!employeeRole) {
    throw new Error('EMPLOYEE role not found.');
  }

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: employeeRole.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      roleId: employeeRole.id,
    },
  });

  console.log('Employee role fixed successfully.');
  console.table([
    {
      email: user.email,
      role: employeeRole.name,
      status: user.status,
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