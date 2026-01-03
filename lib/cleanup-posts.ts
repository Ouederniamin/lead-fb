// Post Cleanup Service
// Deletes posts older than 7 days that are NOT leads
// Run daily at 3 AM via cron job

import { prisma } from "@/lib/db";

export interface CleanupResult {
  success: boolean;
  deletedCount: number;
  keptLeadPosts: number;
  duration: number;
  error?: string;
}

/**
 * Clean up old posts from the database
 * - Deletes posts older than 7 days
 * - Keeps posts that are linked to leads (isLead = true)
 */
export async function cleanupOldPosts(): Promise<CleanupResult> {
  const startTime = Date.now();
  
  try {
    // Calculate 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    // Count posts that will be kept (leads)
    const keptLeadPosts = await prisma.groupPost.count({
      where: {
        scrapedAt: { lt: sevenDaysAgo },
        isLead: true,
      },
    });
    
    // Delete posts older than 7 days that are NOT leads
    const deleted = await prisma.groupPost.deleteMany({
      where: {
        scrapedAt: { lt: sevenDaysAgo },
        OR: [
          { isLead: false },
          { isLead: null },
        ],
      },
    });
    
    const duration = Date.now() - startTime;
    
    console.log(`🧹 Post cleanup complete:`);
    console.log(`   - Deleted: ${deleted.count} old posts`);
    console.log(`   - Kept: ${keptLeadPosts} lead posts`);
    console.log(`   - Duration: ${duration}ms`);
    
    return {
      success: true,
      deletedCount: deleted.count,
      keptLeadPosts,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    console.error(`❌ Post cleanup failed: ${errorMsg}`);
    
    return {
      success: false,
      deletedCount: 0,
      keptLeadPosts: 0,
      duration,
      error: errorMsg,
    };
  }
}

/**
 * Get statistics about posts in the database
 */
export async function getPostStats(): Promise<{
  totalPosts: number;
  postsLast7Days: number;
  postsOlderThan7Days: number;
  leadPosts: number;
  nonLeadPosts: number;
  postsWithContent: number;
  postsWithoutContent: number;
}> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const [
    totalPosts,
    postsLast7Days,
    postsOlderThan7Days,
    leadPosts,
    nonLeadPosts,
    postsWithContent,
    postsWithoutContent,
  ] = await Promise.all([
    prisma.groupPost.count(),
    prisma.groupPost.count({ where: { scrapedAt: { gte: sevenDaysAgo } } }),
    prisma.groupPost.count({ where: { scrapedAt: { lt: sevenDaysAgo } } }),
    prisma.groupPost.count({ where: { isLead: true } }),
    prisma.groupPost.count({ where: { OR: [{ isLead: false }, { isLead: null }] } }),
    prisma.groupPost.count({ where: { hasContent: true } }),
    prisma.groupPost.count({ where: { hasContent: false } }),
  ]);
  
  return {
    totalPosts,
    postsLast7Days,
    postsOlderThan7Days,
    leadPosts,
    nonLeadPosts,
    postsWithContent,
    postsWithoutContent,
  };
}
