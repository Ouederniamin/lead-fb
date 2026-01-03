import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { launchBrowser, warmupSession } from "@/agents/procedures/browser";
import { humanDelay } from "@/agents/procedures/human-behavior";

// POST /api/test/extract-content
// Debug endpoint to test content extraction from saved post URLs
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { accountId, postUrl, postId, limit = 5 } = body;

  if (!accountId) {
    return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  }

  const logs: string[] = [];
  const log = (msg: string) => {
    console.log(`[ExtractTest] ${msg}`);
    logs.push(msg);
  };

  let session = null;

  try {
    log("🚀 Starting content extraction test...");

    // Get posts to test
    let posts: { id: string; postUrl: string }[] = [];
    
    if (postUrl) {
      posts = [{ id: "test", postUrl }];
      log(`📍 Testing single URL: ${postUrl}`);
    } else if (postId) {
      const post = await prisma.groupPost.findUnique({
        where: { id: postId },
        select: { id: true, postUrl: true },
      });
      if (post) {
        posts = [post];
        log(`📍 Testing post ID: ${postId}`);
      }
    } else {
      // Get random posts without content
      posts = await prisma.groupPost.findMany({
        where: { hasContent: false },
        select: { id: true, postUrl: true },
        take: limit,
        orderBy: { scrapedAt: "desc" },
      });
      log(`📍 Testing ${posts.length} posts without content`);
    }

    if (posts.length === 0) {
      return NextResponse.json({ error: "No posts found to test", logs });
    }

    // Launch browser
    log("🌐 Launching browser...");
    session = await launchBrowser({
      accountId,
      headless: false,
    });

    // Warmup
    const isLoggedIn = await warmupSession(session.page, log);
    if (!isLoggedIn) {
      throw new Error("Account is not logged in");
    }

    const results: Array<{
      postUrl: string;
      postId: string;
      success: boolean;
      content: {
        postText: string;
        authorName: string;
        authorProfileUrl: string;
        hasImages: boolean;
        hasVideo: boolean;
        isAnonymous: boolean;
        debugInfo: {
          pageTitle: string;
          currentUrl: string;
          allTexts: string[];
          foundSelectors: string[];
        };
      } | null;
      error?: string;
    }> = [];

    for (const post of posts) {
      log(`\n📄 Processing: ${post.postUrl}`);

      try {
        // Navigate to post
        log(`   🔗 Navigating...`);
        await session.page.goto(post.postUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
        await humanDelay(2000, 3000);

        // Get current URL (might have redirected)
        const currentUrl = session.page.url();
        log(`   📍 Current URL: ${currentUrl}`);

        // Debug: take screenshot
        // await session.page.screenshot({ path: `debug-${post.id}.png` });

        // Extract using story_message selector (most reliable)
        const content = await session.page.evaluate(() => {
          // Try dialog first (normal post URL behavior)
          const dialog = document.querySelector('[role="dialog"]');
          const searchRoot = dialog || document;

          // Extract content using story_message
          let postText = '';
          const storyMessage = searchRoot.querySelector('[data-ad-rendering-role="story_message"]');
          if (storyMessage) {
            const text = (storyMessage.textContent || '').trim();
            if (text.length > 10) {
              postText = text;
            }
          }

          // Get author info
          let authorName = '';
          let authorProfileUrl = '';
          
          // Look for author link with attributionsrc
          const authorLinks = searchRoot.querySelectorAll('a[role="link"][attributionsrc][href*="/user/"]');
          for (const link of authorLinks) {
            if (link.getAttribute('aria-hidden') === 'true') continue;
            const inComment = link.closest('[role="article"][aria-label*="Comment"]');
            if (inComment) continue;
            
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
            
            const name = getDeepText(link).trim();
            if (name && name.length > 1 && name.length < 50) {
              authorName = name;
              authorProfileUrl = (link as HTMLAnchorElement).href.split('?')[0];
              break;
            }
          }
          
          // Check if anonymous
          const isAnonymous = authorName === '' ||
                             authorName.toLowerCase().includes('anonymous') ||
                             document.body.innerText.toLowerCase().includes('anonymous member');

          return {
            postText: postText.slice(0, 2000),
            authorName: isAnonymous ? 'Anonymous' : authorName,
            authorProfileUrl: isAnonymous ? '' : authorProfileUrl,
            isAnonymous,
          };
        });

        log(`   ✅ Content: "${content.postText.slice(0, 60)}..."`);
        log(`   👤 Author: ${content.authorName} ${content.authorProfileUrl ? `→ ${content.authorProfileUrl.slice(0, 50)}` : ''}`);

        results.push({
          postUrl: post.postUrl,
          postId: post.id,
          success: content.postText.length > 10,
          content,
        });

      } catch (err) {
        log(`   ❌ Error: ${err}`);
        results.push({
          postUrl: post.postUrl,
          postId: post.id,
          success: false,
          content: null,
          error: String(err),
        });
      }

      await humanDelay(1000, 2000);
    }

    // Close browser
    log("\n🔒 Closing browser...");
    await session.browser.close();

    return NextResponse.json({
      success: true,
      results,
      logs,
    });

  } catch (error) {
    log(`❌ Error: ${error}`);
    if (session) {
      try { await session.browser.close(); } catch {}
    }
    return NextResponse.json({
      success: false,
      error: String(error),
      logs,
    }, { status: 500 });
  }
}

// GET - list posts without content
export async function GET() {
  const posts = await prisma.groupPost.findMany({
    where: { hasContent: false },
    select: { 
      id: true, 
      postUrl: true, 
      scrapedAt: true,
      group: { select: { name: true } }
    },
    take: 20,
    orderBy: { scrapedAt: "desc" },
  });

  const postsWithContent = await prisma.groupPost.findMany({
    where: { hasContent: true },
    select: { 
      id: true, 
      postUrl: true, 
      postText: true,
      authorName: true,
      scrapedAt: true,
    },
    take: 10,
    orderBy: { scrapedAt: "desc" },
  });

  return NextResponse.json({
    withoutContent: posts.length,
    withContent: postsWithContent.length,
    postsWithoutContent: posts,
    samplePostsWithContent: postsWithContent.map(p => ({
      ...p,
      postText: p.postText?.slice(0, 100) + "...",
    })),
  });
}
