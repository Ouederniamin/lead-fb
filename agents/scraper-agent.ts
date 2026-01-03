// Scraper Agent
// Dedicated agent for scraping groups and creating leads
// Uses ONE account to scrape ALL groups on schedule

import { BrowserSession, ScrapedPost, AIAnalysisResult } from "./types";
import {
  launchBrowser,
  warmupSession,
  closeBrowser,
  incrementalScrape,
  fullScrape,
  analyzePostForLead,
  humanDelay,
  extractPostId,
} from "./procedures";
import { shouldAgentRun } from "@/lib/schedule-service";
import { prisma } from "@/lib/db";

export interface ScraperAgentInput {
  accountId: string;
  groups: Array<{
    id: string;
    url: string;
    name?: string;
    lastScrapedPostUrl: string | null;
    isInitialized?: boolean;
  }>;
  headless?: boolean;
  skipScheduleCheck?: boolean;
}

export interface ScraperPostResult {
  post: ScrapedPost;
  groupPostId: string | null;
  analysis: AIAnalysisResult | null;
  isLead: boolean;
  leadId: string | null;
}

export interface ScraperGroupResult {
  groupId: string;
  groupUrl: string;
  groupName?: string;
  postsScraped: number;
  postsAnalyzed: number;
  groupPostsCreated: number;
  leadsCreated: number;
  newLastScrapedPostUrl: string | null;
  postResults: ScraperPostResult[];
  error?: string;
}

export interface ScraperAgentResult {
  success: boolean;
  agentType: "SCRAPER";
  startedAt: Date;
  completedAt: Date;
  duration: number;
  logs: string[];
  errors: string[];
  stats: {
    groupsProcessed: number;
    postsScraped: number;
    postsAnalyzed: number;
    groupPostsCreated: number;
    leadsCreated: number;
  };
  groupResults: ScraperGroupResult[];
}

export async function runScraperAgent(
  input: ScraperAgentInput,
  onLog?: (msg: string) => void
): Promise<ScraperAgentResult> {
  const logs: string[] = [];
  const errors: string[] = [];
  const startedAt = new Date();
  const groupResults: ScraperGroupResult[] = [];

  const log = (msg: string) => {
    const timestamp = new Date().toISOString();
    const logMsg = `[${timestamp}] ${msg}`;
    logs.push(logMsg);
    console.log(`[ScraperAgent] ${msg}`);
    onLog?.(msg);
  };

  // Check schedule (unless skipped for testing)
  if (!input.skipScheduleCheck) {
    const scheduleCheck = await shouldAgentRun("LEAD_GEN");
    if (!scheduleCheck.shouldRun) {
      log(`⏸️ Skipping: ${scheduleCheck.reason}`);
      return {
        success: true,
        agentType: "SCRAPER",
        startedAt,
        completedAt: new Date(),
        duration: 0,
        logs,
        errors,
        stats: {
          groupsProcessed: 0,
          postsScraped: 0,
          postsAnalyzed: 0,
          groupPostsCreated: 0,
          leadsCreated: 0,
        },
        groupResults: [],
      };
    }
    log(`✅ Schedule check: ${scheduleCheck.reason}`);
  }

  log("🚀 Starting Scraper Agent");
  log(`👤 Account: ${input.accountId}`);
  log(`📍 Groups to process: ${input.groups.length}`);

  let session: BrowserSession | null = null;

  const totalStats = {
    groupsProcessed: 0,
    postsScraped: 0,
    postsAnalyzed: 0,
    groupPostsCreated: 0,
    leadsCreated: 0,
  };

  try {
    // Launch browser
    log("🌐 Launching browser...");
    session = await launchBrowser({
      accountId: input.accountId,
      headless: input.headless ?? false,
    });

    // Warmup session
    const isLoggedIn = await warmupSession(session.page, log);
    if (!isLoggedIn) {
      throw new Error("Account is not logged in");
    }

    // Process each group
    for (const group of input.groups) {
      log(`\n📂 Processing group: ${group.name || group.url}`);

      const groupResult: ScraperGroupResult = {
        groupId: group.id,
        groupUrl: group.url,
        groupName: group.name,
        postsScraped: 0,
        postsAnalyzed: 0,
        groupPostsCreated: 0,
        leadsCreated: 0,
        newLastScrapedPostUrl: group.lastScrapedPostUrl,
        postResults: [],
      };

      try {
        // Use incremental scrape - stops when hitting a known post from database
        log(`📊 Incremental scrape (checking against ALL known posts in DB)`);
        const scrapeResult = await incrementalScrape(
          session.page,
          group.url,
          group.id,
          log
        );

        log(`✅ Scraped ${scrapeResult.posts.length} posts`);
        groupResult.postsScraped = scrapeResult.posts.length;
        totalStats.postsScraped += scrapeResult.posts.length;

        // Get newest post info for tracking (we'll extract the permalinkId after saving to DB)
        let newestPermalinkId: string | null = null;
        if (scrapeResult.posts.length > 0) {
          const newestPost = scrapeResult.posts[0];
          newestPermalinkId = extractPostId(newestPost.postUrl) || null;
          groupResult.newLastScrapedPostUrl = newestPost.postUrl;
        }

        // Process posts: Save to GroupPost + Analyze with AI
        const BATCH_SIZE = 10;
        const posts = scrapeResult.posts;

        for (let batchIndex = 0; batchIndex < posts.length; batchIndex += BATCH_SIZE) {
          const batch = posts.slice(batchIndex, batchIndex + BATCH_SIZE);
          const currentBatch = Math.floor(batchIndex / BATCH_SIZE) + 1;
          const totalBatches = Math.ceil(posts.length / BATCH_SIZE);

          log(`\n⚡ Batch ${currentBatch}/${totalBatches}: Processing ${batch.length} posts...`);

          // Process each post in the batch
          const batchResults = await Promise.all(
            batch.map(async (post, idx) => {
              const postNum = batchIndex + idx + 1;
              const result: ScraperPostResult = {
                post,
                groupPostId: null,
                analysis: null,
                isLead: false,
                leadId: null,
              };

              try {
                // Extract stable permalink ID from postUrl
                const permalinkId = extractPostId(post.postUrl);
                
                // 1. Create GroupPost record (for ALL posts) - using postUrl as unique key
                const groupPost = await prisma.groupPost.upsert({
                  where: { postUrl: post.postUrl },
                  update: {
                    postText: post.content,
                    authorName: post.authorName || null,
                    authorFbId: post.authorFbId || null,
                    authorProfileUrl: post.authorProfileUrl || null,
                    isAnonymous: post.isAnonymous || false,
                    scrapedAt: new Date(),
                    hasContent: true,
                    extractionMethod: 'story_message',
                    permalinkId: permalinkId || undefined,  // Update if we have it now
                  },
                  create: {
                    postUrl: post.postUrl,
                    permalinkId: permalinkId || undefined,  // STABLE ID for comparison
                    shareUrl: post.shareUrl || null,  // NOT stable - can change
                    groupId: group.id,
                    postText: post.content,
                    authorName: post.authorName || null,
                    authorFbId: post.authorFbId || null,
                    authorProfileUrl: post.authorProfileUrl || null,
                    isAnonymous: post.isAnonymous || false,
                    hasImages: false,
                    hasVideo: false,
                    hasContent: true,
                    extractionMethod: 'story_message',
                  },
                });

                result.groupPostId = groupPost.id;
                groupResult.groupPostsCreated++;
                totalStats.groupPostsCreated++;

                // 2. Analyze with AI to detect leads
                const silentLog = () => {};
                const analysis = await analyzePostForLead(post.content, silentLog);
                result.analysis = analysis;
                groupResult.postsAnalyzed++;
                totalStats.postsAnalyzed++;

                // Update GroupPost with analysis
                await prisma.groupPost.update({
                  where: { id: groupPost.id },
                  data: {
                    isAnalyzed: true,
                    isLead: analysis.isLead,
                    aiAnalysis: analysis as object,
                  },
                });

                // Log result
                if (analysis.isLead) {
                  log(`   ✅ #${postNum}: LEAD → ${analysis.matchedService}`);
                } else {
                  const preview = post.content.substring(0, 40).replace(/\n/g, " ");
                  log(`   ❌ #${postNum}: Not a lead (${preview}...)`);
                }

                // 3. Create Lead if qualified
                if (analysis.isLead) {
                  result.isLead = true;

                  try {
                    const lead = await prisma.lead.create({
                      data: {
                        groupId: group.id,
                        postUrl: post.postUrl,
                        authorName: post.authorName || null,
                        authorProfileUrl: post.authorProfileUrl || null,
                        authorFbId: post.authorFbId || null,
                        isAnonymous: post.isAnonymous || false,
                        postText: post.content,
                        intentScore: 3, // Default score for qualified leads
                        matchedService: analysis.matchedService || null,
                        aiAnalysis: analysis as object,
                        status: "NEW",
                        stage: "LEAD",
                      },
                    });

                    result.leadId = lead.id;
                    groupResult.leadsCreated++;
                    totalStats.leadsCreated++;

                    // Link GroupPost to Lead
                    await prisma.groupPost.update({
                      where: { id: groupPost.id },
                      data: { leadId: lead.id },
                    });

                    log(`   💾 Created lead: ${lead.id}`);
                  } catch (dbError) {
                    if (
                      dbError instanceof Error &&
                      dbError.message.includes("Unique constraint")
                    ) {
                      log(`   ⚠️ Lead already exists for this post`);
                    } else {
                      log(`   ❌ DB error creating lead: ${dbError}`);
                    }
                  }
                }

                return result;
              } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err);
                log(`   ⚠️ #${postNum}: Error - ${errMsg}`);
                return result;
              }
            })
          );

          // Add batch results
          groupResult.postResults.push(...batchResults);

          // Small delay between batches
          if (batchIndex + BATCH_SIZE < posts.length) {
            await humanDelay(500, 1000);
          }
        }

        // Update group in database with lastScrapedPermalinkId (stable identifier)
        try {
          await prisma.group.update({
            where: { id: group.id },
            data: {
              lastScrapedPermalinkId: newestPermalinkId,  // STABLE: for comparison
              lastScrapedPostId: groupResult.newLastScrapedPostUrl,  // Full URL for reference
              lastScrapedAt: new Date(),
              isInitialized: true,
              initializedAt: group.isInitialized ? undefined : new Date(),
              totalPosts: { increment: groupResult.postsScraped },
              totalLeads: { increment: groupResult.leadsCreated },
            },
          });
          log(`💾 Updated group ${group.id} (lastScrapedPermalinkId: ${newestPermalinkId})`);
        } catch (dbError) {
          log(`⚠️ Failed to update group: ${dbError}`);
        }

        groupResults.push(groupResult);
        totalStats.groupsProcessed++;

        // Delay between groups
        if (input.groups.indexOf(group) < input.groups.length - 1) {
          log("⏳ Waiting before next group...");
          await humanDelay(10000, 20000);
        }
      } catch (groupError) {
        const errorMsg =
          groupError instanceof Error ? groupError.message : String(groupError);
        log(`❌ Error processing group ${group.url}: ${errorMsg}`);
        errors.push(`Group ${group.id}: ${errorMsg}`);
        groupResult.error = errorMsg;
        groupResults.push(groupResult);
      }
    }

    const completedAt = new Date();

    log(`\n📊 Scraper Agent Summary:`);
    log(`   Groups: ${totalStats.groupsProcessed}`);
    log(`   Posts scraped: ${totalStats.postsScraped}`);
    log(`   GroupPosts created: ${totalStats.groupPostsCreated}`);
    log(`   Leads created: ${totalStats.leadsCreated}`);

    return {
      success: true,
      agentType: "SCRAPER",
      startedAt,
      completedAt,
      duration: completedAt.getTime() - startedAt.getTime(),
      logs,
      errors,
      stats: totalStats,
      groupResults,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log(`❌ Fatal error: ${errorMsg}`);
    errors.push(errorMsg);

    const completedAt = new Date();

    return {
      success: false,
      agentType: "SCRAPER",
      startedAt,
      completedAt,
      duration: completedAt.getTime() - startedAt.getTime(),
      logs,
      errors,
      stats: totalStats,
      groupResults,
    };
  } finally {
    if (session) {
      log("🔒 Closing browser...");
      await closeBrowser(session);
    }
    log("🏁 Scraper Agent completed");
  }
}

// Helper to extract Facebook post ID from URL
function extractFbPostId(postUrl: string): string | null {
  // Match patterns like /posts/123 or ?story_fbid=123 or permalink/123
  const patterns = [
    /\/posts\/(\d+)/,
    /story_fbid=(\d+)/,
    /permalink\/(\d+)/,
    /\/(\d+)\/?$/,
  ];

  for (const pattern of patterns) {
    const match = postUrl.match(pattern);
    if (match) {
      return match[1];
    }
  }

  // Generate a hash if no ID found
  return null;
}
