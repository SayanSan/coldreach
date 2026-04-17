import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgres://postgres:postgres@localhost:51214/template1?sslmode=disable"
    }
  }
});

async function main() {
  const email = "admin@codevisionaryservices.com";
  const password = "CVS@rocks";

  const existingUser = await prisma.user.findFirst({ where: { email } });
  if (existingUser) {
    console.log('Admin user already exists:', existingUser.email);
    return;
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: 'Admin',
    },
  });

  console.log("SUCCESS! Admin user created with email:", user.email);
}

main()
  .catch(e => {
    console.error("Error creating user directly:", e.message);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
