import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

// GET /api/groups/[id] - Get a single group
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        _count: {
          select: { leads: true },
        },
      },
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    return NextResponse.json(group);
  } catch (error) {
    console.error('Failed to fetch group:', error);
    return NextResponse.json({ error: 'Failed to fetch group' }, { status: 500 });
  }
}

// PUT /api/groups/[id] - Update a group
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const body = await request.json();
    
    const group = await prisma.group.update({
      where: { id },
      data: {
        name: body.name,
        url: body.url,
        isActive: body.isActive,
        assignedAgentId: body.assignedAgentId || null,
        assignedAccountId: body.assignedAccountId || null,
      },
      include: {
        assignedAccount: {
          select: { id: true, email: true, name: true },
        },
        _count: {
          select: { leads: true, posts: true },
        },
      },
    });

    return NextResponse.json(group);
  } catch (error) {
    console.error('Failed to update group:', error);
    return NextResponse.json({ error: 'Failed to update group' }, { status: 500 });
  }
}

// DELETE /api/groups/[id] - Delete a group
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    await prisma.group.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete group:', error);
    return NextResponse.json({ error: 'Failed to delete group' }, { status: 500 });
  }
}
