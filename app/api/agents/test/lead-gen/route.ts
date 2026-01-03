// API Route: Test Lead Gen Agent
// POST /api/agents/test/lead-gen

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { runLeadGenAgent } from "@/agents";
import { SERVICES_LIST } from "@/agents/procedures";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { 
      accountId, 
      groups, 
      headless = false,
      maxPosts = 30,
      autoComment = false,
      autoDM = false,
    } = await request.json();

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId is required" },
        { status: 400 }
      );
    }

    if (!groups || !Array.isArray(groups) || groups.length === 0) {
      return NextResponse.json(
        { error: "groups array is required with at least one group" },
        { status: 400 }
      );
    }

    // Validate groups format
    for (const group of groups) {
      if (!group.url) {
        return NextResponse.json(
          { error: "Each group must have a url property" },
          { status: 400 }
        );
      }
    }

    // Run the agent (skip schedule check for testing)
    const result = await runLeadGenAgent({
      accountId,
      groups: groups.map((g: { id?: string; url: string; lastScrapedPostUrl?: string }) => ({
        id: g.id || "test",
        url: g.url,
        lastScrapedPostUrl: g.lastScrapedPostUrl || null,
      })),
      headless,
      maxPosts,
      autoComment,
      autoDM,
      skipScheduleCheck: true, // Always run for testing
    });

    return NextResponse.json({
      success: result.success,
      duration: result.duration,
      stats: result.stats,
      services: SERVICES_LIST, // List of services AI checks for
      groupResults: result.groupResults.map(gr => ({
        groupId: gr.groupId,
        groupUrl: gr.groupUrl,
        postsScraped: gr.postsScraped,
        postsAnalyzed: gr.postsAnalyzed,
        leadsCreated: gr.leadsCreated,
        newLastScrapedPostUrl: gr.newLastScrapedPostUrl,
        posts: gr.postResults.map(pr => ({
          postUrl: pr.post.postUrl,
          content: pr.post.content,
          authorName: pr.post.authorName,
          authorProfileUrl: pr.post.authorProfileUrl,
          isAnonymous: pr.post.isAnonymous,
          analysis: {
            isLead: pr.analysis.isLead,
            matchedService: pr.analysis.matchedService,
            reason: pr.analysis.reason,
            suggestedComment: pr.analysis.suggestedComment,
          },
        })),
      })),
      errors: result.errors,
    });
  } catch (error) {
    console.error("[LeadGenTest] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
