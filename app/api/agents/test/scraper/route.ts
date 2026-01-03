// API Route: Test Scraper Agent
// POST /api/agents/test/scraper

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { runScraperAgent } from "@/agents";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { 
      accountId, 
      groups,
      groupIds, // Alternative: fetch groups from DB by IDs
      headless = false,
    } = await request.json();

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId is required" },
        { status: 400 }
      );
    }

    // Get groups either from request or from database
    let groupsToProcess = groups;

    if (!groupsToProcess && groupIds && Array.isArray(groupIds)) {
      // Fetch groups from database
      const dbGroups = await prisma.group.findMany({
        where: {
          id: { in: groupIds },
          isActive: true,
        },
        select: {
          id: true,
          url: true,
          name: true,
          lastScrapedShareUrl: true,  // Use share URL for comparison
          lastScrapedPostId: true,    // Fallback
          isInitialized: true,
        },
      });

      groupsToProcess = dbGroups.map(g => ({
        id: g.id,
        url: g.url,
        name: g.name,
        lastScrapedPostUrl: g.lastScrapedShareUrl || g.lastScrapedPostId,  // Prefer share URL
        isInitialized: g.isInitialized,
      }));
    }

    if (!groupsToProcess || !Array.isArray(groupsToProcess) || groupsToProcess.length === 0) {
      // If no groups specified, get all active groups
      const allGroups = await prisma.group.findMany({
        where: { isActive: true },
        select: {
          id: true,
          url: true,
          name: true,
          lastScrapedShareUrl: true,  // Use share URL for comparison
          lastScrapedPostId: true,    // Fallback
          isInitialized: true,
        },
        take: 5, // Limit for testing
      });

      if (allGroups.length === 0) {
        return NextResponse.json(
          { error: "No active groups found. Add groups first." },
          { status: 400 }
        );
      }

      groupsToProcess = allGroups.map(g => ({
        id: g.id,
        url: g.url,
        name: g.name,
        lastScrapedPostUrl: g.lastScrapedShareUrl || g.lastScrapedPostId,  // Prefer share URL
        isInitialized: g.isInitialized,
      }));
    }

    console.log(`[TestScraper] Starting with ${groupsToProcess.length} groups`);

    // Run the agent
    const result = await runScraperAgent({
      accountId,
      groups: groupsToProcess,
      headless,
      skipScheduleCheck: true, // Skip schedule for testing
    });

    return NextResponse.json({
      success: result.success,
      duration: result.duration,
      stats: result.stats,
      groupResults: result.groupResults.map(gr => ({
        groupId: gr.groupId,
        groupName: gr.groupName,
        postsScraped: gr.postsScraped,
        postsAnalyzed: gr.postsAnalyzed,
        groupPostsCreated: gr.groupPostsCreated,
        leadsCreated: gr.leadsCreated,
        error: gr.error,
      })),
      errors: result.errors,
      logsCount: result.logs.length,
      logs: result.logs.slice(-50), // Last 50 logs
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[TestScraper] Error: ${errorMsg}`);
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
  // Get active groups for reference
  const groups = await prisma.group.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      url: true,
      isInitialized: true,
      lastScrapedAt: true,
      totalPosts: true,
      totalLeads: true,
    },
    take: 10,
  });

  return NextResponse.json({
    endpoint: "POST /api/agents/test/scraper",
    description: "Test the Scraper Agent - scrapes groups and creates leads",
    body: {
      accountId: "string (required) - Account ID to use for scraping",
      groups: "array (optional) - Array of {id, url, name, lastScrapedPostUrl, isInitialized}",
      groupIds: "array (optional) - Array of group IDs to fetch from DB",
      maxPostsPerGroup: "number (default: 20) - Max posts to scrape per group",
      analyzeWithAI: "boolean (default: true) - Run AI analysis on posts",
      headless: "boolean (default: false) - Run browser headless",
    },
    note: "If no groups/groupIds provided, will use first 5 active groups from DB",
    activeGroups: groups,
    example: {
      accountId: "account-123",
      groupIds: ["group-id-1", "group-id-2"],
      maxPostsPerGroup: 10,
      analyzeWithAI: true,
    },
  });
}
