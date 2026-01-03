import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { Prisma, LeadStatus, LeadStage } from "@prisma/client";

// GET /api/leads - List leads with filters and pagination
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const stage = searchParams.get("stage");
  const intent = searchParams.get("intent");
  const search = searchParams.get("search");
  const groupId = searchParams.get("groupId");
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "15");

  const where: Prisma.LeadWhereInput = {};
  
  if (status && status !== "all" && Object.values(LeadStatus).includes(status as LeadStatus)) {
    where.status = { equals: status as LeadStatus };
  }
  if (stage && stage !== "all" && Object.values(LeadStage).includes(stage as LeadStage)) {
    where.stage = { equals: stage as LeadStage };
  }
  if (intent && intent !== "all") {
    where.intentScore = { gte: parseInt(intent) };
  }
  if (groupId) {
    where.groupId = groupId;
  }
  if (search) {
    where.OR = [
      { authorName: { contains: search, mode: 'insensitive' } },
      { postText: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      take: pageSize,
      skip: (page - 1) * pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        group: { select: { id: true, name: true } },
        conversation: { select: { id: true, leadReplied: true } },
      },
    }),
    prisma.lead.count({ where }),
  ]);

  return NextResponse.json({ 
    leads, 
    meta: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
  });
}

// POST /api/leads - Create a new lead (from worker agent)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      groupId,
      postUrl,
      authorName,
      authorProfileUrl,
      authorFbId,
      postText,
      postDate,
      aiAnalysis,
      intentScore,
      scrapedById,
    } = body;

    // Check if lead already exists
    const existing = await prisma.lead.findUnique({
      where: { postUrl },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Lead already exists", lead: existing },
        { status: 409 }
      );
    }

    const lead = await prisma.lead.create({
      data: {
        groupId,
        postUrl,
        authorName,
        authorProfileUrl,
        authorFbId,
        postText,
        postDate: postDate ? new Date(postDate) : null,
        aiAnalysis,
        intentScore: intentScore || 0,
        scrapedById,
      },
    });

    // Update group stats
    await prisma.group.update({
      where: { id: groupId },
      data: {
        totalLeads: { increment: 1 },
        lastScraped: new Date(),
      },
    });

    return NextResponse.json(lead, { status: 201 });
  } catch (error) {
    console.error("Create lead error:", error);
    return NextResponse.json(
      { error: "Failed to create lead" },
      { status: 500 }
    );
  }
}
