import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { shouldAgentRun } from "@/lib/schedule-service";
import { ContactStatus, ConversationStateEnum } from "@prisma/client";

// ============================================
// MESSAGE AGENT - Scheduled Execution
// POST /api/message-agent/run - Run the scheduled message agent
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { accountId, force = false } = body;
    
    if (!accountId) {
      return NextResponse.json({ error: 'accountId required' }, { status: 400 });
    }
    
    // Check if MESSAGE_AGENT should run now (unless forced)
    if (!force) {
      const status = await shouldAgentRun('MESSAGE_AGENT');
      if (!status.shouldRun) {
        return NextResponse.json({
          success: false,
          skipped: true,
          reason: status.reason,
          currentHour: status.currentHour,
        });
      }
    }
    
    const logs: string[] = [];
    const log = (msg: string) => { logs.push(msg); console.log(`[MessageAgent] ${msg}`); };
    
    log(`🤖 Starting scheduled message agent run for account: ${accountId}`);
    
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const results = {
      scan: null as any,
      reply: null as any,
      maintenance: null as any,
    };
    
    // Step 1: Scan for new messages
    log('📡 Step 1: Scanning for new messages...');
    try {
      const scanResponse = await fetch(`${baseUrl}/api/message-agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, action: 'scan' }),
      });
      results.scan = await scanResponse.json();
      log(`   ✅ Scan complete: ${results.scan.stats?.needsReply || 0} need reply`);
    } catch (err) {
      log(`   ❌ Scan failed: ${err}`);
    }
    
    // Step 2: Send replies (limit based on schedule config)
    const config = await prisma.messageAgentConfig.findUnique({
      where: { accountId },
    });
    
    const needsReplyCount = await prisma.messengerContact.count({
      where: {
        accountId,
        status: ContactStatus.ACTIVE,
        state: ConversationStateEnum.NEEDS_REPLY,
      },
    });
    
    if (needsReplyCount > 0) {
      log(`💬 Step 2: Sending AI replies (${needsReplyCount} pending)...`);
      
      // Get max DMs from schedule for this hour
      const scheduleStatus = await shouldAgentRun('MESSAGE_AGENT');
      const maxReplies = scheduleStatus.hourConfig?.dms || 1;
      
      try {
        const replyResponse = await fetch(`${baseUrl}/api/message-agent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId, action: 'reply', maxReplies }),
        });
        results.reply = await replyResponse.json();
        log(`   ✅ Reply complete: ${results.reply.stats?.returning || 0} sent`);
      } catch (err) {
        log(`   ❌ Reply failed: ${err}`);
      }
    } else {
      log('💬 Step 2: No replies needed, skipping');
    }
    
    // Step 3: Maintenance (once per day)
    const lastMaintenance = config?.lastMaintenanceAt;
    const hoursSinceMaintenance = lastMaintenance 
      ? (Date.now() - lastMaintenance.getTime()) / (1000 * 60 * 60)
      : 999;
    
    if (hoursSinceMaintenance >= 24) {
      log('🔧 Step 3: Running daily maintenance...');
      try {
        const maintResponse = await fetch(`${baseUrl}/api/message-agent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId, action: 'maintenance' }),
        });
        results.maintenance = await maintResponse.json();
        log(`   ✅ Maintenance complete`);
      } catch (err) {
        log(`   ❌ Maintenance failed: ${err}`);
      }
    } else {
      log(`🔧 Step 3: Skipping maintenance (last run ${hoursSinceMaintenance.toFixed(1)} hours ago)`);
    }
    
    // Log execution to database
    await prisma.scheduleExecution.create({
      data: {
        agentType: 'MESSAGE_AGENT',
        hour: new Date().getHours(),
        scheduledTime: new Date().toTimeString().slice(0, 5),
        action: 'full_run',
        status: 'COMPLETED',
        executedAt: new Date(),
        result: {
          scan: results.scan?.stats,
          reply: results.reply?.stats,
          maintenance: results.maintenance?.stats,
        },
      },
    });
    
    log('✅ Scheduled run complete!');
    
    return NextResponse.json({
      success: true,
      results,
      logs,
    });
  } catch (error) {
    console.error('[MessageAgent Run] Error:', error);
    return NextResponse.json({
      success: false,
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    
    if (!accountId) {
      return NextResponse.json({ error: 'accountId required' }, { status: 400 });
    }
    
    // Get schedule status
    const status = await shouldAgentRun('MESSAGE_AGENT');
    
    // Get recent executions
    const recentExecutions = await prisma.scheduleExecution.findMany({
      where: { agentType: 'MESSAGE_AGENT' },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    
    // Get contacts summary
    const activeCount = await prisma.messengerContact.count({
      where: { accountId, status: ContactStatus.ACTIVE },
    });
    const needsReply = await prisma.messengerContact.count({
      where: { accountId, status: ContactStatus.ACTIVE, state: ConversationStateEnum.NEEDS_REPLY },
    });
    
    // Get config
    const config = await prisma.messageAgentConfig.findUnique({
      where: { accountId },
    });
    
    return NextResponse.json({
      schedule: status,
      config,
      contacts: {
        active: activeCount,
        needsReply,
      },
      recentExecutions,
    });
  } catch (error) {
    console.error('[MessageAgent Run GET] Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
