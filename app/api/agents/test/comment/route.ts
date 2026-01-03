// API Route: Test Comment Procedure
// POST /api/agents/test/comment

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  launchBrowser,
  warmupSession,
  closeBrowser,
  commentOnPost,
  generatePostComment,
} from "@/agents/procedures";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const logs: string[] = [];
  const log = (msg: string) => {
    const timestamp = new Date().toISOString();
    logs.push(`[${timestamp}] ${msg}`);
    console.log(`[TestComment] ${msg}`);
  };

  try {
    const { 
      accountId, 
      postUrl, 
      commentText,
      headless = false,
      generateComment = true,
      postText,
      matchedService,
    } = await request.json();

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId is required" },
        { status: 400 }
      );
    }

    if (!postUrl) {
      return NextResponse.json(
        { error: "postUrl is required" },
        { status: 400 }
      );
    }

    log(`🚀 Starting comment test`);
    log(`👤 Account: ${accountId}`);
    log(`📝 Post: ${postUrl}`);

    // Launch browser
    log("🌐 Launching browser...");
    const session = await launchBrowser({
      accountId,
      headless,
    });

    try {
      // Warmup
      const isLoggedIn = await warmupSession(session.page, log);
      if (!isLoggedIn) {
        throw new Error("Account is not logged in");
      }

      // Generate or use provided comment
      let finalComment = commentText;
      if (!finalComment && generateComment) {
        log("🧠 Generating comment with AI...");
        finalComment = await generatePostComment(
          postText || "Someone is looking for a service",
          matchedService || null,
          log
        );
      }

      if (!finalComment) {
        finalComment = "نجموا نعاونوك 👍 ابعثلي message";
      }

      log(`💬 Comment to post: "${finalComment}"`);

      // Post the comment
      const result = await commentOnPost(
        session.page,
        postUrl,
        finalComment,
        log
      );

      return NextResponse.json({
        success: result.success,
        commentText: result.commentText,
        postUrl: result.postUrl,
        error: result.error,
        logs,
      });
    } finally {
      log("🔒 Closing browser...");
      await closeBrowser(session);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log(`❌ Error: ${errorMsg}`);
    return NextResponse.json(
      { 
        success: false,
        error: errorMsg,
        logs,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "POST /api/agents/test/comment",
    description: "Test commenting on a Facebook post",
    body: {
      accountId: "string (required) - Account ID to use",
      postUrl: "string (required) - URL of the post to comment on",
      commentText: "string (optional) - Custom comment text",
      generateComment: "boolean (default: true) - Generate comment with AI",
      postText: "string (optional) - Post text for AI comment generation",
      matchedService: "string (optional) - Matched service for AI context",
      headless: "boolean (default: false) - Run browser headless",
    },
    example: {
      accountId: "account-123",
      postUrl: "https://www.facebook.com/groups/123/posts/456",
      generateComment: true,
      postText: "نحب نعمل موقع لشركتي",
      matchedService: "تطوير مواقع ويب",
    },
  });
}
