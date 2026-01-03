// API Route: Generate AI Comment
// POST /api/ai/comment

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAzure } from "@ai-sdk/azure";
import { generateText } from "ai";
import { prisma } from "@/lib/db";

// Language type
type Language = "fr" | "en" | "tn" | "ar";

// Get Azure client
function getAzureClient() {
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT || "";
  const resourceName = endpoint
    .replace("https://", "")
    .replace(".openai.azure.com", "")
    .replace(/\/$/, "");

  if (!apiKey || !resourceName) {
    throw new Error("Azure OpenAI not configured");
  }

  const azure = createAzure({ resourceName, apiKey });
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o-mini";
  return azure(deployment);
}

// Step 1: Fast language detection
async function detectLanguage(text: string): Promise<Language> {
  try {
    const model = getAzureClient();
    const { text: result } = await generateText({
      model,
      system: "You are a language detector. Return ONLY a 2-letter code: 'fr' for French, 'en' for English, 'tn' for Tunisian Arabic, 'ar' for Standard Arabic. Nothing else.",
      prompt: `Detect the language of this text and return ONLY the 2-letter code (fr/en/tn/ar):\n\n"${text}"`,
    });
    
    const lang = result.trim().toLowerCase();
    if (["fr", "en", "tn", "ar"].includes(lang)) {
      return lang as Language;
    }
    return "tn"; // Default to Tunisian
  } catch (error) {
    console.error("Language detection failed:", error);
    return "tn"; // Default fallback
  }
}

// Language-specific prompts
const PROMPTS: Record<Language, { system: string; examples: string[] }> = {
  fr: {
    system: `Tu écris un commentaire sur un post Facebook. Écris EN FRANÇAIS UNIQUEMENT.

Règles:
- 1-2 phrases courtes maximum
- Sois amical et naturel
- Mentionne que tu peux aider
- Demande d'envoyer un message privé
- Maximum 1 emoji
- PAS de prix
- PAS de spam`,
    examples: [
      "On peut vous aider avec ça 👍 Envoyez-moi un message",
      "On a de l'expérience dans ce domaine. Écrivez-moi en inbox?",
      "C'est notre spécialité. Contactez-moi en privé",
      "Je peux vous aider. Envoyez-moi un message pour en discuter",
    ],
  },
  en: {
    system: `You are writing a comment on a Facebook post. Write IN ENGLISH ONLY.

Rules:
- 1-2 short sentences maximum
- Be friendly and natural
- Mention you can help
- Ask them to send a private message
- Maximum 1 emoji
- NO prices
- NO spam vibes`,
    examples: [
      "We can help with this 👍 Send me a message",
      "We have experience in this field. DM me for details?",
      "This is our specialty. Message me!",
      "I can help you with this. Send me a message to discuss",
    ],
  },
  tn: {
    system: `انت تكتب تعليق على بوست فيسبوك. اكتب بالدارجة التونسية فقط.

القواعد:
- جملة أو زوز كافي
- كون طبيعي وودود
- قول انك تنجم تعاون
- اطلب منه يراسلك في inbox
- emoji واحد كافي
- ما تذكرش أسعار
- ما تبانش سبام`,
    examples: [
      "نجمو نعاونوك في هذا 👍 ابعثلي message",
      "عندنا خبرة في هذا المجال. ابعثلي inbox نحكيو",
      "باهي، هذا مجالنا. كلمني",
      "نخدموا في هذا. ابعثلي رسالة نعطيك تفاصيل",
    ],
  },
  ar: {
    system: `أنت تكتب تعليقاً على منشور فيسبوك. اكتب بالعربية الفصحى فقط.

القواعد:
- جملة أو جملتين فقط
- كن ودوداً وطبيعياً
- اذكر أنك تستطيع المساعدة
- اطلب منه إرسال رسالة خاصة
- إيموجي واحد كافي
- لا تذكر أسعار
- لا تبدو كسبام`,
    examples: [
      "نستطيع مساعدتك في هذا 👍 أرسل لي رسالة",
      "لدينا خبرة في هذا المجال. تواصل معي",
      "هذا تخصصنا. راسلني للتفاصيل",
    ],
  },
};

// Load all context from DB
async function loadFullContext() {
  const business = await prisma.business.findFirst({
    include: { portfolio: true }
  });
  const services = await prisma.service.findMany({
    where: { isActive: true }
  });
  return { business, services };
}

// Build context string for AI (language-aware)
function buildContextString(business: any, services: any[], lang: Language): string {
  let context = "";

  if (lang === "fr") {
    if (business) {
      context += `=== Notre Entreprise ===
Nom: ${business.name || "Creator Labs"}
Description: ${business.description || "Développement de logiciels"}
Localisation: ${business.location || "Tunisie"}
`;
    }
    if (services?.length > 0) {
      context += `\n=== Nos Services ===\n`;
      services.forEach((s, i) => {
        context += `${i + 1}. ${s.nameFrench || s.name}`;
        if (s.priceRange) context += ` (${s.priceRange})`;
        context += "\n";
      });
    }
  } else if (lang === "en") {
    if (business) {
      context += `=== Our Company ===
Name: ${business.name || "Creator Labs"}
Description: ${business.description || "Software development"}
Location: ${business.location || "Tunisia"}
`;
    }
    if (services?.length > 0) {
      context += `\n=== Our Services ===\n`;
      services.forEach((s, i) => {
        context += `${i + 1}. ${s.name}`;
        if (s.priceRange) context += ` (${s.priceRange})`;
        context += "\n";
      });
    }
  } else {
    // Arabic (tn or ar)
    if (business) {
      context += `=== معلومات الشركة ===
الاسم: ${business.name || "Creator Labs"}
الوصف: ${business.description || "تطوير برمجيات"}
الموقع: ${business.location || "تونس"}
`;
    }
    if (services?.length > 0) {
      context += `\n=== خدماتنا ===\n`;
      services.forEach((s, i) => {
        context += `${i + 1}. ${s.nameArabic || s.name}`;
        if (s.priceRange) context += ` (${s.priceRange})`;
        context += "\n";
      });
    }
  }

  return context;
}

// Load custom comment prompt from database
async function loadCommentPrompt(): Promise<string | null> {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: "ai_comment_prompt" }
    });
    return setting?.value || null;
  } catch (error) {
    console.error("Failed to load comment prompt from DB:", error);
    return null;
  }
}

// Save comment prompt to database
async function saveCommentPrompt(prompt: string): Promise<boolean> {
  try {
    await prisma.setting.upsert({
      where: { key: "ai_comment_prompt" },
      update: { value: prompt },
      create: { key: "ai_comment_prompt", value: prompt }
    });
    return true;
  } catch (error) {
    console.error("Failed to save comment prompt to DB:", error);
    return false;
  }
}

// Delete comment prompt from database
async function deleteCommentPrompt(): Promise<boolean> {
  try {
    await prisma.setting.deleteMany({
      where: { key: "ai_comment_prompt" }
    });
    return true;
  } catch (error) {
    console.error("Failed to delete comment prompt from DB:", error);
    return false;
  }
}

// Default prompt for display (backwards compatibility)
function getDefaultCommentPrompt(context: string): string {
  return `انت تكتب تعليق على منشور في مجموعة فيسبوك.
اكتب بنفس لغة المنشور (تونسي، فرنسي، انجليزي، أو عربي فصيح).

${context}

القواعد:
- جملة أو زوز كافي
- كون طبيعي وودود
- اذكر انك تنجم تعاون
- اطلب منه يراسلك في inbox
- emoji واحد كافي
- ما تذكرش أسعار`;
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { business, services } = await loadFullContext();
    const context = buildContextString(business, services, "tn");
    const customPrompt = await loadCommentPrompt();
    const defaultPrompt = getDefaultCommentPrompt(context);

    return NextResponse.json({
      success: true,
      defaultPrompt,
      customPrompt,
      context,
      businessName: business?.name || "Creator Labs",
      servicesCount: services.length,
    });
  } catch (error) {
    console.error("Error loading comment config:", error);
    return NextResponse.json({ error: "Failed to load config" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, postText, matchedService, customPrompt } = body;

    // Handle save prompt action
    if (action === "savePrompt") {
      const saved = await saveCommentPrompt(customPrompt);
      return NextResponse.json({ success: saved });
    }

    // Handle reset prompt action
    if (action === "resetPrompt") {
      const deleted = await deleteCommentPrompt();
      return NextResponse.json({ success: deleted });
    }

    // Handle generate comment action
    if (action === "generate" || !action) {
      if (!postText) {
        return NextResponse.json({ error: "postText is required" }, { status: 400 });
      }

      // Step 1: Detect language
      const detectedLang = await detectLanguage(postText);
      console.log(`[Comment] Detected language: ${detectedLang} for post: "${postText.substring(0, 50)}..."`);

      // Step 2: Get language-specific prompt
      const langPrompt = PROMPTS[detectedLang];
      const { business, services } = await loadFullContext();
      const context = buildContextString(business, services, detectedLang);

      // Build the system prompt
      const systemPrompt = `${langPrompt.system}

${context}

Examples of good comments:
${langPrompt.examples.map(e => `- "${e}"`).join("\n")}`;

      // Build user prompt based on language
      let userPrompt = "";
      if (detectedLang === "fr") {
        userPrompt = `Post à commenter:\n"${postText}"\n${matchedService ? `\nService demandé: ${matchedService}` : ""}\n\nÉcris un commentaire court en français:`;
      } else if (detectedLang === "en") {
        userPrompt = `Post to comment on:\n"${postText}"\n${matchedService ? `\nRequested service: ${matchedService}` : ""}\n\nWrite a short comment in English:`;
      } else {
        userPrompt = `المنشور:\n"${postText}"\n${matchedService ? `\nالخدمة المطلوبة: ${matchedService}` : ""}\n\nاكتب تعليق قصير:`;
      }

      // Step 3: Generate comment
      const model = getAzureClient();
      const { text } = await generateText({
        model,
        system: systemPrompt,
        prompt: userPrompt,
      });

      return NextResponse.json({
        success: true,
        comment: text.trim(),
        detectedLanguage: detectedLang,
        promptUsed: systemPrompt,
        postContext: postText.substring(0, 100),
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error generating comment:", error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Failed to generate comment" 
    }, { status: 500 });
  }
}
