// API Route: Generate AI First DM
// POST /api/ai/first-dm

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

// Language-specific prompts for First DM
const PROMPTS: Record<Language, { system: string; examples: string[] }> = {
  fr: {
    system: `Tu écris le premier message privé à quelqu'un qui a posté une demande dans un groupe Facebook. Écris EN FRANÇAIS UNIQUEMENT.

Règles:
- Commence par "Bonjour" ou "Salut"
- Mentionne que tu as vu son post dans le groupe
- Présente-toi brièvement
- Pose UNE question sur son projet
- 2-3 phrases maximum
- PAS d'emojis
- PAS de prix
- PAS de spam`,
    examples: [
      "Bonjour! J'ai vu votre demande dans le groupe. On travaille dans ce domaine. C'est quoi exactement votre besoin?",
      "Salut! J'ai vu votre post. On a de l'expérience là-dedans. On peut en discuter?",
      "Bonjour! J'ai vu que vous cherchez un développeur. On fait ça. Comment je peux vous aider?",
    ],
  },
  en: {
    system: `You are writing the first private message to someone who posted a request in a Facebook group. Write IN ENGLISH ONLY.

Rules:
- Start with "Hi" or "Hello"
- Mention you saw their post in the group
- Briefly introduce yourself
- Ask ONE question about their project
- 2-3 sentences maximum
- NO emojis
- NO prices
- NO spam vibes`,
    examples: [
      "Hi! I saw your request in the group. We work in this field. What exactly do you need?",
      "Hello! I noticed your post. We have experience with this. Can we discuss the details?",
      "Hi! I saw you're looking for a developer. We do that. How can I help you?",
    ],
  },
  tn: {
    system: `انت تكتب أول رسالة خاصة لشخص نشر طلب في مجموعة فيسبوك. اكتب بالدارجة التونسية فقط.

القواعد:
- ابدأ بـ "عسلامة" أو "أهلا"
- قول انك شفت طلبه في المجموعة
- قدم روحك باختصار
- اسأله سؤال واحد على المشروع
- 2-3 جمل كافي
- ما تستعملش emoji
- ما تذكرش أسعار
- ما تبانش سبام`,
    examples: [
      "عسلامة! شفت طلبك في المجموعة. نخدموا في هذا المجال. آش بالضبط تحتاج?",
      "أهلا! شفت اللي حطيت في الڨروب. عندنا خبرة في هذا. نجمو نحكيو?",
      "عسلامة! شفت طلبك. نخدم في هذا المجال. كيفاش نجم نعاونك?",
    ],
  },
  ar: {
    system: `أنت تكتب أول رسالة خاصة لشخص نشر طلباً في مجموعة فيسبوك. اكتب بالعربية الفصحى فقط.

القواعد:
- ابدأ بـ "مرحبا" أو "السلام عليكم"
- اذكر أنك رأيت طلبه في المجموعة
- قدم نفسك باختصار
- اسأله سؤالاً واحداً عن المشروع
- 2-3 جمل فقط
- لا تستخدم إيموجي
- لا تذكر أسعار
- لا تبدو كسبام`,
    examples: [
      "مرحبا! رأيت طلبك في المجموعة. نعمل في هذا المجال. ما الذي تحتاجه بالضبط?",
      "السلام عليكم! لاحظت منشورك. لدينا خبرة في هذا. هل يمكننا مناقشة التفاصيل?",
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

// Get display name from full name
function getDisplayName(fullName: string): string {
  if (!fullName) return "";
  const parts = fullName.split(" ");
  return parts[0] || fullName;
}

// Load custom first DM prompt from database
async function loadFirstDMPrompt(): Promise<string | null> {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: "ai_first_dm_prompt" }
    });
    return setting?.value || null;
  } catch (error) {
    console.error("Failed to load first DM prompt from DB:", error);
    return null;
  }
}

// Save first DM prompt to database
async function saveFirstDMPrompt(prompt: string): Promise<boolean> {
  try {
    await prisma.setting.upsert({
      where: { key: "ai_first_dm_prompt" },
      update: { value: prompt },
      create: { key: "ai_first_dm_prompt", value: prompt }
    });
    return true;
  } catch (error) {
    console.error("Failed to save first DM prompt to DB:", error);
    return false;
  }
}

// Delete first DM prompt from database
async function deleteFirstDMPrompt(): Promise<boolean> {
  try {
    await prisma.setting.deleteMany({
      where: { key: "ai_first_dm_prompt" }
    });
    return true;
  } catch (error) {
    console.error("Failed to delete first DM prompt from DB:", error);
    return false;
  }
}

// Default prompt for display (backwards compatibility)
function getDefaultFirstDMPrompt(context: string): string {
  return `انت تكتب أول رسالة خاصة لشخص نشر طلب في مجموعة فيسبوك.
اكتب بنفس لغة المنشور (تونسي، فرنسي، انجليزي، أو عربي فصيح).

${context}

القواعد:
- ابدأ بتحية مناسبة
- قول انك شفت طلبه في المجموعة
- قدم روحك باختصار
- اسأله سؤال واحد على المشروع
- 2-3 جمل كافي
- ما تستعملش emoji`;
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { business, services } = await loadFullContext();
    const context = buildContextString(business, services, "tn");
    const customPrompt = await loadFirstDMPrompt();
    const defaultPrompt = getDefaultFirstDMPrompt(context);

    return NextResponse.json({
      success: true,
      defaultPrompt,
      customPrompt,
      context,
      businessName: business?.name || "Creator Labs",
      servicesCount: services.length,
    });
  } catch (error) {
    console.error("Error loading first DM config:", error);
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
    const { action, authorName, postText, matchedService, customPrompt } = body;

    // Handle save prompt action
    if (action === "savePrompt") {
      const saved = await saveFirstDMPrompt(customPrompt);
      return NextResponse.json({ success: saved });
    }

    // Handle reset prompt action
    if (action === "resetPrompt") {
      const deleted = await deleteFirstDMPrompt();
      return NextResponse.json({ success: deleted });
    }

    // Handle generate first DM action
    if (action === "generate" || !action) {
      if (!postText) {
        return NextResponse.json({ error: "postText is required" }, { status: 400 });
      }

      // Step 1: Detect language
      const detectedLang = await detectLanguage(postText);
      console.log(`[First DM] Detected language: ${detectedLang} for post: "${postText.substring(0, 50)}..."`);

      // Step 2: Get language-specific prompt
      const langPrompt = PROMPTS[detectedLang];
      const { business, services } = await loadFullContext();
      const context = buildContextString(business, services, detectedLang);
      const displayName = getDisplayName(authorName || "");

      // Build the system prompt
      const systemPrompt = `${langPrompt.system}

${context}

Examples of good first messages:
${langPrompt.examples.map(e => `- "${e}"`).join("\n")}`;

      // Build user prompt based on language
      let userPrompt = "";
      if (detectedLang === "fr") {
        userPrompt = `Nom du client: ${displayName || "ami"}\n\nSon post dans le groupe:\n"${postText}"\n${matchedService ? `\nService demandé: ${matchedService}` : ""}\n\nÉcris un premier message court en français:`;
      } else if (detectedLang === "en") {
        userPrompt = `Client name: ${displayName || "friend"}\n\nTheir post in the group:\n"${postText}"\n${matchedService ? `\nRequested service: ${matchedService}` : ""}\n\nWrite a short first message in English:`;
      } else if (detectedLang === "tn") {
        userPrompt = `اسم العميل: ${displayName || "صاحبي"}\n\nالمنشور تاعو:\n"${postText}"\n${matchedService ? `\nالخدمة المطلوبة: ${matchedService}` : ""}\n\nاكتب أول رسالة قصيرة بالتونسي:`;
      } else {
        userPrompt = `اسم العميل: ${displayName || "صديق"}\n\nمنشوره:\n"${postText}"\n${matchedService ? `\nالخدمة المطلوبة: ${matchedService}` : ""}\n\nاكتب أول رسالة قصيرة بالعربية الفصحى:`;
      }

      // Step 3: Generate first DM
      const model = getAzureClient();
      const { text } = await generateText({
        model,
        system: systemPrompt,
        prompt: userPrompt,
      });

      return NextResponse.json({
        success: true,
        message: text.trim(),
        detectedLanguage: detectedLang,
        promptUsed: systemPrompt,
        authorName: displayName,
        postContext: postText.substring(0, 100),
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error generating first DM:", error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Failed to generate first DM" 
    }, { status: 500 });
  }
}
