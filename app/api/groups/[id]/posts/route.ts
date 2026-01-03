import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - List posts for a group with filters
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: groupId } = await params;
    const { searchParams } = new URL(request.url);
    
    const hasContent = searchParams.get('hasContent');
    const isLead = searchParams.get('isLead');
    const limit = parseInt(searchParams.get('limit') || '100');
    
    const where: Record<string, unknown> = { groupId };
    
    if (hasContent === 'true') where.hasContent = true;
    if (hasContent === 'false') where.hasContent = false;
    if (isLead === 'true') where.isLead = true;
    if (isLead === 'false') where.isLead = false;
    
    const posts = await prisma.groupPost.findMany({
      where,
      take: limit,
      orderBy: { scrapedAt: 'desc' },
      select: {
        id: true,
        postUrl: true,
        authorName: true,
        postText: true,
        hasContent: true,
        isLead: true,
        intentScore: true,
        matchedService: true,
        scrapedAt: true,
      },
    });
    
    const stats = await prisma.groupPost.groupBy({
      by: ['hasContent', 'isLead'],
      where: { groupId },
      _count: true,
    });
    
    return NextResponse.json({ 
      posts,
      stats,
      total: posts.length,
    });
  } catch (error) {
    console.error('Error fetching posts:', error);
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
}

// DELETE - Bulk delete posts with filters
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: groupId } = await params;
    const { searchParams } = new URL(request.url);
    
    const filter = searchParams.get('filter');
    
    // Safety check - require a specific filter
    if (!filter) {
      return NextResponse.json({ 
        error: 'Filter required. Use: unused, no-content, not-leads, or all' 
      }, { status: 400 });
    }
    
    let where: Record<string, unknown> = { groupId };
    let description = '';
    
    switch (filter) {
      case 'unused':
        // Posts without content AND not converted to leads
        where = {
          groupId,
          hasContent: false,
          leadId: null,
        };
        description = 'posts without content and not leads';
        break;
        
      case 'no-content':
        // Posts that never had content extracted
        where = {
          groupId,
          hasContent: false,
        };
        description = 'posts without content';
        break;
        
      case 'not-leads':
        // Posts analyzed but not leads
        where = {
          groupId,
          isLead: false,
        };
        description = 'posts analyzed as not leads';
        break;
        
      case 'all':
        // All posts for this group
        where = { groupId };
        description = 'all posts';
        break;
        
      default:
        return NextResponse.json({ 
          error: 'Invalid filter. Use: unused, no-content, not-leads, or all' 
        }, { status: 400 });
    }
    
    const result = await prisma.groupPost.deleteMany({ where });
    
    // Get remaining post count for reference
    const remainingCount = await prisma.groupPost.count({ where: { groupId } });
    
    return NextResponse.json({ 
      success: true,
      deleted: result.count,
      description: `Deleted ${result.count} ${description}`,
      remainingPosts: remainingCount,
    });
  } catch (error) {
    console.error('Error deleting posts:', error);
    return NextResponse.json({ error: 'Failed to delete posts' }, { status: 500 });
  }
}
