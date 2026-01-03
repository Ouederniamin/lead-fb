import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { CreateGroupSchema } from "@/lib/schemas";

// GET /api/groups - List all groups with full details
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const groups = await prisma.group.findMany({
    orderBy: [{ name: "asc" }],
    include: {
      assignedAgent: {
        select: { id: true, accountEmail: true, status: true },
      },
      assignedAccount: {
        select: { id: true, email: true, name: true, isLoggedIn: true, isBanned: true },
      },
      _count: {
        select: { leads: true, posts: true },
      },
    },
  });

  // Return with full info
  return NextResponse.json({
    groups: groups.map(g => ({
      id: g.id,
      name: g.name,
      url: g.url,
      fbGroupId: g.fbGroupId,
      description: g.description,
      memberCount: g.memberCount,
      isActive: g.isActive,
      // Initialization info
      isInitialized: g.isInitialized,
      initializedAt: g.initializedAt,
      // Scraping info
      lastScrapedAt: g.lastScrapedAt,
      lastScrapedPostId: g.lastScrapedPostId,
      // Stats
      totalPosts: g.totalPosts,
      totalLeads: g.totalLeads,
      leadsCount: g._count.leads,
      postsCount: g._count.posts,
      // Assignment
      assignedAccountId: g.assignedAccountId,
      assignedAccount: g.assignedAccount,
      assignedAgentId: g.assignedAgentId,
      assignedAgent: g.assignedAgent,
      // Dates
      createdAt: g.createdAt,
    })),
  });
}

// POST /api/groups - Add a new group
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = CreateGroupSchema.parse(body);

    const createData = {
      url: data.url,
      name: data.name,
      description: data.description,
      memberCount: data.memberCount,
      isActive: data.isActive ?? true,
      ...(data.assignedAccountId ? { assignedAccountId: data.assignedAccountId } : {}),
    };

    const group = await prisma.group.create({
      data: createData,
      include: {
        assignedAccount: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    return NextResponse.json(group, { status: 201 });
  } catch (error) {
    console.error("Create group error:", error);
    return NextResponse.json(
      { error: "Failed to create group" },
      { status: 500 }
    );
  }
}
