// API Route: Test Message Agent
// POST /api/agents/test/message-agent

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { runMessageAgent } from "@/agents";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { 
      accountId, 
      headless = false,
      idleTimeoutMs = 60000, // 1 minute for testing (default 2 min)
    } = await request.json();

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId is required" },
        { status: 400 }
      );
    }

    // Run the agent (skip schedule check for testing)
    const result = await runMessageAgent({
      accountId,
      headless,
      idleTimeoutMs,
      skipScheduleCheck: true, // Always run for testing
    });

    return NextResponse.json({
      success: result.success,
      duration: result.duration,
      stoppedReason: result.stoppedReason,
      stats: result.stats,
      conversationsHandled: result.conversationsHandled,
      logs: result.logs.slice(-50), // Last 50 logs
      errors: result.errors,
    });
  } catch (error) {
    console.error("[MessageAgentTest] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
