import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;
const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const accounts = await prisma.account.findMany();
  console.log('Accounts found:', accounts.length);
  accounts.forEach(a => {
    console.log(`- ID: ${a.id}, Name: ${a.name}, HasSession: ${!!a.sessionData}, HasPIN: ${!!a.conversationPin}`);
  });

  const contacts = await prisma.messengerContact.count();
  console.log(`\nTotal MessengerContacts: ${contacts}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
