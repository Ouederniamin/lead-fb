import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

// GET /api/agents - List all agents
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agents = await prisma.agent.findMany({
    orderBy: { lastHeartbeat: "desc" },
    include: {
      _count: {
        select: { 
          assignedGroups: true,
          scrapedLeads: true 
        },
      },
    },
  });

  return NextResponse.json(agents);
}

// POST /api/agents - Register a new agent
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { accountEmail, accountName, vmHost, vmIp } = body;

    const agent = await prisma.agent.create({
      data: {
        accountEmail,
        accountName,
        vmHost,
        vmIp,
        status: "OFFLINE",
      },
    });

    return NextResponse.json(agent, { status: 201 });
  } catch (error) {
    console.error("Create agent error:", error);
    return NextResponse.json(
      { error: "Failed to create agent" },
      { status: 500 }
    );
  }
}
