import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ContactStatus, ConversationStateEnum } from "@prisma/client";

// ============================================
// MESSAGE AGENT - Stats API
// GET /api/message-agent/stats?accountId=xxx - Get dashboard stats
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    
    if (!accountId) {
      return NextResponse.json({ error: 'accountId required' }, { status: 400 });
    }
    
    // Get config
    const config = await prisma.messageAgentConfig.findUnique({
      where: { accountId },
    });
    
    // Count by status
    const activeCount = await prisma.messengerContact.count({
      where: { accountId, status: ContactStatus.ACTIVE },
    });
    
    const oldCount = await prisma.messengerContact.count({
      where: { accountId, status: ContactStatus.OLD },
    });
    
    // Count by state (for ACTIVE only)
    const byState = {
      needsReply: await prisma.messengerContact.count({
        where: { accountId, status: ContactStatus.ACTIVE, state: ConversationStateEnum.NEEDS_REPLY },
      }),
      waiting: await prisma.messengerContact.count({
        where: { accountId, status: ContactStatus.ACTIVE, state: ConversationStateEnum.WAITING },
      }),
      active: await prisma.messengerContact.count({
        where: { accountId, status: ContactStatus.ACTIVE, state: ConversationStateEnum.ACTIVE },
      }),
      idle: await prisma.messengerContact.count({
        where: { accountId, status: ContactStatus.ACTIVE, state: ConversationStateEnum.IDLE },
      }),
      ended: await prisma.messengerContact.count({
        where: { accountId, status: ContactStatus.ACTIVE, state: ConversationStateEnum.ENDED },
      }),
      new: await prisma.messengerContact.count({
        where: { accountId, status: ContactStatus.ACTIVE, state: ConversationStateEnum.NEW },
      }),
    };
    
    // Get contacts needing reply (ordered by oldest first)
    const needsReplyContacts = await prisma.messengerContact.findMany({
      where: {
        accountId,
        status: ContactStatus.ACTIVE,
        state: ConversationStateEnum.NEEDS_REPLY,
      },
      orderBy: { lastTheirMessageAt: 'asc' },
      take: 10,
      select: {
        id: true,
        contactName: true,
        conversationUrl: true,
        lastTheirMessage: true,
        lastTheirMessageAt: true,
        stateChangedAt: true,
        theirMessageCount: true,
        ourMessageCount: true,
        leadId: true,
        leadStage: true,
      },
    });
    
    // Recent activity (last 10 contacts with activity)
    const recentActivity = await prisma.messengerContact.findMany({
      where: {
        accountId,
        status: ContactStatus.ACTIVE,
      },
      orderBy: { lastActivityAt: 'desc' },
      take: 10,
      select: {
        id: true,
        contactName: true,
        state: true,
        lastActivityAt: true,
        lastTheirMessage: true,
        lastOurReply: true,
        theirMessageCount: true,
        ourMessageCount: true,
        leadId: true,
        leadStage: true,
      },
    });
    
    // Get linked to lead count
    const linkedToLead = await prisma.messengerContact.count({
      where: { 
        accountId, 
        status: ContactStatus.ACTIVE,
        leadId: { not: null },
      },
    });
    
    // Format needsReplyContacts for UI
    const formattedNeedsReply = needsReplyContacts.map((c) => ({
      id: c.id,
      name: c.contactName,
      state: 'NEEDS_REPLY',
      status: 'ACTIVE',
      lastMessageAt: c.lastTheirMessageAt?.toISOString() || null,
      messagesReceived: c.theirMessageCount,
      messagesSent: c.ourMessageCount,
      leadId: c.leadId,
      leadStage: c.leadStage,
    }));
    
    // Format recentActivity for UI
    const formattedRecent = recentActivity.map((c) => ({
      id: c.id,
      name: c.contactName,
      state: c.state,
      status: 'ACTIVE',
      lastMessageAt: c.lastActivityAt?.toISOString() || null,
      messagesReceived: c.theirMessageCount,
      messagesSent: c.ourMessageCount,
      leadId: c.leadId,
      leadStage: c.leadStage,
    }));
    
    // Create byState object with uppercase keys for UI
    const byStateFormatted: Record<string, number> = {};
    if (byState.new > 0) byStateFormatted['NEW'] = byState.new;
    if (byState.needsReply > 0) byStateFormatted['NEEDS_REPLY'] = byState.needsReply;
    if (byState.waiting > 0) byStateFormatted['WAITING'] = byState.waiting;
    if (byState.active > 0) byStateFormatted['ACTIVE'] = byState.active;
    if (byState.idle > 0) byStateFormatted['IDLE'] = byState.idle;
    if (byState.ended > 0) byStateFormatted['ENDED'] = byState.ended;
    
    return NextResponse.json({
      summary: {
        total: activeCount + oldCount,
        active: activeCount,
        old: oldCount,
        needsReply: byState.needsReply,
        waiting: byState.waiting,
        linkedToLead,
      },
      byState: byStateFormatted,
      needsReplyContacts: formattedNeedsReply,
      recentActivity: formattedRecent,
      config: config ? {
        inactiveDays: config.inactiveDays,
        refreshOldDays: config.refreshOldDays,
        scanIntervalMinutes: config.scanIntervalMinutes,
        lastScanAt: config.lastScanAt,
        lastMaintenanceAt: config.lastMaintenanceAt,
        lastFullSidebarScan: config.lastFullSidebarScan,
      } : null,
    });
  } catch (error) {
    console.error('GET stats error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
