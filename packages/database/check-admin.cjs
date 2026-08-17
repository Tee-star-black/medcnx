const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: {
      email: 'admin@medcnx.local',
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      status: true,
      organisationId: true,
      passwordHash: true,
    },
  });

  console.log({
    ...user,
    passwordHash: user?.passwordHash
      ? `${user.passwordHash.slice(0, 12)}...`
      : null,
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
