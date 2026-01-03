import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

import prisma from '../lib/db';
import { Prisma } from '@prisma/client';

async function migrate() {
  console.log('Migrating session data from cookies to sessionData...');
  
  // Find ALL accounts that have cookies data (regardless of sessionData)
  const accounts = await prisma.account.findMany({
    where: { 
      cookies: { not: Prisma.JsonNull },
    }
  });
  
  console.log(`Found ${accounts.length} accounts to migrate`);
  
  for (const acc of accounts) {
    await prisma.account.update({
      where: { id: acc.id },
      data: { sessionData: acc.cookies }
    });
    console.log(`✅ Migrated: ${acc.email}`);
  }
  
  console.log('Done!');
}

migrate()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
