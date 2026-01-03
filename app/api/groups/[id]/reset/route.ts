import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/groups/[id]/reset - Reset a group's initialization status
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: groupId } = await params;
    
    // Verify group exists
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true, name: true },
    });
    
    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }
    
    // Start a transaction to ensure all operations complete together
    const result = await prisma.$transaction(async (tx) => {
      // 1. Delete all leads that came from posts in this group
      //    First get all posts to find linked leads
      const posts = await tx.groupPost.findMany({
        where: { groupId },
        select: { leadId: true },
      });
      
      const leadIds = posts
        .map(p => p.leadId)
        .filter((id): id is string => id !== null);
      
      // Delete leads linked to these posts
      const deletedLeads = await tx.lead.deleteMany({
        where: { id: { in: leadIds } },
      });
      
      // 2. Delete all posts from this group
      const deletedPosts = await tx.groupPost.deleteMany({
        where: { groupId },
      });
      
      // 3. Reset group initialization status and stats
      const updatedGroup = await tx.group.update({
        where: { id: groupId },
        data: {
          isInitialized: false,
          initializedAt: null,
          lastScrapedAt: null,
          lastScrapedPostId: null,
          lastScraped: null,
          totalPosts: 0,
          totalLeads: 0,
          scrapesToday: 0,
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
      
      return {
        group: updatedGroup,
        deletedPosts: deletedPosts.count,
        deletedLeads: deletedLeads.count,
      };
    });
    
    return NextResponse.json({
      success: true,
      message: `Reset complete. Deleted ${result.deletedPosts} posts and ${result.deletedLeads} leads.`,
      deletedPosts: result.deletedPosts,
      deletedLeads: result.deletedLeads,
      group: {
        ...result.group,
        leadsCount: result.group._count.leads,
        postsCount: result.group._count.posts,
      },
    });
  } catch (error) {
    console.error('Error resetting group:', error);
    return NextResponse.json({ error: 'Failed to reset group' }, { status: 500 });
  }
}
