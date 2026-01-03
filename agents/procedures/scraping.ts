// Procedure P5, P6: Group Navigation and Post Extraction

import { Page } from "playwright";
import { ScrapedPost, ScrapeResult } from "../types";
import { humanDelay, humanScroll, mediumDelay } from "./human-behavior";
import { GROUP_SELECTORS, getChronologicalGroupUrl, extractPostId } from "./facebook-selectors";
import { prisma } from "@/lib/db";

// ============================================
// PREFETCH ALL KNOWN PERMALINK IDs (for comparison during scraping)
// Memory: ~100 bytes per ID - very efficient
// See docs/SCRAPER-STOP-LOGIC.md for analysis
// ============================================
export async function prefetchKnownPermalinkIds(
  groupId: string,
  log: (msg: string) => void
): Promise<Set<string>> {
  // Single DB query - get ALL posts for this group
  const posts = await prisma.groupPost.findMany({
    where: { groupId },
    select: { permalinkId: true },
  });
  
  // Build Set for O(1) lookup - only permalink IDs (stable identifiers)
  const knownIds = new Set<string>();
  for (const post of posts) {
    if (post.permalinkId) knownIds.add(post.permalinkId);
  }
  
  const memoryKB = (knownIds.size * 100 / 1024).toFixed(1);
  log(`📋 Loaded ${posts.length} posts (${knownIds.size} permalink IDs, ~${memoryKB} KB)`);
  
  return knownIds;
}

// ============================================
// PREFETCH CONTENT SIGNATURES (for deduplication by content+author)
// Creates a Set of "content hash|author" strings to detect duplicates
// ============================================
export async function prefetchContentSignatures(
  groupId: string,
  log: (msg: string) => void
): Promise<Set<string>> {
  const posts = await prisma.groupPost.findMany({
    where: { 
      groupId,
      hasContent: true,  // Only posts with extracted content
      postText: { not: null },
    },
    select: { postText: true, authorName: true },
  });
  
  const signatures = new Set<string>();
  for (const post of posts) {
    if (post.postText) {
      // Create signature: first 100 chars of content + author name
      const contentStart = post.postText.slice(0, 100).toLowerCase().trim();
      const author = (post.authorName || 'Anonymous').toLowerCase().trim();
      signatures.add(`${contentStart}|${author}`);
    }
  }
  
  log(`📋 Loaded ${signatures.size} content signatures for deduplication`);
  return signatures;
}

// Helper to create content signature for comparison
export function createContentSignature(content: string, authorName: string): string {
  const contentStart = content.slice(0, 100).toLowerCase().trim();
  const author = (authorName || 'Anonymous').toLowerCase().trim();
  return `${contentStart}|${author}`;
}

// ============================================
// P5: NAVIGATE TO GROUP
// ============================================
export async function navigateToGroup(
  page: Page,
  groupUrl: string,
  log: (msg: string) => void
): Promise<boolean> {
  log(`📍 Navigating to group: ${groupUrl}`);
  
  try {
    const chronologicalUrl = getChronologicalGroupUrl(groupUrl);
    
    await page.goto(chronologicalUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    
    await page.waitForTimeout(3000 + Math.random() * 2000);
    
    // Try to ensure "New posts" sorting is active
    try {
      const sortDropdown = await page.$(GROUP_SELECTORS.sortDropdown);
      if (sortDropdown) {
        log("🔄 Clicking sort dropdown...");
        await sortDropdown.click();
        await page.waitForTimeout(1000 + Math.random() * 500);
        
        const newPostsOption = await page.$(GROUP_SELECTORS.newPostsOption);
        if (newPostsOption) {
          log("📅 Selecting 'New posts' sorting...");
          await newPostsOption.click();
          await page.waitForTimeout(2000 + Math.random() * 1000);
        }
      }
    } catch {
      log("⚠️ Could not click sorting dropdown, URL param should handle it");
    }
    
    log("✅ Navigated to group successfully");
    return true;
  } catch (error) {
    log(`❌ Failed to navigate to group: ${error}`);
    return false;
  }
}

// ============================================
// P6: EXTRACT POSTS (Same approach as First Time Scraper)
// Scroll to post → Click Share → Get URL → Extract permalink ID → Check if known → Move to next
// ============================================
export async function extractPosts(
  page: Page,
  options: {
    maxPosts?: number;
    knownPermalinkIds?: Set<string>;  // Set of known permalink IDs (e.g., "1381383086617098")
    knownContentSignatures?: Set<string>;  // Set of "content|author" signatures for deduplication
  },
  log: (msg: string) => void
): Promise<ScrapedPost[]> {
  const { 
    maxPosts = 50, 
    knownPermalinkIds = new Set<string>(),
    knownContentSignatures = new Set<string>(),
  } = options;

  const collectedUrls: string[] = [];
  const seenUrls = new Set<string>();
  let consecutiveFailures = 0;
  let scrollFailures = 0;
  const MAX_CONSECUTIVE_FAILURES = 50;
  const MAX_SCROLL_FAILURES = 20;
  let currentPostIndex = 0;

  log(`\n📜 PHASE 1: Collecting up to ${maxPosts} URLs via Share button...`);
  log(`   🎯 Target: ${maxPosts} posts (will stop when hitting known post)`);
  log(`   📋 Checking against ${knownPermalinkIds.size} known permalink IDs`);

  // Process posts one by one - scroll to post, click share, copy link, move to next
  while (collectedUrls.length < maxPosts) {
    // Check if we've truly reached the end of feed
    if (scrollFailures >= MAX_SCROLL_FAILURES) {
      log(`\n   📄 Reached end of feed - no more posts to load`);
      break;
    }
    
    // Check if too many consecutive failures
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      log(`\n   ⚠️ Too many failed posts (${consecutiveFailures}), continuing to scroll...`);
      consecutiveFailures = 0;
      await page.evaluate(() => window.scrollBy(0, 1000));
      await humanDelay(500, 800);
      currentPostIndex += 5;
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
        
        if (newPostCount === postCount) {
          scrollFailures++;
          if (scrollFailures % 5 === 0) {
            log(`   ⏳ Waiting for more posts to load... (attempt ${scrollFailures}/${MAX_SCROLL_FAILURES})`);
          }
        } else {
          scrollFailures = 0;
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
        currentPostIndex++;
        continue;
      }
      
      // Scroll to bring post into view
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
        
        // Method 2: Look for "Share" text in multiple languages
        const shareTexts = ['share', 'condividi', 'partager', 'compartir', 'teilen', 'compartilhar'];
        const allButtons = post.querySelectorAll('[role="button"]');
        for (const btn of allButtons) {
          const text = (btn.textContent || '').trim().toLowerCase();
          if (shareTexts.includes(text)) {
            const rect = btn.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
            }
          }
        }
        
        return null;
      }, currentPostIndex);

      if (!shareButton) {
        currentPostIndex++;
        consecutiveFailures++;
        continue;
      }

      // Click share button
      await page.mouse.click(shareButton.x, shareButton.y);
      await humanDelay(800, 1200);

      // Click "Copy link" option
      const copyLinkClicked = await page.evaluate(() => {
        const searchTexts = ['copy link', 'copia link', 'copia il link', 'copier le lien', 'copiar enlace', 'link kopieren', 'copiar link', 'copy'];
        
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
        
        const spans = document.querySelectorAll('span');
        for (const span of spans) {
          const text = (span.textContent || '').trim().toLowerCase();
          for (const search of searchTexts) {
            if (text === search) {
              const clickable = span.closest('[role="button"], [role="menuitem"], [tabindex]');
              if (clickable) {
                (clickable as HTMLElement).click();
                return true;
              }
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
        
        // Extract permalink ID (the stable identifier)
        const permalinkId = extractPostId(cleanUrl);
        
        // Check if this is a known post by permalink ID - STOP before adding it
        if (permalinkId && knownPermalinkIds.has(permalinkId)) {
          log(`\n   🛑 Found known post - stopping!`);
          log(`   📍 Matched permalink ID: ${permalinkId}`);
          log(`   📊 Collected ${collectedUrls.length} new posts`);
          break;
        }
        
        if (!seenUrls.has(cleanUrl)) {
          seenUrls.add(cleanUrl);
          collectedUrls.push(cleanUrl);
          consecutiveFailures = 0;
          scrollFailures = 0;
          
          const progress = ((collectedUrls.length / maxPosts) * 100).toFixed(0);
          log(`   🔗 [${collectedUrls.length}/${maxPosts}] (${progress}%) ${cleanUrl}${permalinkId ? ` [ID: ${permalinkId}]` : ''}`);
        }
      } else {
        consecutiveFailures++;
      }
      
      currentPostIndex++;
      
    } catch (err) {
      await page.keyboard.press('Escape').catch(() => {});
      await humanDelay(100, 200);
      currentPostIndex++;
      consecutiveFailures++;
    }
  }
  
  log(`\n✅ Phase 1 complete: Collected ${collectedUrls.length} URLs`);

  // ===== PHASE 2: Visit each post URL to extract content =====
  log(`\n📝 PHASE 2: Extracting content from ${collectedUrls.length} posts...`);
  
  const allPosts: ScrapedPost[] = [];
  
  for (let i = 0; i < collectedUrls.length; i++) {
    const shareUrl = collectedUrls[i];  // Original share URL from clipboard
    
    try {
      await page.goto(shareUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await humanDelay(2000, 3000);
      
      // Capture the resolved URL (permalink) after any redirects
      const resolvedUrl = page.url().split('?')[0];  // Clean URL without tracking params

      // Try to wait for story_message
      try {
        await page.waitForSelector('[data-ad-rendering-role="story_message"]', { timeout: 3000 });
      } catch {
        await humanDelay(500, 800);
      }
      const postData = await page.evaluate(() => {
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
        
        // Helper to get deep text
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

      if (postData.postText && postData.postText.length > 10) {
        // Check for duplicate content by signature (content + author)
        const contentSignature = createContentSignature(postData.postText, postData.authorName);
        if (knownContentSignatures.has(contentSignature)) {
          const preview = postData.postText.slice(0, 40).replace(/\n/g, ' ');
          log(`   ⏭️ [${i + 1}] SKIP (duplicate content): "${preview}..."`);
          continue;  // Skip this post - already exists in DB
        }
        
        const preview = postData.postText.slice(0, 70).replace(/\n/g, ' ');
        const author = postData.isAnonymous ? 'Anonymous' : postData.authorName;
        const profileLink = postData.authorProfileUrl ? ` (${postData.authorProfileUrl})` : '';
        log(`   ✅ [${i + 1}] "${preview}..." → ${author}${profileLink}`);
        
        // Add to known signatures to avoid duplicates within same scrape
        knownContentSignatures.add(contentSignature);
        
        allPosts.push({
          postUrl: resolvedUrl,  // Resolved permalink (after redirect)
          shareUrl,              // Original share URL (from clipboard)
          fbPostId: extractPostId(resolvedUrl) || resolvedUrl,
          content: postData.postText,
          authorName: postData.authorName,
          authorProfileUrl: postData.authorProfileUrl || null,
          authorFbId: postData.authorProfileUrl ? extractProfileIdFromUrl(postData.authorProfileUrl) : null,
          isAnonymous: postData.isAnonymous,
          hasImages: false,
          hasVideo: false,
          imageUrls: [],
          likeCount: 0,
          commentCount: 0,
          shareCount: 0,
          scrapedAt: new Date(),
        });
      } else {
        log(`   ❌ [${i + 1}] No content found`);
      }
      
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log(`   ❌ [${i + 1}] Error: ${errMsg.slice(0, 50)}`);
    }
    
    await humanDelay(500, 800);
  }

  log(`\n✅ Phase 2 complete: Extracted ${allPosts.length}/${collectedUrls.length} posts`);
  return allPosts;
}

// Helper to extract profile ID from URL
function extractProfileIdFromUrl(url: string): string | null {
  const match = url.match(/user\/(\d+)|profile\.php\?id=(\d+)/);
  return match ? (match[1] || match[2]) : null;
}

// ============================================
// INCREMENTAL SCRAPE (for Lead Gen Agent / Scraper Agent)
// ============================================
export async function incrementalScrape(
  page: Page,
  groupUrl: string,
  groupId: string,
  log: (msg: string) => void
): Promise<ScrapeResult> {
  // Navigate to group
  const navigated = await navigateToGroup(page, groupUrl, log);
  if (!navigated) {
    throw new Error("Failed to navigate to group");
  }

  // Wait for posts to load
  await mediumDelay();

  // Pre-fetch ALL known permalink IDs from database for comparison (Phase 1)
  const knownPermalinkIds = await prefetchKnownPermalinkIds(groupId, log);
  
  // Pre-fetch content signatures for deduplication (Phase 2)
  const knownContentSignatures = await prefetchContentSignatures(groupId, log);

  // Extract posts, stopping when hitting a known post by permalink ID
  // Also skips posts with duplicate content+author in Phase 2
  const posts = await extractPosts(
    page,
    {
      maxPosts: 500, // High limit - we rely on permalink IDs to stop early
      knownPermalinkIds,
      knownContentSignatures,
    },
    log
  );

  // Get the newest share URL for next time (for comparison)
  const newestShareUrl = posts.length > 0 ? posts[0].shareUrl : undefined;

  return {
    groupId: extractGroupIdFromUrl(groupUrl) || groupId,
    posts,
    stoppedAt: undefined,
    newPostsCount: posts.length,
    newestShareUrl,
  };
}

// Helper to extract group ID from URL
function extractGroupIdFromUrl(url: string): string | null {
  const match = url.match(/facebook\.com\/groups\/([^/?]+)/);
  return match ? match[1] : null;
}

// ============================================
// FULL SCRAPE (for First-Time Scraper)
// ============================================
export async function fullScrape(
  page: Page,
  groupUrl: string,
  log: (msg: string) => void,
  maxPosts: number = 400
): Promise<ScrapeResult> {
  // Navigate to group
  const navigated = await navigateToGroup(page, groupUrl, log);
  if (!navigated) {
    throw new Error("Failed to navigate to group");
  }

  // Wait for posts to load
  await mediumDelay();

  log(`📜 Scraping up to ${maxPosts} posts...`);

  // Extract all posts (no known IDs - this is first-time scrape)
  const posts = await extractPosts(
    page,
    {
      maxPosts,
      knownPermalinkIds: new Set<string>(),  // Empty set - scrape all
    },
    log
  );

  return {
    groupId: extractGroupIdFromUrl(groupUrl) || "",
    posts,
    newPostsCount: posts.length,
  };
}
