// API Route: Test Initial DM Procedure
// POST /api/agents/test/initial-dm

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  launchBrowser,
  warmupSession,
  closeBrowser,
  sendInitialDM,
  generateInitialDM,
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
    console.log(`[TestDM] ${msg}`);
  };

  try {
    const { 
      accountId, 
      profileUrl, 
      messageText,
      headless = false,
      generateMessage = true,
      authorName,
      postText,
      matchedService,
    } = await request.json();

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId is required" },
        { status: 400 }
      );
    }

    if (!profileUrl) {
      return NextResponse.json(
        { error: "profileUrl is required" },
        { status: 400 }
      );
    }

    log(`🚀 Starting DM test`);
    log(`👤 Account: ${accountId}`);
    log(`🔗 Profile: ${profileUrl}`);

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

      // Generate or use provided message
      let finalMessage = messageText;
      if (!finalMessage && generateMessage) {
        log("🧠 Generating initial DM with AI...");
        finalMessage = await generateInitialDM(
          authorName || "صديق",
          postText || "Someone is looking for a service",
          matchedService || null,
          log
        );
      }

      if (!finalMessage) {
        finalMessage = "عسلامة! شفت طلبك في المجموعة. نجم نعاونك؟";
      }

      log(`📧 Message to send: "${finalMessage.substring(0, 50)}..."`);

      // Send the DM
      const result = await sendInitialDM(
        session.page,
        profileUrl,
        finalMessage,
        log
      );

      return NextResponse.json({
        success: result.success,
        messageText: result.messageText,
        profileUrl: result.profileUrl,
        conversationUrl: result.conversationUrl,
        contactName: result.contactName,
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
    endpoint: "POST /api/agents/test/initial-dm",
    description: "Test sending an initial DM from a Facebook profile",
    body: {
      accountId: "string (required) - Account ID to use",
      profileUrl: "string (required) - URL of the profile to message",
      messageText: "string (optional) - Custom message text",
      generateMessage: "boolean (default: true) - Generate message with AI",
      authorName: "string (optional) - Name of the person for AI context",
      postText: "string (optional) - Original post text for AI context",
      matchedService: "string (optional) - Matched service for AI context",
      headless: "boolean (default: false) - Run browser headless",
    },
    example: {
      accountId: "account-123",
      profileUrl: "https://www.facebook.com/profile.php?id=123",
      generateMessage: true,
      authorName: "محمد",
      postText: "نحب نعمل موقع لشركتي",
      matchedService: "تطوير مواقع ويب",
    },
  });
}
