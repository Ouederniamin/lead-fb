import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAzure } from "@ai-sdk/azure";
import { generateText } from "ai";
import fs from "fs";
import path from "path";

// Load business and services data
function loadBusinessData() {
  try {
    const businessPath = path.join(process.cwd(), "data", "business.json");
    if (fs.existsSync(businessPath)) {
      return JSON.parse(fs.readFileSync(businessPath, "utf-8"));
    }
  } catch {
    console.error("Failed to load business data");
  }
  return null;
}

function loadServicesData() {
  try {
    const servicesPath = path.join(process.cwd(), "data", "services.json");
    if (fs.existsSync(servicesPath)) {
      return JSON.parse(fs.readFileSync(servicesPath, "utf-8"));
    }
  } catch {
    console.error("Failed to load services data");
  }
  return [];
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { postText } = await request.json();

    if (!postText || typeof postText !== "string") {
      return NextResponse.json(
        { error: "Post text is required" },
        { status: 400 }
      );
    }

    // Check Azure OpenAI configuration
    const resourceName = process.env.AZURE_OPENAI_RESOURCE_NAME;
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o-mini";

    if (!resourceName || !apiKey) {
      return NextResponse.json(
        { error: "Azure OpenAI not configured. Please set AZURE_OPENAI_RESOURCE_NAME and AZURE_OPENAI_API_KEY in .env.local" },
        { status: 500 }
      );
    }

    // Create Azure OpenAI provider
    const azure = createAzure({
      resourceName,
      apiKey,
    });

    // Load business and services data
    const business = loadBusinessData();
    const services = loadServicesData();

    // Build context from business and services
    let businessContext = "";
    if (business) {
      businessContext = `
Business Information:
- Name: ${business.name || "Not set"}
- Location: ${business.location || "Not set"}
- WhatsApp: ${business.whatsapp || "Not set"}
- Services: ${business.usps?.join(", ") || "General services"}
- Target Audience: ${business.targetAudience || "General"}
- Languages: ${business.languages?.join(", ") || "Italian"}
`;
    }

    let servicesContext = "";
    if (services.length > 0) {
      const activeServices = services.filter((s: { isActive: boolean }) => s.isActive);
      servicesContext = `
Available Services:
${activeServices.map((s: { name: string; keywords: string[]; priceRange?: string }) => 
  `- ${s.name}: Keywords [${s.keywords.join(", ")}], Price: ${s.priceRange || "Varies"}`
).join("\n")}
`;
    }

    const systemPrompt = `You are an AI assistant that analyzes Facebook group posts to identify potential customers for a local service business.

${businessContext}
${servicesContext}

Analyze the post and return a JSON object with:
- intent_score: 1-5 (5 = very likely to need our services immediately)
- need_type: Type of service needed (e.g., "plumbing", "electrical", "general handyman")
- urgency: 1-5 (5 = emergency/immediate need)
- budget_signals: Array of phrases indicating budget (e.g., ["pago subito", "budget non è un problema"])
- suggested_response: A friendly, helpful Italian response that offers help and includes WhatsApp contact if appropriate
- reasoning: Brief explanation of why you scored it this way
- matched_services: Array of service names from our list that match this need

Be conservative with high scores - only give 5 for urgent, clear service needs.
Respond ONLY with valid JSON, no markdown or extra text.`;

    const { text } = await generateText({
      model: azure(deployment),
      system: systemPrompt,
      prompt: `Analyze this Facebook post:\n\n${postText}`,
      temperature: 0.3,
    });
    
    if (!text) {
      return NextResponse.json(
        { error: "No response from AI" },
        { status: 500 }
      );
    }

    // Parse the JSON response
    try {
      // Clean the response - remove markdown code blocks if present
      let cleanContent = text.trim();
      if (cleanContent.startsWith("```json")) {
        cleanContent = cleanContent.slice(7);
      } else if (cleanContent.startsWith("```")) {
        cleanContent = cleanContent.slice(3);
      }
      if (cleanContent.endsWith("```")) {
        cleanContent = cleanContent.slice(0, -3);
      }
      cleanContent = cleanContent.trim();

      const analysis = JSON.parse(cleanContent);
      return NextResponse.json(analysis);
    } catch {
      console.error("Failed to parse AI response:", text);
      return NextResponse.json(
        { error: "Failed to parse AI response", raw: text },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("AI test error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
