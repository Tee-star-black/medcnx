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

async function main() {
  const organisation = await prisma.organisation.findFirst({
    where: {
      slug: 'medcnx-demo-clinic',
    },
  });

  if (!organisation) {
    throw new Error('Organisation not found.');
  }

  const passwordHash = await bcrypt.hash('Password123!', 12);

  const user = await prisma.user.update({
    where: {
      organisationId_email: {
        organisationId: organisation.id,
        email: 'employee@medcnx.local',
      },
    },
    data: {
      passwordHash,
      status: 'ACTIVE',
    },
  });

  console.log('Employee password reset successfully.');
  console.table([
    {
      email: user.email,
      password: 'Password123!',
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