import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ContactStatus, ConversationStateEnum } from "@prisma/client";

// ============================================
// MESSAGE AGENT - Contact Management API
// GET /api/message-agent/contacts - List contacts
// GET /api/message-agent/contacts?name=xxx - Find by name
// PATCH /api/message-agent/contacts - Update contact
// DELETE /api/message-agent/contacts - Archive contact
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const name = searchParams.get('name');
    const id = searchParams.get('id');
    const status = searchParams.get('status');
    const state = searchParams.get('state');
    const limit = parseInt(searchParams.get('limit') || '50');
    
    if (!accountId) {
      return NextResponse.json({ error: 'accountId required' }, { status: 400 });
    }
    
    // Find by exact ID
    if (id) {
      const contact = await prisma.messengerContact.findUnique({
        where: { id },
      });
      return NextResponse.json({ contact });
    }
    
    // Find by name (like testing - partial match)
    if (name) {
      const contact = await prisma.messengerContact.findFirst({
        where: {
          accountId,
          contactName: {
            contains: name,
            mode: 'insensitive',
          },
        },
      });
      return NextResponse.json({ contact });
    }
    
    // List all with filters
    const where: any = { accountId };
    if (status && status !== 'all') where.status = status as ContactStatus;
    if (state) where.state = state as ConversationStateEnum;
    
    const contacts = await prisma.messengerContact.findMany({
      where,
      orderBy: { lastActivityAt: 'desc' },
      take: limit,
    });
    
    // Get summary stats
    const stats = {
      totalActive: await prisma.messengerContact.count({ 
        where: { accountId, status: ContactStatus.ACTIVE } 
      }),
      totalOld: await prisma.messengerContact.count({ 
        where: { accountId, status: ContactStatus.OLD } 
      }),
      needsReply: await prisma.messengerContact.count({ 
        where: { accountId, status: ContactStatus.ACTIVE, state: ConversationStateEnum.NEEDS_REPLY } 
      }),
      waiting: await prisma.messengerContact.count({ 
        where: { accountId, status: ContactStatus.ACTIVE, state: ConversationStateEnum.WAITING } 
      }),
      active: await prisma.messengerContact.count({ 
        where: { accountId, status: ContactStatus.ACTIVE, state: ConversationStateEnum.ACTIVE } 
      }),
      idle: await prisma.messengerContact.count({ 
        where: { accountId, status: ContactStatus.ACTIVE, state: ConversationStateEnum.IDLE } 
      }),
    };
    
    return NextResponse.json({ contacts, stats, count: contacts.length });
  } catch (error) {
    console.error('GET contacts error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, contactName, accountId, ...updates } = body;
    
    if (!id && !contactName) {
      return NextResponse.json({ error: 'id or contactName required' }, { status: 400 });
    }
    
    let contact;
    
    if (id) {
      contact = await prisma.messengerContact.update({
        where: { id },
        data: {
          ...updates,
          updatedAt: new Date(),
        },
      });
    } else if (contactName && accountId) {
      contact = await prisma.messengerContact.update({
        where: {
          accountId_contactName: { accountId, contactName },
        },
        data: {
          ...updates,
          updatedAt: new Date(),
        },
      });
    }
    
    return NextResponse.json({ success: true, contact });
  } catch (error) {
    console.error('PATCH contact error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const contactName = searchParams.get('contactName');
    const accountId = searchParams.get('accountId');
    const hardDelete = searchParams.get('hardDelete') === 'true';
    
    if (!id && !(contactName && accountId)) {
      return NextResponse.json({ error: 'id or (contactName + accountId) required' }, { status: 400 });
    }
    
    if (hardDelete) {
      // Actually delete from database
      if (id) {
        await prisma.messengerContact.delete({ where: { id } });
      } else {
        await prisma.messengerContact.delete({
          where: { accountId_contactName: { accountId: accountId!, contactName: contactName! } },
        });
      }
      return NextResponse.json({ success: true, action: 'deleted' });
    }
    
    // Soft delete - move to OLD
    const updateData = {
      status: ContactStatus.OLD,
      archivedAt: new Date(),
      archiveReason: 'manually-excluded',
    };
    
    if (id) {
      await prisma.messengerContact.update({ where: { id }, data: updateData });
    } else {
      await prisma.messengerContact.update({
        where: { accountId_contactName: { accountId: accountId!, contactName: contactName! } },
        data: updateData,
      });
    }
    
    return NextResponse.json({ success: true, action: 'archived' });
  } catch (error) {
    console.error('DELETE contact error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
