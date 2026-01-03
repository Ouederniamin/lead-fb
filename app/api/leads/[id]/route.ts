import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { UpdateLeadStatusSchema } from "@/lib/schemas";

// GET /api/leads/[id] - Get lead details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      group: true,
      conversation: true,
      scrapedBy: {
        select: { accountEmail: true, accountName: true },
      },
    },
  });

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  return NextResponse.json(lead);
}

// PATCH /api/leads/[id] - Update lead status and stage
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const data = UpdateLeadStatusSchema.parse(body);

    // Build update data dynamically
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.status) {
      updateData.status = data.status;
    }
    if (data.stage) {
      updateData.stage = data.stage;
      updateData.stageUpdatedAt = new Date();
    }
    if (data.contactInfo) {
      updateData.contactInfo = data.contactInfo;
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: updateData,
    });

    // Handle conversation updates
    if (data.commentText || data.dmText) {
      // Require accountId when creating a new conversation
      if (!data.accountId) {
        // Try to use the lead's engagedByAccountId as fallback
        const leadWithAccount = await prisma.lead.findUnique({
          where: { id },
          select: { engagedByAccountId: true }
        });
        if (!leadWithAccount?.engagedByAccountId) {
          return NextResponse.json(
            { error: "accountId is required to create conversation" },
            { status: 400 }
          );
        }
        data.accountId = leadWithAccount.engagedByAccountId;
      }
      
      await prisma.conversation.upsert({
        where: { leadId: id },
        create: {
          leadId: id,
          accountId: data.accountId,
          commentText: data.commentText,
          commentPostedAt: data.commentText ? new Date() : null,
          dmText: data.dmText,
          dmSentAt: data.dmText ? new Date() : null,
          isHighIntent: lead.intentScore >= 4,
        },
        update: {
          commentText: data.commentText || undefined,
          commentPostedAt: data.commentText ? new Date() : undefined,
          dmText: data.dmText || undefined,
          dmSentAt: data.dmText ? new Date() : undefined,
          lastActivity: new Date(),
        },
      });
    }

    return NextResponse.json(lead);
  } catch (error) {
    console.error("Update lead error:", error);
    return NextResponse.json(
      { error: "Failed to update lead" },
      { status: 500 }
    );
  }
}

// DELETE /api/leads/[id] - Delete lead permanently
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    // First delete related conversation if exists
    await prisma.conversation.deleteMany({
      where: { leadId: id },
    });

    // Delete the lead
    await prisma.lead.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, deleted: id });
  } catch (error) {
    console.error("Delete lead error:", error);
    return NextResponse.json(
      { error: "Failed to delete lead" },
      { status: 500 }
    );
  }
}
