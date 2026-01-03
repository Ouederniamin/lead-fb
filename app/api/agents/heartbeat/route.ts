import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { AgentHeartbeatSchema } from "@/lib/schemas";

// POST /api/agents/heartbeat - Receive heartbeat from worker agents
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = AgentHeartbeatSchema.parse(body);

    const agent = await prisma.agent.update({
      where: { id: data.agentId },
      data: {
        status: data.status,
        lastHeartbeat: new Date(),
        dailyComments: data.dailyComments,
        dailyDms: data.dailyDms,
        dailyScrapes: data.dailyScrapes,
        lastError: data.error || null,
        isHealthy: !data.error,
      },
    });

    // Log the heartbeat
    await prisma.log.create({
      data: {
        agentId: agent.id,
        level: "INFO",
        action: "heartbeat",
        message: `Agent ${agent.accountEmail} heartbeat: ${data.status}`,
        metadata: data as object,
      },
    });

    return NextResponse.json({ success: true, agent });
  } catch (error) {
    console.error("Heartbeat error:", error);
    return NextResponse.json(
      { error: "Failed to process heartbeat" },
      { status: 500 }
    );
  }
}
