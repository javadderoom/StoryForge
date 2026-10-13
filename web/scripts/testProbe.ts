import dotenv from 'dotenv';
dotenv.config();

process.env.ENABLE_DB = 'true';

import { getPrisma } from '../src/lib/db/client';

async function run() {
  const prisma = getPrisma();
  if (!prisma) {
    console.log('No prisma client');
    return;
  }
  const users = await prisma.user.findMany({
    select: { id: true, phoneNumber: true, email: true, name: true, creditBalance: true, role: true },
  });
  console.log('Total users:', users.length);
  users.forEach((u) => console.log(' -', u.id, u.phoneNumber, u.email, u.name, 'credits:', u.creditBalance));
}

run().catch(console.error);
