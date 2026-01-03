// API Route: Run Multiple Agents in Parallel
// POST /api/agents/test/parallel

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { runFirstTimeScraper, runLeadGenAgent, runMessageAgent } from "@/agents";
import { prisma } from "@/lib/db";

interface AgentTask {
  type: "first-time-scraper" | "lead-gen" | "message-agent";
  accountId: string;
  config?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { agents } = await request.json() as { agents: AgentTask[] };

    if (!agents || !Array.isArray(agents) || agents.length === 0) {
      return NextResponse.json(
        { 
          error: "agents array is required",
          example: {
            agents: [
              { 
                type: "first-time-scraper", 
                accountId: "account-1",
                config: { groupUrl: "...", groupId: "...", maxPosts: 20 }
              },
              { 
                type: "lead-gen", 
                accountId: "account-2",
                config: { groups: [{ id: "...", url: "..." }] }
              },
              { 
                type: "message-agent", 
                accountId: "account-3",
                config: { idleTimeoutMs: 60000 }
              }
            ]
          }
        },
        { status: 400 }
      );
    }

    // Validate each agent task
    for (const agent of agents) {
      if (!agent.type || !agent.accountId) {
        return NextResponse.json(
          { error: "Each agent must have 'type' and 'accountId'" },
          { status: 400 }
        );
      }
      if (!["first-time-scraper", "lead-gen", "message-agent"].includes(agent.type)) {
        return NextResponse.json(
          { error: `Invalid agent type: ${agent.type}` },
          { status: 400 }
        );
      }
    }

    // Check that we're not using the same account for multiple agents
    const accountIds = agents.map(a => a.accountId);
    const uniqueAccountIds = new Set(accountIds);
    if (uniqueAccountIds.size !== accountIds.length) {
      return NextResponse.json(
        { error: "Each agent must use a different accountId to avoid conflicts" },
        { status: 400 }
      );
    }

    const startTime = Date.now();

    // Create promises for each agent
    const agentPromises = agents.map(async (agent) => {
      const agentStartTime = Date.now();
      
      try {
        switch (agent.type) {
          case "first-time-scraper": {
            const config = agent.config as { groupUrl?: string; groupId?: string; maxPosts?: number; headless?: boolean };
            if (!config?.groupUrl) {
              return {
                type: agent.type,
                accountId: agent.accountId,
                success: false,
                error: "groupUrl is required for first-time-scraper",
                duration: Date.now() - agentStartTime,
              };
            }
            const result = await runFirstTimeScraper({
              groupUrl: config.groupUrl,
              groupId: config.groupId || "parallel-test",
              accountId: agent.accountId,
              headless: config.headless ?? false,
              maxPosts: config.maxPosts ?? 20,
              analyzeWithAI: true,
              createLeads: !!config.groupId,
            });
            return {
              type: agent.type,
              accountId: agent.accountId,
              success: result.success,
              duration: Date.now() - agentStartTime,
              stats: result.stats,
              errors: result.errors,
            };
          }

          case "lead-gen": {
            const config = agent.config as { groups?: Array<{ id?: string; url: string; lastScrapedPostUrl?: string }>; maxPosts?: number; headless?: boolean };
            if (!config?.groups || config.groups.length === 0) {
              return {
                type: agent.type,
                accountId: agent.accountId,
                success: false,
                error: "groups array is required for lead-gen",
                duration: Date.now() - agentStartTime,
              };
            }
            const result = await runLeadGenAgent({
              accountId: agent.accountId,
              groups: config.groups.map(g => ({
                id: g.id || "parallel-test",
                url: g.url,
                lastScrapedPostUrl: g.lastScrapedPostUrl || null,
              })),
              headless: config.headless ?? false,
              maxPosts: config.maxPosts ?? 20,
              skipScheduleCheck: true,
            });
            return {
              type: agent.type,
              accountId: agent.accountId,
              success: result.success,
              duration: Date.now() - agentStartTime,
              stats: result.stats,
              errors: result.errors,
            };
          }

          case "message-agent": {
            const config = agent.config as { idleTimeoutMs?: number; headless?: boolean };
            const result = await runMessageAgent({
              accountId: agent.accountId,
              headless: config?.headless ?? false,
              idleTimeoutMs: config?.idleTimeoutMs ?? 60000,
              skipScheduleCheck: true,
            });
            return {
              type: agent.type,
              accountId: agent.accountId,
              success: result.success,
              duration: Date.now() - agentStartTime,
              stats: result.stats,
              stoppedReason: result.stoppedReason,
              conversationsHandled: result.conversationsHandled.length,
              errors: result.errors,
            };
          }

          default:
            return {
              type: agent.type,
              accountId: agent.accountId,
              success: false,
              error: "Unknown agent type",
              duration: Date.now() - agentStartTime,
            };
        }
      } catch (error) {
        return {
          type: agent.type,
          accountId: agent.accountId,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - agentStartTime,
        };
      }
    });

    // Run all agents in parallel
    const results = await Promise.all(agentPromises);

    const totalDuration = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;

    return NextResponse.json({
      success: successCount === results.length,
      totalAgents: results.length,
      successCount,
      failedCount: results.length - successCount,
      totalDuration,
      results,
    });
  } catch (error) {
    console.error("[ParallelAgentsTest] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// GET - Return usage info
export async function GET() {
  return NextResponse.json({
    endpoint: "POST /api/agents/test/parallel",
    description: "Run multiple agents in parallel using different Facebook accounts",
    important: "Each agent MUST use a different accountId to avoid browser conflicts",
    example: {
      agents: [
        { 
          type: "first-time-scraper", 
          accountId: "account-1",
          config: { 
            groupUrl: "https://www.facebook.com/groups/...", 
            groupId: "clxx...",
            maxPosts: 20 
          }
        },
        { 
          type: "lead-gen", 
          accountId: "account-2",
          config: { 
            groups: [
              { id: "clxx...", url: "https://www.facebook.com/groups/..." }
            ],
            maxPosts: 30
          }
        },
        { 
          type: "message-agent", 
          accountId: "account-3",
          config: { 
            idleTimeoutMs: 120000 
          }
        }
      ]
    },
    agentTypes: {
      "first-time-scraper": {
        description: "Initialize a new group - scrapes historical posts and creates leads",
        requiredConfig: ["groupUrl"],
        optionalConfig: ["groupId", "maxPosts", "headless"]
      },
      "lead-gen": {
        description: "Monitor groups for new posts and create leads",
        requiredConfig: ["groups"],
        optionalConfig: ["maxPosts", "headless"]
      },
      "message-agent": {
        description: "Monitor Messenger and reply to messages with AI",
        requiredConfig: [],
        optionalConfig: ["idleTimeoutMs", "headless"]
      }
    }
  });
}
