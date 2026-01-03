import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

// GET - Get business profile with portfolio
export async function GET() {
  try {
    // Get or create business profile
    let business = await prisma.business.findFirst({
      include: {
        portfolio: {
          orderBy: [
            { featured: 'desc' },
            { createdAt: 'desc' }
          ]
        }
      }
    });

    if (!business) {
      // Create default business profile
      business = await prisma.business.create({
        data: {
          name: '',
          description: '',
          location: 'Tunisia',
          whatsapp: '',
          website: '',
          languages: ['English', 'French', 'Arabic'],
          targetAudience: '',
          uniqueSellingPoints: [],
        },
        include: {
          portfolio: true
        }
      });
    }

    // Transform to match frontend expected format
    const response = {
      business: {
        id: business.id,
        name: business.name,
        description: business.description,
        location: business.location,
        whatsapp: business.whatsapp,
        website: business.website,
        languages: business.languages,
        targetAudience: business.targetAudience,
        uniqueSellingPoints: business.uniqueSellingPoints,
        portfolio: business.portfolio.map(p => ({
          id: p.id,
          title: p.title,
          description: p.description,
          category: p.category,
          imageUrl: p.imageUrl,
          projectUrl: p.projectUrl,
          technologies: p.technologies,
          clientName: p.clientName,
          completedDate: p.completedDate,
          featured: p.featured,
        })),
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error loading business data:', error);
    return NextResponse.json({ error: 'Failed to load data' }, { status: 500 });
  }
}

// PUT - Update business profile (including portfolio)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { portfolio, ...businessData } = body;

    // Get existing business or create one
    let business = await prisma.business.findFirst();
    
    if (!business) {
      business = await prisma.business.create({
        data: {
          name: businessData.name || '',
          description: businessData.description || '',
          location: businessData.location || 'Tunisia',
          whatsapp: businessData.whatsapp || '',
          website: businessData.website || '',
          languages: businessData.languages || ['English', 'French', 'Arabic'],
          targetAudience: businessData.targetAudience || '',
          uniqueSellingPoints: businessData.uniqueSellingPoints || [],
        }
      });
    } else {
      // Update business profile
      business = await prisma.business.update({
        where: { id: business.id },
        data: {
          name: businessData.name ?? business.name,
          description: businessData.description ?? business.description,
          location: businessData.location ?? business.location,
          whatsapp: businessData.whatsapp ?? business.whatsapp,
          website: businessData.website ?? business.website,
          languages: businessData.languages ?? business.languages,
          targetAudience: businessData.targetAudience ?? business.targetAudience,
          uniqueSellingPoints: businessData.uniqueSellingPoints ?? business.uniqueSellingPoints,
        }
      });
    }

    // Handle portfolio updates if provided
    if (portfolio && Array.isArray(portfolio)) {
      // Get existing portfolio items
      const existingPortfolio = await prisma.portfolio.findMany({
        where: { businessId: business.id }
      });

      const existingIds = existingPortfolio.map(p => p.id);
      const newIds = portfolio.filter((p: { id?: string }) => p.id).map((p: { id: string }) => p.id);

      // Delete removed items
      const toDelete = existingIds.filter(id => !newIds.includes(id));
      if (toDelete.length > 0) {
        await prisma.portfolio.deleteMany({
          where: { id: { in: toDelete } }
        });
      }

      // Update or create portfolio items
      for (const item of portfolio) {
        if (item.id && existingIds.includes(item.id)) {
          // Update existing
          await prisma.portfolio.update({
            where: { id: item.id },
            data: {
              title: item.title,
              description: item.description || '',
              category: item.category || 'web',
              imageUrl: item.imageUrl || '',
              projectUrl: item.projectUrl || '',
              technologies: item.technologies || [],
              clientName: item.clientName || '',
              completedDate: item.completedDate || '',
              featured: item.featured || false,
            }
          });
        } else {
          // Create new
          await prisma.portfolio.create({
            data: {
              businessId: business.id,
              title: item.title,
              description: item.description || '',
              category: item.category || 'web',
              imageUrl: item.imageUrl || '',
              projectUrl: item.projectUrl || '',
              technologies: item.technologies || [],
              clientName: item.clientName || '',
              completedDate: item.completedDate || '',
              featured: item.featured || false,
            }
          });
        }
      }
    }

    // Fetch updated business with portfolio
    const updatedBusiness = await prisma.business.findUnique({
      where: { id: business.id },
      include: { portfolio: true }
    });

    return NextResponse.json({ 
      success: true, 
      business: {
        ...updatedBusiness,
        portfolio: updatedBusiness?.portfolio.map(p => ({
          id: p.id,
          title: p.title,
          description: p.description,
          category: p.category,
          imageUrl: p.imageUrl,
          projectUrl: p.projectUrl,
          technologies: p.technologies,
          clientName: p.clientName,
          completedDate: p.completedDate,
          featured: p.featured,
        }))
      }
    });
  } catch (error) {
    console.error('Error updating business:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}
