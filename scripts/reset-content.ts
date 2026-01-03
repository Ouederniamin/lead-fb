import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🔄 Resetting content for all posts (keeping URLs)...");
  
  const result = await prisma.groupPost.updateMany({
    data: {
      hasContent: false,
      postText: null,
      authorName: null,
      authorProfileUrl: null,
      isAnonymous: false,
      hasImages: false,
      hasVideo: false,
      isAnalyzed: false,
      isLead: null,
      intentScore: null,
      matchedService: null,
      aiAnalysis: null,
    },
  });
  
  console.log(`   ✅ Reset content for ${result.count} posts`);
  console.log("✅ Done! Posts URLs are preserved, ready to re-extract content.");
  
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
