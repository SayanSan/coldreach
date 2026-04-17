import { prisma } from './src/lib/db';
import bcrypt from 'bcryptjs';

import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  console.log("DATABASE_URL:", process.env.DATABASE_URL);
  
  const existingUser = await prisma.user.findFirst();
  if (existingUser) {
    console.log('Admin user already exists:', existingUser.email);
    console.log('Seed is disabled unless you delete them.');
    return;
  }

  const email = "admin@codevisionaryservices.com";
  const password = "CVS@rocks";

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: 'Admin',
    },
  });

  console.log("Admin user created successfully:", user.email);
}

main()
  .catch(e => console.error("Error creating user:", e))
  .finally(async () => {
    await prisma.$disconnect();
  });
