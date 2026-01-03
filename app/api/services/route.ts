import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

// GET - List all services
export async function GET() {
  try {
    const services = await prisma.service.findMany({
      orderBy: { createdAt: 'desc' }
    });

    // Transform to match frontend expected format
    const transformedServices = services.map(s => ({
      id: s.id,
      name: s.name,
      nameFrench: s.nameFrench,
      nameArabic: s.nameArabic,
      description: s.description,
      descriptionFrench: s.descriptionFrench,
      descriptionArabic: s.descriptionArabic,
      category: s.category,
      keywords: s.keywords,
      keywordsArabic: s.keywordsArabic,
      priceRange: s.priceRange,
      priceMin: s.priceMin,
      priceMax: s.priceMax,
      currency: s.currency,
      deliveryTime: s.deliveryTime,
      features: s.features,
      targetAudience: s.targetAudience,
      responseTemplate: s.responseTemplate,
      qualifyingQuestions: s.qualifyingQuestions,
      objectionHandlers: s.objectionHandlers as { objection: string; response: string }[],
      isActive: s.isActive,
    }));

    return NextResponse.json({ services: transformedServices });
  } catch (error) {
    console.error('Error loading services:', error);
    return NextResponse.json({ error: 'Failed to load services' }, { status: 500 });
  }
}

// POST - Create new service
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      name, 
      nameFrench,
      nameArabic,
      description, 
      descriptionFrench,
      descriptionArabic,
      category,
      keywords, 
      keywordsArabic,
      priceRange, 
      priceMin,
      priceMax,
      currency,
      deliveryTime,
      features,
      targetAudience,
      responseTemplate,
      qualifyingQuestions,
      objectionHandlers,
    } = body;

    if (!name) {
      return NextResponse.json({ error: 'Service name is required' }, { status: 400 });
    }

    const newService = await prisma.service.create({
      data: {
        name,
        nameFrench: nameFrench || '',
        nameArabic: nameArabic || '',
        description: description || '',
        descriptionFrench: descriptionFrench || '',
        descriptionArabic: descriptionArabic || '',
        category: category || 'other',
        keywords: keywords || [],
        keywordsArabic: keywordsArabic || [],
        priceRange: priceRange || '',
        priceMin: priceMin || 0,
        priceMax: priceMax || 0,
        currency: currency || 'TND',
        deliveryTime: deliveryTime || '',
        features: features || [],
        targetAudience: targetAudience || '',
        responseTemplate: responseTemplate || '',
        qualifyingQuestions: qualifyingQuestions || [],
        objectionHandlers: objectionHandlers || [],
        isActive: true,
      }
    });

    return NextResponse.json({ 
      success: true, 
      service: {
        ...newService,
        objectionHandlers: newService.objectionHandlers as { objection: string; response: string }[],
      }
    });
  } catch (error) {
    console.error('Error creating service:', error);
    return NextResponse.json({ error: 'Failed to create service' }, { status: 500 });
  }
}

// PUT - Update service
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Service ID is required' }, { status: 400 });
    }

    const existingService = await prisma.service.findUnique({
      where: { id }
    });
    
    if (!existingService) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    const updatedService = await prisma.service.update({
      where: { id },
      data: {
        name: updates.name ?? existingService.name,
        nameFrench: updates.nameFrench ?? existingService.nameFrench,
        nameArabic: updates.nameArabic ?? existingService.nameArabic,
        description: updates.description ?? existingService.description,
        descriptionFrench: updates.descriptionFrench ?? existingService.descriptionFrench,
        descriptionArabic: updates.descriptionArabic ?? existingService.descriptionArabic,
        category: updates.category ?? existingService.category,
        keywords: updates.keywords ?? existingService.keywords,
        keywordsArabic: updates.keywordsArabic ?? existingService.keywordsArabic,
        priceRange: updates.priceRange ?? existingService.priceRange,
        priceMin: updates.priceMin ?? existingService.priceMin,
        priceMax: updates.priceMax ?? existingService.priceMax,
        currency: updates.currency ?? existingService.currency,
        deliveryTime: updates.deliveryTime ?? existingService.deliveryTime,
        features: updates.features ?? existingService.features,
        targetAudience: updates.targetAudience ?? existingService.targetAudience,
        responseTemplate: updates.responseTemplate ?? existingService.responseTemplate,
        qualifyingQuestions: updates.qualifyingQuestions ?? existingService.qualifyingQuestions,
        objectionHandlers: updates.objectionHandlers ?? existingService.objectionHandlers,
        isActive: updates.isActive ?? existingService.isActive,
      }
    });

    return NextResponse.json({ 
      success: true, 
      service: {
        ...updatedService,
        objectionHandlers: updatedService.objectionHandlers as { objection: string; response: string }[],
      }
    });
  } catch (error) {
    console.error('Error updating service:', error);
    return NextResponse.json({ error: 'Failed to update service' }, { status: 500 });
  }
}

// DELETE - Remove service
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Service ID is required' }, { status: 400 });
    }

    const existingService = await prisma.service.findUnique({
      where: { id }
    });
    
    if (!existingService) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    await prisma.service.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting service:', error);
    return NextResponse.json({ error: 'Failed to delete service' }, { status: 500 });
  }
}
