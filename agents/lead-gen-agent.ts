// Agent 2: Lead Gen Agent (Post Tracking System v2)
// Scrapes NEW posts only, using pre-fetch of last 10 posts to detect when to stop
// Pre-fetches last 10 post URLs, checks in-memory Set, stops at known post

import { BrowserSession, LeadGenResult, ScrapedPost, AIAnalysisResult } from "./types";
import {
  launchBrowser,
  warmupSession,
  closeBrowser,
  navigateToGroup,
  analyzePostForLead,
  humanDelay,
  postActionDelay,
} from "./procedures";
import { shouldAgentRun } from "@/lib/schedule-service";
import { prisma } from "@/lib/db";
import { Page } from "playwright";

// Helper function to create session notifications
async function createSessionNotification(
  accountId: string, 
  type: "SESSION_EXPIRED" | "SESSION_NEEDS_LOGIN" | "ACCOUNT_BANNED" | "AGENT_ERROR",
  message: string
) {
  try {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: { name: true, email: true },
    });

    const accountName = account?.name || account?.email || "Unknown Account";
    
    const notificationData: Record<string, { title: string; severity: "WARNING" | "ERROR" | "CRITICAL"; sessionStatus: string }> = {
      SESSION_EXPIRED: { title: "Session Expired", severity: "WARNING", sessionStatus: "EXPIRED" },
      SESSION_NEEDS_LOGIN: { title: "Re-login Required", severity: "ERROR", sessionStatus: "NEEDS_PASSWORD" },
      ACCOUNT_BANNED: { title: "Account Banned", severity: "CRITICAL", sessionStatus: "BANNED" },
      AGENT_ERROR: { title: "Agent Error", severity: "ERROR", sessionStatus: "ERROR" },
    };

    const config = notificationData[type];
    if (!config) return;

    await prisma.account.update({
      where: { id: accountId },
      data: {
        sessionStatus: config.sessionStatus as any,
        sessionError: message,
        sessionExpiredAt: new Date(),
        isLoggedIn: false,
      },
    });

    await prisma.notification.create({
      data: {
        type: type as any,
        severity: config.severity as any,
        title: `${config.title}: ${accountName}`,
        message,
        accountId,
        actionUrl: "/dashboard/accounts",
        actionLabel: "Fix Account",
      },
    });
    
    console.log(`[Notification] Created: ${config.title} for ${accountName}`);
  } catch (err) {
    console.error("[Notification] Failed to create:", err);
  }
}

export interface LeadGenInput {
  accountId: string;
  groups: Array<{
    id: string;
    url: string;
    lastScrapedPostUrl: string | null;
  }>;
  headless?: boolean;
  maxPosts?: number;
  autoComment?: boolean;
  autoDM?: boolean;
  skipScheduleCheck?: boolean; // For testing
}

export interface LeadGenPostResult {
  post: ScrapedPost;
  analysis: AIAnalysisResult;
  isLead: boolean;
  commented: boolean;
  dmSent: boolean;
}

export interface LeadGenGroupResult {
  groupId: string;
  groupUrl: string;
  postsScraped: number;
  postsAnalyzed: number;
  leadsCreated: number;
  newLastScrapedPostUrl: string | null;
  postResults: LeadGenPostResult[];
}

// ============================================
// STEP 0: PRE-FETCH LAST 10 KNOWN POSTS
// ============================================
async function prefetchKnownPosts(
  groupId: string,
  log: (msg: string) => void
): Promise<Set<string>> {
  const recentPosts = await prisma.groupPost.findMany({
    where: { groupId },
    orderBy: { scrapedAt: 'desc' },
    take: 10,
    select: { postUrl: true, shareUrl: true },
  });
  
  // Add both postUrl and shareUrl to known URLs for comparison
  // We compare against share URLs since that's what we collect from clipboard
  const knownUrls = new Set<string>();
  for (const post of recentPosts) {
    if (post.shareUrl) knownUrls.add(post.shareUrl);
    if (post.postUrl) knownUrls.add(post.postUrl);
  }
  log(`📋 Loaded ${recentPosts.length} recent posts (${knownUrls.size} URLs to check against)`);
  
  return knownUrls;
}

// ============================================
// PHASE 1: SCROLL & GET URLS VIA SHARE BUTTON (step by step, checking against known URLs)
// ============================================
async function phase1ScrollAndCollect(
  page: Page,
  groupId: string,
  knownUrls: Set<string>,
  log: (msg: string) => void
): Promise<{ newUrls: string[]; hitKnownPost: boolean }> {
  const BATCH_SIZE = 10;
  const MAX_POSTS = 50; // Regular scraping gets fewer posts than first-time
  const collectedUrls: string[] = [];
  const allUrls: string[] = [];
  const seenUrls = new Set<string>();
  let totalSaved = 0;
  let hitKnownPost = false;
  let consecutiveFailures = 0;
  const MAX_CONSECUTIVE_FAILURES = 15;
  
  log(`\n📜 PHASE 1: Scrolling for new posts via Share button (checking against ${knownUrls.size} known URLs)...`);
  
  // Get number of posts in feed
  const postCount = await page.evaluate(() => {
    return document.querySelectorAll('[role="feed"] > div').length;
  });
  
  log(`   Found ${postCount} posts in feed initially`);
  
  // Process posts one by one - scroll, click share, copy link
  for (let postIndex = 0; postIndex < Math.min(postCount + 100, 300) && totalSaved < MAX_POSTS && !hitKnownPost; postIndex++) {
    // Check if we should stop due to too many failures
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      log(`   ⚠️ Too many failures (${consecutiveFailures}), stopping`);
      break;
    }
    
    try {
      // Scroll post into view
      const postPosition = await page.evaluate((idx: number) => {
        const feedItems = document.querySelectorAll('[role="feed"] > div');
        const post = feedItems[idx];
        if (!post) return null;
        const rect = post.getBoundingClientRect();
        return { top: rect.top, height: rect.height };
      }, postIndex);
      
      if (!postPosition || postPosition.height < 50) {
        // Skip empty/small items (likely ads or placeholders)
        consecutiveFailures++;
        continue;
      }
      
      // Scroll to bring post into view
      if (postPosition.top < 100 || postPosition.top > 500) {
        const scrollNeeded = postPosition.top - 200;
        await page.evaluate((amount: number) => window.scrollBy(0, amount), scrollNeeded);
        await humanDelay(200, 300);
      }
      
      // Find and click share button
      const shareButton = await page.evaluate((idx: number) => {
        const feedItems = document.querySelectorAll('[role="feed"] > div');
        const post = feedItems[idx];
        if (!post) return null;
        
        // Method 1: data-ad-rendering-role
        const shareByDataAttr = post.querySelector('[data-ad-rendering-role="share_button"]');
        if (shareByDataAttr) {
          const btn = shareByDataAttr.closest('[role="button"]');
          if (btn) {
            const rect = btn.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
            }
          }
        }
        
        // Method 2: Look for "Share" text in buttons
        const allButtons = post.querySelectorAll('[role="button"]');
        for (const btn of allButtons) {
          const text = (btn.textContent || '').trim().toLowerCase();
          if (text === 'share' || text === 'partager' || text === 'condividi' || text === 'compartir') {
            const rect = btn.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
            }
          }
        }
        
        return null;
      }, postIndex);

      if (!shareButton) {
        // No share button - might be an ad or announcement
        consecutiveFailures++;
        continue;
      }

      // Click share button
      await page.mouse.click(shareButton.x, shareButton.y);
      await humanDelay(800, 1200);

      // Click "Copy link" option
      const copyLinkClicked = await page.evaluate(() => {
        const searchTexts = ['copy link', 'copia link', 'copier le lien', 'copiar enlace', 'copy'];
        
        // Find menu items
        const menuItems = document.querySelectorAll('[role="menuitem"], [role="menu"] [role="button"], [data-visualcompletion="ignore-dynamic"] [role="button"]');
        for (const item of menuItems) {
          const text = (item.textContent || '').toLowerCase();
          for (const search of searchTexts) {
            if (text.includes(search)) {
              (item as HTMLElement).click();
              return true;
            }
          }
        }
        
        // Fallback: spans with exact text
        const spans = document.querySelectorAll('span');
        for (const span of spans) {
          const text = (span.textContent || '').trim().toLowerCase();
          if (searchTexts.includes(text)) {
            const clickable = span.closest('[role="button"], [role="menuitem"], [tabindex]');
            if (clickable) {
              (clickable as HTMLElement).click();
              return true;
            }
          }
        }
        
        return false;
      });

      if (!copyLinkClicked) {
        await page.keyboard.press('Escape');
        await humanDelay(200, 300);
        consecutiveFailures++;
        continue;
      }

      await humanDelay(500, 800);

      // Read clipboard
      let postUrl: string | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        postUrl = await page.evaluate(async () => {
          try {
            return await navigator.clipboard.readText();
          } catch {
            return null;
          }
        });
        if (postUrl && postUrl.includes('facebook.com')) break;
        await humanDelay(200, 300);
      }

      // Close any remaining menus
      await page.keyboard.press('Escape');
      await humanDelay(100, 200);

      if (postUrl && postUrl.includes('facebook.com')) {
        // Clean URL - remove tracking params
        const cleanUrl = postUrl.split('?')[0];
        
        // Check if this is a known URL (hit a post we've already scraped)
        if (knownUrls.has(cleanUrl)) {
          log(`   🛑 Hit known post! Stopping scrape.`);
          hitKnownPost = true;
          break;
        }
        
        if (!seenUrls.has(cleanUrl)) {
          seenUrls.add(cleanUrl);
          collectedUrls.push(cleanUrl);
          allUrls.push(cleanUrl);
          consecutiveFailures = 0; // Reset on success
          
          // Log progress every 5 URLs
          if (collectedUrls.length % 5 === 0 || collectedUrls.length === 1) {
            log(`   ✅ Post ${postIndex + 1}: Got ${collectedUrls.length} URLs (${totalSaved + collectedUrls.length} total)`);
          }
        }
      } else {
        consecutiveFailures++;
      }
      
      // Save batch to DB
      if (collectedUrls.length >= BATCH_SIZE) {
        const batch = collectedUrls.splice(0, BATCH_SIZE);
        
        try {
          await prisma.groupPost.createMany({
            data: batch.map(url => ({
              postUrl: url,
              shareUrl: url,  // Save original share URL for comparison
              groupId: groupId,
              hasContent: false,
            })),
            skipDuplicates: true,
          });
          
          // Add to known URLs so we don't process them again
          batch.forEach(url => knownUrls.add(url));
          
          totalSaved += batch.length;
          log(`   💾 Saved batch of ${batch.length} URLs to DB (total: ${totalSaved})`);
        } catch (dbErr) {
          log(`   ⚠️ DB error saving batch: ${dbErr}`);
        }
      }
      
    } catch (err) {
      // Silently continue on errors
      await page.keyboard.press('Escape').catch(() => {});
      await humanDelay(100, 200);
      consecutiveFailures++;
    }
  }
  
  // Save any remaining URLs
  if (collectedUrls.length > 0 && totalSaved < MAX_POSTS) {
    const remaining = collectedUrls.slice(0, MAX_POSTS - totalSaved);
    
    try {
      await prisma.groupPost.createMany({
        data: remaining.map(url => ({
          postUrl: url,
          shareUrl: url,  // Save original share URL for comparison
          groupId: groupId,
          hasContent: false,
        })),
        skipDuplicates: true,
      });
      
      totalSaved += remaining.length;
      log(`   💾 Saved ${remaining.length} remaining URLs to DB (total: ${totalSaved})`);
    } catch (dbErr) {
      log(`   ⚠️ DB error saving remaining: ${dbErr}`);
    }
  }
  
  log(`✅ Phase 1 complete: ${totalSaved} new posts found`);
  
  return { newUrls: allUrls, hitKnownPost };
}

// ============================================
// PHASE 2: EXTRACT CONTENT (visit each post URL directly)
// ============================================
async function phase2ExtractContent(
  page: Page,
  groupId: string,
  groupUrl: string,
  log: (msg: string) => void
): Promise<number> {
  log(`\n📝 PHASE 2: Extracting content by visiting each post...`);
  
  // Get posts without content from DB
  const postsWithoutContent = await prisma.groupPost.findMany({
    where: { groupId, hasContent: false },
    select: { id: true, postUrl: true },
    orderBy: { scrapedAt: 'desc' },
  });
  
  log(`   Found ${postsWithoutContent.length} posts without content`);
  
  if (postsWithoutContent.length === 0) {
    return 0;
  }
  
  let updated = 0;
  let failed = 0;
  
  for (let i = 0; i < postsWithoutContent.length; i++) {
    const post = postsWithoutContent[i];
    
    // Log progress every 5 posts
    if ((i + 1) % 5 === 0 || i === 0) {
      log(`   📄 Processing post ${i + 1}/${postsWithoutContent.length}...`);
    }
    
    try {
      // Navigate to the post URL (might be share URL that redirects)
      await page.goto(post.postUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await humanDelay(1500, 2500);
      
      // Capture the resolved URL (permalink) after any redirects
      const resolvedUrl = page.url().split('?')[0];  // Clean URL without tracking params
      
      // Extract content from the post page
      const content = await page.evaluate(() => {
        // Get the main post content
        const possibleSelectors = [
          '[data-ad-preview="message"]',
          '[data-ad-comet-preview="message"]',
          '[dir="auto"][style*="text-align"]',
          '.userContent',
          '[data-testid="post_message"]',
        ];
        
        let postText = '';
        for (const selector of possibleSelectors) {
          const el = document.querySelector(selector);
          if (el && el.textContent && el.textContent.trim().length > 10) {
            postText = el.textContent.trim();
            break;
          }
        }
        
        // Fallback: get text from div[dir="auto"] elements
        if (!postText) {
          const mainContent = document.querySelector('[role="main"]');
          if (mainContent) {
            const textSpans = mainContent.querySelectorAll('div[dir="auto"]');
            const texts: string[] = [];
            textSpans.forEach(span => {
              const text = span.textContent?.trim();
              if (text && text.length > 20 && !text.includes('Like') && !text.includes('Comment') && !text.includes('Share')) {
                texts.push(text);
              }
            });
            if (texts.length > 0) {
              postText = texts.sort((a, b) => b.length - a.length)[0];
            }
          }
        }
        
        // Get author info
        let authorName = '';
        let authorProfileUrl = '';
        
        const authorLinks = document.querySelectorAll('a[role="link"]');
        for (const link of authorLinks) {
          const href = (link as HTMLAnchorElement).href;
          if (href && (href.includes('/user/') || href.includes('facebook.com/') && !href.includes('/groups/'))) {
            const name = link.textContent?.trim();
            if (name && name.length > 1 && name.length < 50 && !name.includes('·')) {
              authorName = name;
              authorProfileUrl = href.split('?')[0];
              break;
            }
          }
        }
        
        const hasImages = document.querySelectorAll('img[src*="scontent"]').length > 1;
        const hasVideo = document.querySelectorAll('video, [data-video-id]').length > 0;
        
        // Determine if anonymous:
        // 1. If we found a real author name AND profile URL, NOT anonymous
        // 2. If authorName is empty or explicitly "anonymous", IS anonymous
        const hasRealAuthor = authorName && 
          authorName.trim() !== '' && 
          !authorName.toLowerCase().includes('anonymous') && 
          authorProfileUrl && 
          authorProfileUrl.length > 0;
        
        let isAnonymous = false;
        if (!hasRealAuthor) {
          // No real author found, check if it's explicitly anonymous
          isAnonymous = authorName === '' || 
                       authorName.toLowerCase().includes('anonymous');
        }
        
        return { postText, authorName, authorProfileUrl, hasImages, hasVideo, isAnonymous };
      });
      
      // Update the post in DB
      if (content.postText && content.postText.length > 10) {
        // Check if the resolved URL is different from original (share URL redirected to permalink)
        const urlChanged = resolvedUrl !== post.postUrl;
        
        try {
          await prisma.groupPost.update({
            where: { id: post.id },
            data: {
              // Update postUrl to the resolved permalink if it changed
              ...(urlChanged && { postUrl: resolvedUrl }),
              postText: content.postText,
              authorName: content.authorName || null,
              authorProfileUrl: content.authorProfileUrl || null,
              isAnonymous: content.isAnonymous,
              hasContent: true,
              hasImages: content.hasImages,
              hasVideo: content.hasVideo,
            },
          });
        } catch (updateError) {
          // If URL update fails (e.g., duplicate), just update without URL change
          if (urlChanged) {
            await prisma.groupPost.update({
              where: { id: post.id },
              data: {
                postText: content.postText,
                authorName: content.authorName || null,
                authorProfileUrl: content.authorProfileUrl || null,
                isAnonymous: content.isAnonymous,
                hasContent: true,
                hasImages: content.hasImages,
                hasVideo: content.hasVideo,
              },
            });
          } else {
            throw updateError;
          }
        }
        updated++;
      } else {
        await prisma.groupPost.update({
          where: { id: post.id },
          data: { hasContent: true, postText: '(content not extracted)' },
        });
        failed++;
      }
      
    } catch (err) {
      try {
        await prisma.groupPost.update({
          where: { id: post.id },
          data: { hasContent: true, postText: '(failed to load)' },
        });
      } catch {}
      failed++;
      
      // Check if browser crashed
      try {
        await page.evaluate(() => 1);
      } catch {
        log(`   ❌ Browser crashed at post ${i + 1}`);
        break;
      }
    }
    
    await humanDelay(400, 800);
  }
  
  log(`\n✅ Phase 2 complete: ${updated} posts extracted, ${failed} failed`);
  
  return updated;
}

// ============================================
// PHASE 3: AI ANALYSIS (batch processing)
// ============================================
async function phase3AnalyzeWithAI(
  groupId: string,
  log: (msg: string) => void
): Promise<{ analyzed: number; leadsCreated: number }> {
  const BATCH_SIZE = 10;
  
  log(`\n🤖 PHASE 3: Analyzing posts with AI...`);
  
  // Get all posts with content that haven't been analyzed
  const postsToAnalyze = await prisma.groupPost.findMany({
    where: { 
      groupId, 
      hasContent: true, 
      isLead: null,  // null means not yet analyzed
      postText: { not: null },
      NOT: { postText: '(content not extracted)' },
    },
    select: { 
      id: true, 
      postUrl: true, 
      postText: true,
      authorName: true,
      authorProfileUrl: true,
      authorFbId: true,
      isAnonymous: true,
    },
  });
  
  log(`   Found ${postsToAnalyze.length} posts to analyze`);
  
  if (postsToAnalyze.length === 0) {
    return { analyzed: 0, leadsCreated: 0 };
  }
  
  let analyzed = 0;
  let leadsCreated = 0;
  
  // Process in batches
  for (let i = 0; i < postsToAnalyze.length; i += BATCH_SIZE) {
    const batch = postsToAnalyze.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(postsToAnalyze.length / BATCH_SIZE);
    
    log(`\n   ⚡ Batch ${batchNum}/${totalBatches}: Analyzing ${batch.length} posts in parallel...`);
    const batchStart = Date.now();
    
    // Analyze in parallel
    const results = await Promise.all(
      batch.map(async (post) => {
        try {
          const silentLog = () => {};
          const analysis = await analyzePostForLead(post.postText || '', silentLog);
          return { post, analysis, success: true };
        } catch (err) {
          return { 
            post, 
            analysis: { 
              isLead: false, 
              matchedService: null, 
              reason: null, 
              keywords: [], 
              suggestedComment: null,
              intentScore: 0,
            } as AIAnalysisResult,
            success: false,
            error: err,
          };
        }
      })
    );
    
    const batchTime = ((Date.now() - batchStart) / 1000).toFixed(1);
    log(`   ✅ Batch completed in ${batchTime}s`);
    
    // Process results and update DB
    let batchLeads = 0;
    for (const result of results) {
      analyzed++;
      
      if (result.analysis.isLead) {
        batchLeads++;
        const preview = result.post.postText?.substring(0, 50)?.replace(/\n/g, ' ') || '';
        log(`   🎯 LEAD: ${result.analysis.matchedService} - "${preview}..."`);
        
        try {
          // Create Lead record
          const lead = await prisma.lead.create({
            data: {
              groupId: groupId,
              postUrl: result.post.postUrl,
              authorName: result.post.authorName,
              authorProfileUrl: result.post.authorProfileUrl,
              authorFbId: result.post.authorFbId,
              isAnonymous: result.post.isAnonymous || false,
              postText: result.post.postText || '',
              intentScore: result.analysis.intentScore || 5,
              matchedService: result.analysis.matchedService,
              aiAnalysis: result.analysis as object,
              status: 'NEW',
              stage: 'LEAD',
            },
          });
          
          // Link post to lead
          await prisma.groupPost.update({
            where: { id: result.post.id },
            data: {
              isLead: true,
              leadId: lead.id,
              matchedService: result.analysis.matchedService,
              isAnalyzed: true,
              aiAnalysis: result.analysis as object,
            },
          });
          
          leadsCreated++;
          log(`   💾 Created lead: ${lead.id}`);
          
        } catch (dbErr) {
          if (dbErr instanceof Error && dbErr.message.includes('Unique constraint')) {
            log(`   ⏭️ Lead already exists for this post`);
          } else {
            log(`   ⚠️ DB error: ${dbErr}`);
          }
          
          // Still mark post as analyzed
          await prisma.groupPost.update({
            where: { id: result.post.id },
            data: { isLead: true, isAnalyzed: true, aiAnalysis: result.analysis as object },
          });
        }
      } else {
        // Mark as not a lead
        await prisma.groupPost.update({
          where: { id: result.post.id },
          data: { isLead: false, isAnalyzed: true },
        });
      }
    }
    
    if (batchLeads > 0) {
      log(`   🎯 Found ${batchLeads} lead(s) in this batch`);
    }
    
    // Small delay between batches
    if (i + BATCH_SIZE < postsToAnalyze.length) {
      await humanDelay(500, 1000);
    }
  }
  
  log(`✅ Phase 3 complete: ${analyzed} posts analyzed, ${leadsCreated} leads created`);
  
  return { analyzed, leadsCreated };
}

// ============================================
// MAIN ENTRY POINT
// ============================================
export async function runLeadGenAgent(
  input: LeadGenInput,
  onLog?: (msg: string) => void
): Promise<LeadGenResult & { groupResults: LeadGenGroupResult[] }> {
  const logs: string[] = [];
  const errors: string[] = [];
  const startedAt = new Date();
  const groupResults: LeadGenGroupResult[] = [];

  const log = (msg: string) => {
    const timestamp = new Date().toISOString();
    const logMsg = `[${timestamp}] ${msg}`;
    logs.push(logMsg);
    console.log(`[LeadGenAgent] ${msg}`);
    onLog?.(msg);
  };

  // Check schedule (unless skipped for testing)
  if (!input.skipScheduleCheck) {
    const scheduleCheck = await shouldAgentRun("LEAD_GEN");
    if (!scheduleCheck.shouldRun) {
      log(`⏸️ Skipping: ${scheduleCheck.reason}`);
      return {
        success: true,
        agentType: "LEAD_GEN",
        startedAt,
        completedAt: new Date(),
        duration: 0,
        logs,
        errors,
        stats: {
          groupsProcessed: 0,
          postsScraped: 0,
          postsAnalyzed: 0,
          leadsCreated: 0,
          commentsPosted: 0,
          friendRequestsSent: 0,
          dmsSent: 0,
        },
        groupResults: [],
      };
    }
    log(`✅ Schedule check: ${scheduleCheck.reason}`);
  }

  log("🚀 Starting Lead Gen Agent (Post Tracking System v2)");
  log(`👤 Account: ${input.accountId}`);
  log(`📍 Groups to process: ${input.groups.length}`);

  let session: BrowserSession | null = null;
  let totalStats = {
    groupsProcessed: 0,
    postsScraped: 0,
    postsAnalyzed: 0,
    leadsCreated: 0,
    commentsPosted: 0,
    friendRequestsSent: 0,
    dmsSent: 0,
  };

  try {
    // P1: Launch browser
    log("🌐 Launching browser...");
    session = await launchBrowser({
      accountId: input.accountId,
      headless: input.headless ?? false,
    });

    // Warmup session
    const isLoggedIn = await warmupSession(session.page, log);
    if (!isLoggedIn) {
      log("❌ Account is not logged in - creating notification");
      await createSessionNotification(
        input.accountId,
        "SESSION_NEEDS_LOGIN",
        "Facebook session expired. Please re-login manually to continue using this account."
      );
      throw new Error("Account is not logged in");
    }

    // Process each group
    for (const group of input.groups) {
      log(`\n${"=".repeat(50)}`);
      log(`📂 Processing group: ${group.url}`);
      log(`${"=".repeat(50)}`);

      try {
        // ═══════════════════════════════════════════
        // STEP 0: Pre-fetch last 10 known posts (1 DB query)
        // ═══════════════════════════════════════════
        const knownUrls = await prefetchKnownPosts(group.id, log);

        // Navigate to group
        log(`📍 Navigating to group...`);
        const navigated = await navigateToGroup(session.page, group.url, log);
        if (!navigated) {
          log(`⚠️ Failed to navigate to group, skipping...`);
          errors.push(`Failed to navigate to ${group.url}`);
          continue;
        }
        
        await humanDelay(2000, 3000);

        // ═══════════════════════════════════════════
        // PHASE 1: Scroll and check against Set (in-memory)
        // ═══════════════════════════════════════════
        const phase1Result = await phase1ScrollAndCollect(session.page, group.id, knownUrls, log);
        
        const groupResult: LeadGenGroupResult = {
          groupId: group.id,
          groupUrl: group.url,
          postsScraped: phase1Result.newUrls.length,
          postsAnalyzed: 0,
          leadsCreated: 0,
          newLastScrapedPostUrl: phase1Result.newUrls[0] || group.lastScrapedPostUrl,
          postResults: [],
        };

        if (phase1Result.newUrls.length === 0) {
          log(`   ℹ️ No new posts found in this group`);
          groupResults.push(groupResult);
          totalStats.groupsProcessed++;
          continue;
        }

        // ═══════════════════════════════════════════
        // PHASE 2: Extract content
        // ═══════════════════════════════════════════
        await phase2ExtractContent(session.page, group.id, group.url, log);

        // ═══════════════════════════════════════════
        // PHASE 3: AI Analysis
        // ═══════════════════════════════════════════
        const phase3Result = await phase3AnalyzeWithAI(group.id, log);
        groupResult.postsAnalyzed = phase3Result.analyzed;
        groupResult.leadsCreated = phase3Result.leadsCreated;

        // Update group in database with lastScrapedShareUrl for next comparison
        const newestShareUrl = phase1Result.newUrls[0] || null;
        try {
          await prisma.group.update({
            where: { id: group.id },
            data: {
              lastScrapedAt: new Date(),
              lastScrapedShareUrl: newestShareUrl,  // Save share URL for comparison
              lastScrapedPostId: newestShareUrl,    // Keep for backward compatibility
              totalPosts: { increment: phase1Result.newUrls.length },
              totalLeads: { increment: phase3Result.leadsCreated },
            },
          });
          log(`💾 Updated group ${group.id} in database (lastScrapedShareUrl: ${newestShareUrl?.slice(0, 50)}...)`);
        } catch (dbError) {
          log(`⚠️ Failed to update group: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
        }

        groupResults.push(groupResult);
        totalStats.groupsProcessed++;
        totalStats.postsScraped += phase1Result.newUrls.length;
        totalStats.postsAnalyzed += phase3Result.analyzed;
        totalStats.leadsCreated += phase3Result.leadsCreated;

        log(`\n📊 Group complete: ${phase1Result.newUrls.length} new posts, ${phase3Result.leadsCreated} leads`);

        // Delay between groups
        if (input.groups.indexOf(group) < input.groups.length - 1) {
          log("⏳ Waiting before next group...");
          await humanDelay(10000, 20000);
        }
      } catch (groupError) {
        const errorMsg = groupError instanceof Error ? groupError.message : String(groupError);
        log(`❌ Error processing group ${group.url}: ${errorMsg}`);
        errors.push(`Group ${group.id}: ${errorMsg}`);
      }
    }

    const completedAt = new Date();
    const duration = completedAt.getTime() - startedAt.getTime();

    log(`\n🏁 LEAD GEN AGENT COMPLETE`);
    log(`   📂 Groups processed: ${totalStats.groupsProcessed}`);
    log(`   📊 Posts scraped: ${totalStats.postsScraped}`);
    log(`   🤖 Posts analyzed: ${totalStats.postsAnalyzed}`);
    log(`   🎯 Leads created: ${totalStats.leadsCreated}`);
    log(`   ⏱️ Duration: ${(duration / 1000 / 60).toFixed(1)} minutes`);

    return {
      success: true,
      agentType: "LEAD_GEN",
      startedAt,
      completedAt,
      duration,
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
      agentType: "LEAD_GEN",
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
    log("🏁 Lead Gen Agent completed");
  }
}
