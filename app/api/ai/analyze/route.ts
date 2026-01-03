import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { model } from "@/lib/ai";
import { LeadAnalysisSchema } from "@/lib/schemas";
import fs from 'fs/promises';
import path from 'path';

const SETTINGS_FILE = path.join(process.cwd(), 'data', 'settings.json');
const BUSINESS_FILE = path.join(process.cwd(), 'data', 'business.json');

interface Service {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  priceRange: string;
  responseTemplate: string;
  isActive: boolean;
}

interface BusinessProfile {
  name: string;
  description: string;
  location: string;
  whatsapp: string;
  website: string;
  languages: string[];
  targetAudience: string;
  uniqueSellingPoints: string[];
}

async function getAISettings() {
  try {
    const data = await fs.readFile(SETTINGS_FILE, 'utf-8');
    const settings = JSON.parse(data);
    return settings.ai;
  } catch {
    return null;
  }
}

async function getBusinessData(): Promise<{ business: BusinessProfile; services: Service[] }> {
  try {
    const data = await fs.readFile(BUSINESS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {
      business: {
        name: '',
        description: '',
        location: '',
        whatsapp: '',
        website: '',
        languages: [],
        targetAudience: '',
        uniqueSellingPoints: [],
      },
      services: [],
    };
  }
}

function matchServicesToPost(postText: string, services: Service[]): Service[] {
  const lowerPost = postText.toLowerCase();
  const matchedServices: Service[] = [];

  for (const service of services) {
    if (!service.isActive) continue;

    // Check if any keyword matches
    const hasMatch = service.keywords.some(keyword => 
      lowerPost.includes(keyword.toLowerCase())
    );

    // Also check service name
    const nameMatch = lowerPost.includes(service.name.toLowerCase());

    if (hasMatch || nameMatch) {
      matchedServices.push(service);
    }
  }

  return matchedServices;
}

// POST /api/ai/analyze - Analyze a post with AI
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { postText, authorName, groupName } = body;

    if (!postText) {
      return NextResponse.json(
        { error: "postText is required" },
        { status: 400 }
      );
    }

    // Load settings and business data
    const [aiSettings, businessData] = await Promise.all([
      getAISettings(),
      getBusinessData(),
    ]);

    const { business, services } = businessData;
    const whatsappNumber = business.whatsapp || aiSettings?.whatsappNumber || process.env.WHATSAPP_NUMBER || "+XXX";
    
    // Match services to the post content
    const matchedServices = matchServicesToPost(postText, services);
    
    // Build service context
    const activeServices = services.filter(s => s.isActive);
    const servicesContext = activeServices.length > 0
      ? `Our Services:\n${activeServices.map(s => 
          `- ${s.name}: ${s.description || 'N/A'} (Keywords: ${s.keywords.join(', ') || 'none'})`
        ).join('\n')}`
      : '';

    const matchedServicesContext = matchedServices.length > 0
      ? `\n\nMATCHED SERVICES (post contains keywords from these):\n${matchedServices.map(s => 
          `- ${s.name} ${s.priceRange ? `(${s.priceRange})` : ''}`
        ).join('\n')}`
      : '\n\nNo services matched the post keywords.';

    // Build business context
    const businessContext = business.name ? `
ABOUT OUR BUSINESS:
- Company: ${business.name}
- Description: ${business.description || 'N/A'}
- Location: ${business.location || 'N/A'}
- Languages: ${business.languages.join(', ') || 'Not specified'}
- Target Audience: ${business.targetAudience || 'N/A'}
- Unique Selling Points: ${business.uniqueSellingPoints.join('; ') || 'N/A'}
- Website: ${business.website || 'N/A'}
- WhatsApp: ${whatsappNumber}

${servicesContext}
` : '';

    // Use custom system prompt if available
    const customSystemPrompt = aiSettings?.systemPrompt || '';

    const defaultPrompt = `You are a business development expert helping to identify leads.
${businessContext}
Analyze this Facebook group post and determine if it's a potential lead for our services.

Group: ${groupName || "Unknown"}
Post Author: ${authorName || "Unknown"}
Post Content: "${postText}"
${matchedServicesContext}

Instructions:
1. Identify what service they need (match to our services if possible)
2. Rate urgency from 1-5 (1=casual inquiry, 5=desperate/immediate need)
3. Note any budget mentions
4. List key requirements from the post
5. Determine overall sentiment
6. Calculate intent score (1-5):
   - 5: Clear need + urgency + matches our services + budget mentioned
   - 4: Clear need + matches our services + (urgency OR budget)
   - 3: Clear need, may match our services
   - 2: Vague interest or doesn't match our services well
   - 1: Not a lead (meme, off-topic, already resolved, unrelated to our services)
7. Generate a friendly, professional response that:
   - Addresses them by name if available
   - Acknowledges their specific need
   - Briefly mentions relevant experience from our business
   - Ends with an invitation to WhatsApp: ${whatsappNumber}
   - Sounds natural and helpful, NOT salesy
   - Use appropriate language based on the post language

IMPORTANT: If this doesn't match any of our services OR is not a real lead (random post, meme, already has solution), set isLead to false and intentScore to 1.`;

    const systemContext = customSystemPrompt 
      ? `${customSystemPrompt}\n\n`
      : '';

    const prompt = `${systemContext}${defaultPrompt}`;

    const result = await generateObject({
      model,
      schema: LeadAnalysisSchema,
      prompt,
    });

    // Add matched services to the response
    const response = {
      ...result.object,
      matchedServices: matchedServices.map(s => s.name),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("AI analysis error:", error);
    return NextResponse.json(
      { error: "Failed to analyze post" },
      { status: 500 }
    );
  }
}
