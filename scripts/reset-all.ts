import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🗑️  Deleting all posts...");
  const deleted = await prisma.groupPost.deleteMany({});
  console.log(`   ✅ Deleted ${deleted.count} posts`);

  console.log("🔄 Resetting all groups...");
  const reset = await prisma.group.updateMany({
    data: {
      isInitialized: false,
      totalPosts: 0,
      totalLeads: 0,
    },
  });
  console.log(`   ✅ Reset ${reset.count} groups`);

  console.log("✅ Done!");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
