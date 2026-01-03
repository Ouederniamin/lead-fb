import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// ============================================
// MESSAGE AGENT - Configuration API
// GET /api/message-agent/config?accountId=xxx - Get config
// PATCH /api/message-agent/config - Update config
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    
    if (!accountId) {
      return NextResponse.json({ error: 'accountId required' }, { status: 400 });
    }
    
    // Get or create config
    let config = await prisma.messageAgentConfig.findUnique({
      where: { accountId },
    });
    
    if (!config) {
      config = await prisma.messageAgentConfig.create({
        data: {
          accountId,
          inactiveDays: 7,
          refreshOldDays: 7,
          forceFullCheckHours: 24,
          scanIntervalMinutes: 15,
        },
      });
    }
    
    return NextResponse.json({ config });
  } catch (error) {
    console.error('GET config error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountId, ...updates } = body;
    
    if (!accountId) {
      return NextResponse.json({ error: 'accountId required' }, { status: 400 });
    }
    
    // Validate numeric fields
    const allowedFields = [
      'inactiveDays',
      'refreshOldDays',
      'forceFullCheckHours',
      'scanIntervalMinutes',
    ];
    
    const safeUpdates: any = {};
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && typeof value === 'number' && value > 0) {
        safeUpdates[key] = value;
      }
    }
    
    // Upsert config
    const config = await prisma.messageAgentConfig.upsert({
      where: { accountId },
      update: {
        ...safeUpdates,
        updatedAt: new Date(),
      },
      create: {
        accountId,
        inactiveDays: safeUpdates.inactiveDays ?? 7,
        refreshOldDays: safeUpdates.refreshOldDays ?? 7,
        forceFullCheckHours: safeUpdates.forceFullCheckHours ?? 24,
        scanIntervalMinutes: safeUpdates.scanIntervalMinutes ?? 15,
      },
    });
    
    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error('PATCH config error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
