// API Route: Test First-Time Scraper Agent
// POST /api/agents/test/first-time-scraper

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { runFirstTimeScraper } from "@/agents";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { 
      groupId, 
      groupUrl, 
      accountId, 
      headless = false,
      maxPosts = 400,
      analyzeWithAI = true,
      createLeads = true,
    } = await request.json();

    if (!groupUrl || !accountId) {
      return NextResponse.json(
        { error: "groupUrl and accountId are required" },
        { status: 400 }
      );
    }

    // Find or create the group from URL
    let resolvedGroupId = groupId;
    if (!resolvedGroupId) {
      // Extract group identifier from URL
      const urlMatch = groupUrl.match(/groups\/([^\/\?]+)/);
      const groupIdentifier = urlMatch ? urlMatch[1] : groupUrl;
      
      // Try to find existing group
      let group = await prisma.group.findFirst({
        where: {
          OR: [
            { url: { contains: groupIdentifier } },
            { name: groupIdentifier },
          ],
        },
      });

      // If not found, create it
      if (!group) {
        group = await prisma.group.create({
          data: {
            name: groupIdentifier,
            url: groupUrl,
            isActive: true,
          },
        });
      }
      resolvedGroupId = group.id;
    }

    // Run the agent
    const result = await runFirstTimeScraper({
      groupUrl,
      groupId: resolvedGroupId,
      accountId,
      headless,
      maxPosts,
      analyzeWithAI,
      createLeads, // Always create leads since we have a real groupId now
    });

    // Update the group status
    if (result.success && result.stats.postsScraped > 0) {
      await prisma.group.update({
        where: { id: resolvedGroupId },
        data: {
          isInitialized: true,
          initializedAt: new Date(),
          lastScrapedPostId: result.lastScrapedPostUrl,
          lastScraped: new Date(),
          totalPosts: { increment: result.stats.postsScraped },
        },
      });
    }

    return NextResponse.json({
      success: result.success,
      duration: result.duration,
      stats: result.stats,
      lastScrapedPostUrl: result.lastScrapedPostUrl,
      leadsCreated: result.stats.leadsCreated,
      postResults: result.postResults?.slice(0, 20), // First 20 post results
      logs: result.logs.slice(-30), // Last 30 logs
      errors: result.errors,
    });
  } catch (error) {
    console.error("[FirstTimeScraperTest] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
