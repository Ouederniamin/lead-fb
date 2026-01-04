// Agent 1: First-Time Group Scraper (Post Tracking System v2)
// 3-Phase Approach: Scroll → Content → Analysis
// Saves ALL posts to DB immediately (batch of 10), then extracts content and analyzes

import { BrowserSession, FirstTimeScraperResult, ScrapedPost, AIAnalysisResult } from "./types";
import {
  launchBrowser,
  warmupSession,
  closeBrowser,
  navigateToGroup,
  analyzePostForLead,
  humanDelay,
  extractPostId,
} from "./procedures";
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

export interface FirstTimeScraperInput {
  groupUrl: string;
  groupId: string;
  accountId: string;
  maxPosts?: number;        // Number of posts to scrape (default: 400)
  headless?: boolean;
  analyzeWithAI?: boolean;  // Run AI analysis (default: true)
  createLeads?: boolean;    // Create leads in DB (default: true)
}

export interface FirstTimeScraperPostResult {
  postUrl: string;
  postId: string;
  hasContent: boolean;
  analysis: AIAnalysisResult | null;
  isLead: boolean;
  leadId: string | null;
}

// ============================================
// PHASE 1: SCROLL & COLLECT URLS via SHARE BUTTON (with immediate DB inserts)
// ============================================
async function phase1CollectUrls(
  page: Page,
  groupId: string,
  maxPosts: number,
  log: (msg: string) => void
): Promise<{ totalSaved: number; postUrls: string[] }> {
  const BATCH_SIZE = 10;
  const collectedUrls: string[] = [];
  const allUrls: string[] = [];
  let totalSaved = 0;
  const seenUrls = new Set<string>();
  let consecutiveFailures = 0;
  let scrollFailures = 0;
  const MAX_CONSECUTIVE_FAILURES = 50; // More persistent - skip bad posts
  const MAX_SCROLL_FAILURES = 20; // Separate counter for reaching end of feed
  let currentPostIndex = 0;
  let lastProgressLog = 0;

  log(`\n📜 PHASE 1: Collecting ${maxPosts} URLs via Share button...`);
  log(`   🎯 Target: ${maxPosts} posts`);
  
  // Process posts one by one - scroll to post, click share, copy link, move to next
  while (totalSaved + collectedUrls.length < maxPosts) {
    // Check if we've truly reached the end of feed
    if (scrollFailures >= MAX_SCROLL_FAILURES) {
      log(`\n   📄 Reached end of feed - no more posts to load`);
      break;
    }
    
    // Check if too many consecutive failures (skip bad posts, not end of feed)
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      log(`\n   ⚠️ Too many failed posts (${consecutiveFailures}), but continuing to scroll...`);
      consecutiveFailures = 0; // Reset and try scrolling further
      await page.evaluate(() => window.scrollBy(0, 1000));
      await humanDelay(500, 800);
      currentPostIndex += 5; // Skip ahead
      continue;
    }
    
    try {
      // Get current post count
      const postCount = await page.evaluate(() => 
        document.querySelectorAll('[role="feed"] > div').length
      );
      
      // If we've processed all visible posts, scroll to load more
      if (currentPostIndex >= postCount) {
        await page.evaluate(() => window.scrollBy(0, 800));
        await humanDelay(500, 800);
        
        const newPostCount = await page.evaluate(() => 
          document.querySelectorAll('[role="feed"] > div').length
        );
        
        // Check if we've reached the end of feed
        if (newPostCount === postCount) {
          scrollFailures++;
          // Log progress periodically
          if (scrollFailures % 5 === 0) {
            log(`   ⏳ Waiting for more posts to load... (attempt ${scrollFailures}/${MAX_SCROLL_FAILURES})`);
          }
        } else {
          scrollFailures = 0; // Reset when new posts load
        }
        continue;
      }
      
      // Get post position
      const postPosition = await page.evaluate((idx: number) => {
        const feedItems = document.querySelectorAll('[role="feed"] > div');
        const post = feedItems[idx];
        if (!post) return null;
        const rect = post.getBoundingClientRect();
        return { top: rect.top, height: rect.height };
      }, currentPostIndex);
      
      if (!postPosition || postPosition.height < 50) {
        // Skip empty/small items (likely ads or placeholders)
        currentPostIndex++;
        continue;
      }
      
      // Scroll to bring post into view (center of screen)
      if (postPosition.top < 100 || postPosition.top > 400) {
        const scrollNeeded = postPosition.top - 200;
        await page.evaluate((amount: number) => window.scrollBy(0, amount), scrollNeeded);
        await humanDelay(200, 350);
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
      }, currentPostIndex);

      if (!shareButton) {
        // No share button - might be an ad or announcement
        currentPostIndex++;
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
        currentPostIndex++;
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

      if (postUrl && postUrl.includes('facebook.com') && !seenUrls.has(postUrl)) {
        // Clean URL - remove tracking params
        const cleanUrl = postUrl.split('?')[0];
        
        if (!seenUrls.has(cleanUrl)) {
          seenUrls.add(cleanUrl);
          collectedUrls.push(cleanUrl);
          allUrls.push(cleanUrl);
          consecutiveFailures = 0; // Reset on success
          scrollFailures = 0; // Also reset scroll failures
          
          // Log each URL when found
          const progress = ((allUrls.length / maxPosts) * 100).toFixed(0);
          log(`   🔗 [${allUrls.length}/${maxPosts}] (${progress}%) ${cleanUrl}`);
        }
      } else {
        consecutiveFailures++;
      }
      
      // Move to next post
      currentPostIndex++;
      
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
          
          totalSaved += batch.length;
          const progress = ((totalSaved / maxPosts) * 100).toFixed(0);
          log(`   💾 Saved batch ${Math.ceil(totalSaved / BATCH_SIZE)}: ${batch.length} URLs (${totalSaved}/${maxPosts} = ${progress}%)`);
        } catch (dbErr) {
          log(`   ⚠️ DB error saving batch: ${dbErr}`);
        }
      }
      
    } catch (err) {
      // Silently continue on errors
      await page.keyboard.press('Escape').catch(() => {});
      await humanDelay(100, 200);
      currentPostIndex++;
      consecutiveFailures++;
    }
  }
  
  // Save any remaining URLs
  if (collectedUrls.length > 0 && totalSaved < maxPosts) {
    const remaining = collectedUrls.slice(0, maxPosts - totalSaved);
    
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
      log(`   💾 Saved final batch: ${remaining.length} URLs`);
    } catch (dbErr) {
      log(`   ⚠️ DB error saving remaining: ${dbErr}`);
    }
  }
  
  // Final summary
  const successRate = maxPosts > 0 ? ((totalSaved / maxPosts) * 100).toFixed(1) : '0';
  log(`\n✅ Phase 1 complete:`);
  log(`   📊 Target: ${maxPosts} | Collected: ${totalSaved} | Success: ${successRate}%`);
  
  if (totalSaved < maxPosts) {
    log(`   ⚠️ Could not reach target - feed may have fewer posts or some failed to extract`);
  }
  
  return { totalSaved, postUrls: allUrls.slice(0, maxPosts) };
}

// ============================================
// PHASE 2: EXTRACT CONTENT (visit each post URL directly)
// ============================================
async function phase2ExtractContent(
  page: Page,
  groupId: string,
  groupUrl: string,
  maxPosts: number,
  log: (msg: string) => void
): Promise<number> {
  log(`\n📝 PHASE 2: Extracting content by visiting each post...`);
  
  // Get posts without content from DB (limited to maxPosts to match Phase 1 target)
  const postsWithoutContent = await prisma.groupPost.findMany({
    where: { groupId, hasContent: false },
    select: { id: true, postUrl: true },
    orderBy: { scrapedAt: 'desc' },
    take: maxPosts,
  });
  
  log(`   Processing ${postsWithoutContent.length} posts (limited to target: ${maxPosts})`);
  
  if (postsWithoutContent.length === 0) {
    return 0;
  }
  
  let updated = 0;
  let failed = 0;
  
  for (let i = 0; i < postsWithoutContent.length; i++) {
    const post = postsWithoutContent[i];
    
    // Log progress every 10 posts
    if ((i + 1) % 10 === 0 || i === 0) {
      log(`   📄 Processing post ${i + 1}/${postsWithoutContent.length}...`);
    }
    
    try {
      // Navigate to the post URL (might be share URL that redirects)
      await page.goto(post.postUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      
      // Capture the resolved URL (permalink) after any redirects
      const resolvedUrl = page.url().split('?')[0];  // Clean URL without tracking params
      
      // Check current URL - detect if redirected away from Facebook
      if (!resolvedUrl.includes('facebook.com')) {
        log(`   ❌ [${i + 1}] Redirected away from Facebook`);
        failed++;
        continue;
      }
      
      // Wait for content to load
      await humanDelay(2000, 3000);
      
      // Try to wait for story_message selector
      try {
        await page.waitForSelector('[data-ad-rendering-role="story_message"]', { timeout: 3000 });
      } catch {
        await humanDelay(500, 800);
      }
      
      // Extract content using story_message
      const content = await page.evaluate(() => {
        // Find the post dialog first
        let postDialog: Element | null = null;
        const dialogs = document.querySelectorAll('[role="dialog"]');
        
        for (const dialog of dialogs) {
          if (dialog.querySelector('[data-ad-rendering-role="story_message"]')) {
            postDialog = dialog;
            break;
          }
        }
        
        // Search root is the post dialog or document
        const searchRoot = postDialog || document;
        
        // Find story_message content
        let postText = '';
        const storyMessage = searchRoot.querySelector('[data-ad-rendering-role="story_message"]');
        if (storyMessage) {
          postText = (storyMessage.textContent || '').trim();
        }
        
        // Fallback: find any story_message on page
        if (!postText) {
          const anyStoryMessage = document.querySelector('[data-ad-rendering-role="story_message"]');
          if (anyStoryMessage) {
            postText = (anyStoryMessage.textContent || '').trim();
          }
        }
        
        // Helper function to get deep text
        function getDeepText(element: Element): string {
          let text = '';
          for (const child of element.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
              text += child.textContent || '';
            } else if (child.nodeType === Node.ELEMENT_NODE) {
              text += getDeepText(child as Element);
            }
          }
          return text;
        }
        
        // Get author info - ONLY search within dialog/post, not whole page
        let authorName = '';
        let authorProfileUrl = '';
        
        // Look for author link with attributionsrc WITHIN the post dialog
        const authorLinks = searchRoot.querySelectorAll('a[role="link"][attributionsrc][href*="/user/"]');
        for (const link of authorLinks) {
          if (link.getAttribute('aria-hidden') === 'true') continue;
          // Skip links in comments
          const inComment = link.closest('[role="article"][aria-label*="Comment"], [role="article"][aria-label*="comment"]');
          if (inComment) continue;
          // Skip if in navigation/sidebar (outside main content)
          const inNav = link.closest('[role="navigation"], [role="banner"], [aria-label="Facebook"]');
          if (inNav) continue;
          
          const name = getDeepText(link).trim();
          if (name && name.length > 1 && name.length < 50) {
            authorName = name;
            authorProfileUrl = (link as HTMLAnchorElement).href.split('?')[0];
            break;
          }
        }
        
        // Fallback: try profile.php links within search root
        if (!authorName) {
          const profileLinks = searchRoot.querySelectorAll('a[role="link"][href*="/profile.php"]');
          for (const link of profileLinks) {
            if (link.getAttribute('aria-hidden') === 'true') continue;
            const inComment = link.closest('[role="article"][aria-label*="Comment"]');
            if (inComment) continue;
            const inNav = link.closest('[role="navigation"], [role="banner"]');
            if (inNav) continue;
            
            const name = getDeepText(link).trim();
            if (name && name.length > 1 && name.length < 50) {
              authorName = name;
              authorProfileUrl = (link as HTMLAnchorElement).href.split('?')[0];
              break;
            }
          }
        }
        
        // Determine if anonymous:
        // 1. If we found a real author name AND profile URL, NOT anonymous
        // 2. If authorName is empty or explicitly "anonymous", IS anonymous
        // 3. Only check page text for "anonymous member" if we have NO author info
        const hasRealAuthor = authorName && 
          authorName.trim() !== '' && 
          !authorName.toLowerCase().includes('anonymous') && 
          authorProfileUrl && 
          authorProfileUrl.length > 0;
        
        let isAnonymous = false;
        if (!hasRealAuthor) {
          // No real author found, check if it's explicitly anonymous
          const dialogText = (searchRoot.textContent || '').toLowerCase();
          isAnonymous = authorName === '' || 
                       authorName.toLowerCase().includes('anonymous') ||
                       dialogText.includes('posted anonymously') ||
                       (dialogText.includes('anonymous member') && !authorName) ||
                       (dialogText.includes('anonymous participant') && !authorName);
        }
        
        return {
          postText: postText.slice(0, 2000),
          authorName: isAnonymous ? 'Anonymous' : authorName,
          authorProfileUrl: isAnonymous ? '' : authorProfileUrl,
          isAnonymous,
        };
      });
      
      // Update the post in DB
      if (content.postText && content.postText.length > 10) {
        // Check if the resolved URL is different from original (share URL redirected to permalink)
        const urlChanged = resolvedUrl !== post.postUrl;
        // Extract stable permalink ID from the resolved URL
        const permalinkId = extractPostId(resolvedUrl);
        
        try {
          await prisma.groupPost.update({
            where: { id: post.id },
            data: {
              // Update postUrl to the resolved permalink if it changed
              ...(urlChanged && { postUrl: resolvedUrl }),
              // Save the stable permalink ID for future comparison
              permalinkId: permalinkId || undefined,
              postText: content.postText,
              authorName: content.authorName || null,
              authorProfileUrl: content.authorProfileUrl || null,
              isAnonymous: content.isAnonymous,
              hasContent: true,
              extractionMethod: 'story_message',
            },
          });
        } catch (updateError) {
          // If URL update fails (e.g., duplicate), just update without URL change
          if (urlChanged) {
            await prisma.groupPost.update({
              where: { id: post.id },
              data: {
                permalinkId: permalinkId || undefined,
                postText: content.postText,
                authorName: content.authorName || null,
                authorProfileUrl: content.authorProfileUrl || null,
                isAnonymous: content.isAnonymous,
                hasContent: true,
                extractionMethod: 'story_message',
              },
            });
          } else {
            throw updateError;
          }
        }
        updated++;
        
        // Clean log: content preview + author + profile link
        const preview = content.postText.slice(0, 70).replace(/\n/g, ' ');
        const author = content.isAnonymous ? 'Anonymous' : content.authorName;
        const profileLink = content.authorProfileUrl ? ` (${content.authorProfileUrl})` : '';
        log(`   ✅ [${i + 1}] "${preview}..." → ${author}${profileLink}`);
      } else {
        // Mark as processed but couldn't extract content
        await prisma.groupPost.update({
          where: { id: post.id },
          data: { hasContent: true, postText: '(content not extracted)', extractionMethod: 'none' },
        });
        failed++;
        log(`   ⚠️ [${i + 1}] No content extracted`);
      }
      
    } catch (err) {
      // Mark as failed
      const errMsg = err instanceof Error ? err.message : String(err);
      log(`   ❌ [${i + 1}] Error: ${errMsg.slice(0, 80)}`);
      try {
        await prisma.groupPost.update({
          where: { id: post.id },
          data: { hasContent: true, postText: '(failed to load)', extractionMethod: 'error' },
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
    
    // Small delay between posts to be gentle
    await humanDelay(500, 1000);
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
export async function runFirstTimeScraper(
  input: FirstTimeScraperInput,
  onLog?: (msg: string) => void
): Promise<FirstTimeScraperResult & { postResults: FirstTimeScraperPostResult[] }> {
  const logs: string[] = [];
  const errors: string[] = [];
  const startedAt = new Date();
  const postResults: FirstTimeScraperPostResult[] = [];

  const log = (msg: string) => {
    const timestamp = new Date().toISOString();
    const logMsg = `[${timestamp}] ${msg}`;
    logs.push(logMsg);
    console.log(`[FirstTimeScraper] ${msg}`);
    onLog?.(msg);
  };

  log("🚀 Starting First-Time Group Scraper (Post Tracking System v2)");
  log(`📍 Group: ${input.groupUrl}`);
  log(`👤 Account: ${input.accountId}`);

  const maxPosts = input.maxPosts ?? 400;
  const analyzeWithAI = input.analyzeWithAI ?? true;
  const createLeads = input.createLeads ?? true;

  log(`📊 Config: targetPosts=${maxPosts}, analyzeWithAI=${analyzeWithAI}, createLeads=${createLeads}`);

  let session: BrowserSession | null = null;
  let totalStats = {
    postsScraped: 0,
    postsSaved: 0,
    postsAnalyzed: 0,
    leadsCreated: 0,
    commentsPosted: 0,
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

    // Navigate to group
    log(`📍 Navigating to group...`);
    const navigated = await navigateToGroup(session.page, input.groupUrl, log);
    if (!navigated) {
      throw new Error("Failed to navigate to group");
    }
    
    await humanDelay(2000, 3000);

    // ═══════════════════════════════════════════
    // PHASE 1: Scroll and collect URLs
    // ═══════════════════════════════════════════
    const phase1Result = await phase1CollectUrls(session.page, input.groupId, maxPosts, log);
    totalStats.postsSaved = phase1Result.totalSaved;
    totalStats.postsScraped = phase1Result.totalSaved;

    // ═══════════════════════════════════════════
    // PHASE 2: Extract content
    // ═══════════════════════════════════════════
    await phase2ExtractContent(session.page, input.groupId, input.groupUrl, maxPosts, log);

    // ═══════════════════════════════════════════
    // PHASE 3: AI Analysis
    // ═══════════════════════════════════════════
    if (analyzeWithAI && createLeads) {
      const phase3Result = await phase3AnalyzeWithAI(input.groupId, log);
      totalStats.postsAnalyzed = phase3Result.analyzed;
      totalStats.leadsCreated = phase3Result.leadsCreated;
    }

    // Mark group as initialized and save the first post URL for future incremental scraping
    // We save the share URL (from Phase 1 clipboard) as lastScrapedShareUrl for comparison
    // because that's what the scraper agent will collect during Phase 1
    const firstShareUrl = phase1Result.postUrls[0] || null;
    await prisma.group.update({
      where: { id: input.groupId },
      data: {
        isInitialized: true,
        initializedAt: new Date(),
        lastScrapedAt: new Date(),
        lastScrapedPostId: firstShareUrl, // Keep for backward compatibility
        lastScrapedShareUrl: firstShareUrl, // Share URL for comparison in scraper agent
        totalPosts: { increment: totalStats.postsSaved },
        totalLeads: { increment: totalStats.leadsCreated },
      },
    });
    log(`✅ Group marked as initialized (lastScrapedShareUrl: ${firstShareUrl ? firstShareUrl.slice(0, 50) + '...' : 'none'})`);

    const completedAt = new Date();
    const duration = completedAt.getTime() - startedAt.getTime();

    log(`\n🏁 INITIALIZATION COMPLETE`);
    log(`   📊 Posts saved: ${totalStats.postsSaved}`);
    log(`   🤖 Posts analyzed: ${totalStats.postsAnalyzed}`);
    log(`   🎯 Leads created: ${totalStats.leadsCreated}`);
    log(`   ⏱️ Duration: ${(duration / 1000 / 60).toFixed(1)} minutes`);

    return {
      success: true,
      agentType: "FIRST_TIME_SCRAPER",
      startedAt,
      completedAt,
      duration,
      logs,
      errors,
      stats: totalStats,
      lastScrapedPostUrl: phase1Result.postUrls[0] || undefined,
      postResults,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log(`❌ Error: ${errorMsg}`);
    errors.push(errorMsg);

    const completedAt = new Date();

    return {
      success: false,
      agentType: "FIRST_TIME_SCRAPER",
      startedAt,
      completedAt,
      duration: completedAt.getTime() - startedAt.getTime(),
      logs,
      errors,
      stats: totalStats,
      postResults,
    };
  } finally {
    // Close browser
    if (session) {
      log("🔒 Closing browser...");
      await closeBrowser(session);
    }
    log("🏁 First-Time Scraper completed");
  }
}

// Export the scraped posts type for use by the API
export type { ScrapedPost };
