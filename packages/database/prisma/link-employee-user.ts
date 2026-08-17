import { PrismaClient, EmploymentStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: {
      email: 'employee@medcnx.local',
    },
    include: {
      organisation: true,
    },
  });

  if (!user) {
    throw new Error('employee@medcnx.local user not found.');
  }

  const existingLinkedEmployee = await prisma.employee.findFirst({
    where: {
      organisationId: user.organisationId,
      userId: user.id,
    },
  });

  if (existingLinkedEmployee) {
    console.log('Employee user is already linked:', existingLinkedEmployee.id);
    return;
  }

  const existingEmployee = await prisma.employee.findFirst({
    where: {
      organisationId: user.organisationId,
      OR: [
        { email: user.email },
        { employeeNumber: 'MED-005' },
      ],
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  if (existingEmployee) {
    const updatedEmployee = await prisma.employee.update({
      where: {
        id: existingEmployee.id,
      },
      data: {
        userId: user.id,
        email: user.email,
      },
    });

    console.log('Linked existing employee:', updatedEmployee.id);
    return;
  }

  const employee = await prisma.employee.create({
    data: {
      organisationId: user.organisationId,
      userId: user.id,
      employeeNumber: 'MED-005',
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      jobTitle: 'Employee',
      employmentStatus: EmploymentStatus.ACTIVE,
      startDate: new Date(),
    },
  });

  console.log('Created and linked employee profile:', employee.id);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });