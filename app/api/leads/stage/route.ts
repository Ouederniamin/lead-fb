import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { LeadStage } from "@prisma/client";

// POST /api/leads/stage - Update lead stage (internal use from message agent)
// This endpoint is for internal automation use and doesn't require user auth
export async function POST(request: NextRequest) {
  try {
    // Verify internal API key for security
    const apiKey = request.headers.get("x-api-key");
    const internalKey = process.env.INTERNAL_API_KEY;
    
    if (!internalKey || apiKey !== internalKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { leadId, stage, contactInfo } = body;

    if (!leadId) {
      return NextResponse.json({ error: "leadId is required" }, { status: 400 });
    }

    if (!stage || !Object.values(LeadStage).includes(stage as LeadStage)) {
      return NextResponse.json({ 
        error: "Invalid stage", 
        validStages: Object.values(LeadStage) 
      }, { status: 400 });
    }

    // Find the lead
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, stage: true },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Define stage progression order
    const stageOrder: LeadStage[] = [
      'LEAD', 
      'INTERESTED',
      'CTA_WHATSAPP',
      'CTA_PHONE',
      'CONVERTED',
      'LOST'
    ];

    const currentIndex = stageOrder.indexOf(lead.stage as LeadStage);
    const newIndex = stageOrder.indexOf(stage as LeadStage);

    // Allow progression forward, or to LOST/CONVERTED from any stage
    const isValidProgression = 
      newIndex > currentIndex || 
      stage === 'LOST' || 
      stage === 'CONVERTED' ||
      (stage === 'CTA_PHONE' && lead.stage === 'CTA_WHATSAPP') ||
      (stage === 'CTA_WHATSAPP' && lead.stage === 'CTA_PHONE');

    if (!isValidProgression) {
      return NextResponse.json({ 
        message: "Stage not updated - cannot regress",
        currentStage: lead.stage,
        attemptedStage: stage
      }, { status: 200 });
    }

    // Update the lead
    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: {
        stage: stage as LeadStage,
        stageUpdatedAt: new Date(),
        ...(contactInfo && { contactInfo }),
      },
      select: {
        id: true,
        authorName: true,
        stage: true,
        stageUpdatedAt: true,
        contactInfo: true,
      },
    });

    console.log(`[STAGE UPDATE] Lead ${leadId} updated: ${lead.stage} → ${stage}`);

    return NextResponse.json({
      success: true,
      lead: updatedLead,
      previousStage: lead.stage,
    });
  } catch (error) {
    console.error("Stage update error:", error);
    return NextResponse.json(
      { error: "Failed to update stage" },
      { status: 500 }
    );
  }
}

// GET /api/leads/stage - Get stage info for a lead by authorFbId or conversation thread
export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get("x-api-key");
    const internalKey = process.env.INTERNAL_API_KEY;
    
    if (!internalKey || apiKey !== internalKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const authorFbId = searchParams.get("authorFbId");
    const authorName = searchParams.get("authorName");

    if (!authorFbId && !authorName) {
      return NextResponse.json({ 
        error: "authorFbId or authorName is required" 
      }, { status: 400 });
    }

    const lead = await prisma.lead.findFirst({
      where: authorFbId 
        ? { authorFbId } 
        : { authorName: { equals: authorName, mode: 'insensitive' } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        authorName: true,
        authorFbId: true,
        stage: true,
        status: true,
        contactInfo: true,
        stageUpdatedAt: true,
      },
    });

    if (!lead) {
      return NextResponse.json({ 
        error: "Lead not found",
        authorFbId,
        authorName,
      }, { status: 404 });
    }

    return NextResponse.json({ lead });
  } catch (error) {
    console.error("Get lead stage error:", error);
    return NextResponse.json(
      { error: "Failed to get lead stage" },
      { status: 500 }
    );
  }
}
