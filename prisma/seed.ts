// Main seed file - imports from seed folder
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import * as dotenv from 'dotenv';

import { businessData, portfolioData } from './seed/business';
import { servicesData } from './seed/services';
import { aiPromptData, aiSettingsData } from './seed/ai-prompts';
import { groupsData } from './seed/groups';

// Load environment variables
dotenv.config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database for Creator Labs...\n');

  // ============================================
  // 1. BUSINESS PROFILE
  // ============================================
  console.log('📦 Seeding Business Profile...');
  const business = await prisma.business.upsert({
    where: { id: businessData.id },
    update: businessData,
    create: businessData,
  });
  console.log(`   ✅ Business: ${business.name}`);

  // ============================================
  // 2. PORTFOLIO
  // ============================================
  console.log('\n🖼️  Seeding Portfolio...');
  await prisma.portfolio.deleteMany({ where: { businessId: business.id } });
  for (const item of portfolioData) {
    await prisma.portfolio.create({
      data: { ...item, businessId: business.id },
    });
    console.log(`   ✅ Portfolio: ${item.title}`);
  }

  // ============================================
  // 3. SERVICES
  // ============================================
  console.log('\n🛠️  Seeding Services...');
  await prisma.service.deleteMany({});
  for (const service of servicesData) {
    await prisma.service.create({
      data: {
        ...service,
        objectionHandlers: JSON.stringify(service.objectionHandlers),
      },
    });
    console.log(`   ✅ Service: ${service.name}`);
  }

  // ============================================
  // 4. AI SETTINGS (stored in data/ai-prompt.json for now)
  // ============================================
  console.log('\n🤖 AI Prompt configured in seed/ai-prompts.ts');
  console.log(`   System prompt length: ${aiPromptData.systemPrompt.length} chars`);

  // ============================================
  // 5. GROUPS (optional - uncomment to seed)
  // ============================================
  console.log('\n📋 Groups available in seed/groups.ts (not auto-seeded)');
  console.log('   Run separately if needed');
  
  // Uncomment to seed groups:
  // for (const group of groupsData) {
  //   await prisma.group.upsert({
  //     where: { url: group.url },
  //     update: group,
  //     create: group,
  //   });
  //   console.log(`   ✅ Group: ${group.name}`);
  // }

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n' + '='.repeat(50));
  console.log('🎉 Seeding completed!');
  console.log('='.repeat(50));
  console.log(`
📊 Summary:
   • Business: ${business.name}
   • Portfolio items: ${portfolioData.length}
   • Services: ${servicesData.length}
   • AI Prompt: Configured (Tunisian Arabic)
   
⚠️  Not seeded (manual setup required):
   • Facebook Accounts (login via /dashboard/accounts)
   • Groups (add via /dashboard/groups)
   • Leads (will be scraped automatically)
`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
