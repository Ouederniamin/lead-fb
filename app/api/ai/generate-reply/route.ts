import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { model } from "@/lib/ai";
import { z } from "zod";
import fs from 'fs/promises';
import path from 'path';

const BUSINESS_FILE = path.join(process.cwd(), 'data', 'business.json');

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

interface Service {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  priceRange: string;
  responseTemplate: string;
  isActive: boolean;
}

interface Message {
  sender: 'them' | 'us' | 'unknown';
  text: string;
}

const ReplySchema = z.object({
  reply: z.string().describe("The reply message to send"),
  intent: z.enum(['greeting', 'qualify', 'propose', 'close', 'follow_up', 'objection_handling']).describe("The intent of this reply"),
  reasoning: z.string().describe("Why this reply was chosen"),
  suggestedNextStep: z.string().describe("What to do if they respond positively"),
  shouldAskForWhatsApp: z.boolean().describe("Whether to ask for WhatsApp contact"),
});

async function getBusinessData(): Promise<{ business: BusinessProfile; services: Service[] }> {
  try {
    const data = await fs.readFile(BUSINESS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {
      business: {
        name: 'Our Business',
        description: 'We provide professional services',
        location: 'Tunisia',
        whatsapp: '',
        website: '',
        languages: ['French', 'Arabic'],
        targetAudience: '',
        uniqueSellingPoints: [],
      },
      services: [],
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      conversationHistory, 
      leadContext,
      contactName,
    } = body;

    if (!conversationHistory || !Array.isArray(conversationHistory)) {
      return NextResponse.json(
        { error: "conversationHistory array is required" },
        { status: 400 }
      );
    }

    // Load business data
    const { business, services } = await getBusinessData();
    const activeServices = services.filter(s => s.isActive);

    // Format conversation for the prompt
    const formattedConversation = conversationHistory.map((msg: Message) => {
      const sender = msg.sender === 'us' ? 'Us' : (msg.sender === 'them' ? 'Lead' : 'Unknown');
      return `${sender}: ${msg.text}`;
    }).join('\n');

    // Determine conversation stage
    const ourMessageCount = conversationHistory.filter((m: Message) => m.sender === 'us').length;
    const theirMessageCount = conversationHistory.filter((m: Message) => m.sender === 'them').length;
    
    let conversationStage = 'initial';
    if (ourMessageCount === 0) {
      conversationStage = 'first_message';
    } else if (theirMessageCount === 0) {
      conversationStage = 'awaiting_response';
    } else if (ourMessageCount >= 2 && theirMessageCount >= 2) {
      conversationStage = 'engaged';
    } else {
      conversationStage = 'building_rapport';
    }

    const systemPrompt = `You are a helpful sales assistant for ${business.name}.

BUSINESS INFO:
- Name: ${business.name}
- Description: ${business.description}
- Location: ${business.location}
- WhatsApp: ${business.whatsapp || 'Not provided'}
- Unique Selling Points: ${business.uniqueSellingPoints.join(', ') || 'Professional service, Quality work'}

SERVICES WE OFFER:
${activeServices.map(s => `- ${s.name}: ${s.description} (${s.priceRange})`).join('\n') || '- Professional services at competitive prices'}

CONVERSATION STAGE: ${conversationStage}

GUIDELINES:
1. Be friendly and conversational, not salesy
2. Write in the same language the lead uses (French, Arabic, or English)
3. Keep messages SHORT (2-3 sentences max)
4. Ask qualifying questions to understand their needs
5. If they seem interested, suggest moving to WhatsApp for faster communication
6. Never be pushy or aggressive
7. Use appropriate emojis sparingly (1-2 max)
8. If they have objections, address them empathetically
9. Always end with a question or call-to-action

IMPORTANT:
- Match the lead's communication style and language
- If this is a follow-up to no response, be gentle and not pushy
- Focus on how we can help THEM, not on selling`;

    const userPrompt = `Contact Name: ${contactName || 'Lead'}

${leadContext?.postText ? `ORIGINAL POST/NEED:\n${leadContext.postText}\n` : ''}
${leadContext?.services ? `MATCHED SERVICES: ${leadContext.services.join(', ')}\n` : ''}

CONVERSATION SO FAR:
${formattedConversation || '(No messages yet - this would be our first message)'}

---
Generate the next reply we should send. Be natural and conversational.`;

    const result = await generateObject({
      model,
      schema: ReplySchema,
      system: systemPrompt,
      prompt: userPrompt,
    });

    return NextResponse.json({
      success: true,
      reply: result.object.reply,
      intent: result.object.intent,
      reasoning: result.object.reasoning,
      suggestedNextStep: result.object.suggestedNextStep,
      shouldAskForWhatsApp: result.object.shouldAskForWhatsApp,
      conversationStage,
      debug: {
        businessName: business.name,
        servicesCount: activeServices.length,
        messagesAnalyzed: conversationHistory.length,
      }
    });

  } catch (error) {
    console.error("Generate reply error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate reply" },
      { status: 500 }
    );
  }
}
