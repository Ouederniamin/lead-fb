// API Route: Test Initiator Agent
// POST /api/agents/test/initiator

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { runInitiatorAgent } from "@/agents";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { 
      accountId, 
      maxLeads = 5,
      leadIds,
      headless = false,
      commentOnly = false,
      dmOnly = false,
    } = await request.json();

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId is required" },
        { status: 400 }
      );
    }

    // Check for available leads
    const availableLeads = await prisma.lead.count({
      where: {
        status: "NEW",
        stage: "LEAD",
        engagedByAccountId: null,
      },
    });

    console.log(`[TestInitiator] Found ${availableLeads} available leads`);

    if (availableLeads === 0 && !leadIds) {
      return NextResponse.json(
        { 
          error: "No NEW leads available to process",
          suggestion: "Run the Scraper Agent first to create leads",
        },
        { status: 400 }
      );
    }

    // Run the agent
    const result = await runInitiatorAgent({
      accountId,
      maxLeads,
      leadIds,
      headless,
      commentOnly,
      dmOnly,
      skipScheduleCheck: true, // Skip schedule for testing
    });

    return NextResponse.json({
      success: result.success,
      duration: result.duration,
      stats: result.stats,
      leadResults: result.leadResults.map(lr => ({
        leadId: lr.leadId,
        authorName: lr.authorName,
        isAnonymous: lr.isAnonymous,
        commented: lr.commented,
        commentError: lr.commentError,
        dmSent: lr.dmSent,
        dmError: lr.dmError,
        messengerContactId: lr.messengerContactId,
        conversationId: lr.conversationId,
      })),
      errors: result.errors,
      logsCount: result.logs.length,
      logs: result.logs.slice(-50), // Last 50 logs
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[TestInitiator] Error: ${errorMsg}`);
    return NextResponse.json(
      { 
        success: false,
        error: errorMsg,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Get stats for reference
  const [newLeads, nonAnonymousLeads, recentLeads] = await Promise.all([
    prisma.lead.count({
      where: {
        status: "NEW",
        stage: "LEAD",
        engagedByAccountId: null,
      },
    }),
    prisma.lead.count({
      where: {
        status: "NEW",
        stage: "LEAD",
        engagedByAccountId: null,
        isAnonymous: false,
        authorProfileUrl: { not: null },
      },
    }),
    prisma.lead.findMany({
      where: {
        status: "NEW",
        stage: "LEAD",
        engagedByAccountId: null,
      },
      select: {
        id: true,
        authorName: true,
        isAnonymous: true,
        matchedService: true,
        intentScore: true,
        createdAt: true,
      },
      orderBy: { intentScore: "desc" },
      take: 10,
    }),
  ]);

  return NextResponse.json({
    endpoint: "POST /api/agents/test/initiator",
    description: "Test the Initiator Agent - comments on posts and sends initial DMs",
    body: {
      accountId: "string (required) - Account ID to use for engagement",
      maxLeads: "number (default: 5) - Max leads to process",
      leadIds: "array (optional) - Specific lead IDs to process",
      commentOnly: "boolean (default: false) - Only post comments, skip DMs",
      dmOnly: "boolean (default: false) - Only send DMs, skip comments",
      headless: "boolean (default: false) - Run browser headless",
    },
    stats: {
      totalNewLeads: newLeads,
      dmEligibleLeads: nonAnonymousLeads,
      note: "DM eligible = not anonymous and has profile URL",
    },
    recentLeads,
    example: {
      accountId: "account-123",
      maxLeads: 3,
      commentOnly: false,
      dmOnly: false,
    },
  });
}
