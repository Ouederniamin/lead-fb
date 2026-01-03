#!/usr/bin/env npx tsx
/**
 * Cleanup Posts Script
 * 
 * Usage:
 *   npx tsx scripts/cleanup-posts.ts <groupId> [filter]
 * 
 * Filters:
 *   unused     - Posts without content AND not leads (default)
 *   no-content - Posts that never had content extracted
 *   not-leads  - Posts analyzed but not leads
 *   all        - All posts (dangerous!)
 * 
 * Examples:
 *   npx tsx scripts/cleanup-posts.ts clxyz123 unused
 *   npx tsx scripts/cleanup-posts.ts clxyz123 no-content
 *   npx tsx scripts/cleanup-posts.ts --list  # List all groups
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

type Filter = 'unused' | 'no-content' | 'not-leads' | 'all';

async function listGroups() {
  const groups = await prisma.group.findMany({
    select: {
      id: true,
      name: true,
      _count: {
        select: { posts: true }
      }
    },
    orderBy: { name: 'asc' }
  });

  console.log('\n📋 Available Groups:\n');
  console.log('ID'.padEnd(30) + 'Name'.padEnd(40) + 'Posts');
  console.log('-'.repeat(80));
  
  for (const group of groups) {
    console.log(
      group.id.padEnd(30) + 
      (group.name || 'Unnamed').slice(0, 38).padEnd(40) + 
      group._count.posts.toString()
    );
  }
  console.log('');
}

async function getPostStats(groupId: string) {
  const stats = await prisma.groupPost.groupBy({
    by: ['hasContent', 'isLead'],
    where: { groupId },
    _count: true,
  });

  let total = 0;
  let noContent = 0;
  let notLeads = 0;
  let leads = 0;

  for (const stat of stats) {
    total += stat._count;
    if (!stat.hasContent) noContent += stat._count;
    if (stat.isLead === false) notLeads += stat._count;
    if (stat.isLead === true) leads += stat._count;
  }

  // Count unused (no content AND no lead)
  const unused = await prisma.groupPost.count({
    where: {
      groupId,
      hasContent: false,
      leadId: null,
    }
  });

  return { total, noContent, notLeads, leads, unused };
}

async function deletePostsWithFilter(groupId: string, filter: Filter) {
  let where: Record<string, unknown> = { groupId };
  let description = '';

  switch (filter) {
    case 'unused':
      where = { groupId, hasContent: false, leadId: null };
      description = 'posts without content and not leads';
      break;
    case 'no-content':
      where = { groupId, hasContent: false };
      description = 'posts without content';
      break;
    case 'not-leads':
      where = { groupId, isLead: false };
      description = 'posts analyzed as not leads';
      break;
    case 'all':
      where = { groupId };
      description = 'ALL posts';
      break;
  }

  const result = await prisma.groupPost.deleteMany({ where });
  return { deleted: result.count, description };
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
🧹 Post Cleanup Script

Usage:
  npx tsx scripts/cleanup-posts.ts <groupId> [filter]
  npx tsx scripts/cleanup-posts.ts --list

Filters:
  unused      Posts without content AND not leads (default)
  no-content  Posts that never had content extracted
  not-leads   Posts analyzed but not leads
  all         All posts (⚠️ dangerous!)

Examples:
  npx tsx scripts/cleanup-posts.ts clxyz123
  npx tsx scripts/cleanup-posts.ts clxyz123 no-content
  npx tsx scripts/cleanup-posts.ts --list
`);
    process.exit(0);
  }

  if (args[0] === '--list' || args[0] === '-l') {
    await listGroups();
    process.exit(0);
  }

  const groupId = args[0];
  const filter = (args[1] as Filter) || 'unused';

  // Validate filter
  const validFilters: Filter[] = ['unused', 'no-content', 'not-leads', 'all'];
  if (!validFilters.includes(filter)) {
    console.error(`❌ Invalid filter: ${filter}`);
    console.error(`   Valid filters: ${validFilters.join(', ')}`);
    process.exit(1);
  }

  // Check if group exists
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true, name: true }
  });

  if (!group) {
    console.error(`❌ Group not found: ${groupId}`);
    console.log('   Run with --list to see all groups');
    process.exit(1);
  }

  console.log(`\n🎯 Group: ${group.name || 'Unnamed'}`);
  console.log(`   ID: ${group.id}\n`);

  // Show current stats
  const stats = await getPostStats(groupId);
  console.log('📊 Current Stats:');
  console.log(`   Total posts:     ${stats.total}`);
  console.log(`   No content:      ${stats.noContent}`);
  console.log(`   Not leads:       ${stats.notLeads}`);
  console.log(`   Leads:           ${stats.leads}`);
  console.log(`   Unused (target): ${stats.unused}`);
  console.log('');

  // Confirm deletion for 'all' filter
  if (filter === 'all') {
    console.log('⚠️  WARNING: This will delete ALL posts for this group!');
    console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  // Perform deletion
  console.log(`🗑️  Deleting with filter: ${filter}...`);
  const result = await deletePostsWithFilter(groupId, filter);
  
  console.log(`\n✅ Deleted ${result.deleted} ${result.description}`);

  // Show updated stats
  const newStats = await getPostStats(groupId);
  console.log(`\n📊 Updated Stats:`);
  console.log(`   Remaining posts: ${newStats.total}`);
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
