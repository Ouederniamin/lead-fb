// Procedure P8 & P9: AI Analysis and Reply Generation

import { createAzure } from "@ai-sdk/azure";
import { generateText, tool, stepCountIs, zodSchema } from "ai";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { AIAnalysisResult, Message } from "../types";
import { getDisplayName } from "./facebook-selectors";

// ============================================
// LOAD SERVICES KNOWLEDGE
// ============================================
export function loadServicesKnowledge(): string {
  try {
    const servicesPath = path.join(process.cwd(), "data", "services.txt");
    if (fs.existsSync(servicesPath)) {
      return fs.readFileSync(servicesPath, "utf-8");
    }
  } catch {
    console.error("Failed to load services");
  }

  // Default services
  return `NextGen Coding - نقدمو:
- تطوير مواقع ويب (websites)
- تطبيقات موبيل (iOS & Android)
- E-commerce و متاجر إلكترونية
- Marketing digital و إدارة السوشيال ميديا
- تصميم جرافيك و UI/UX`;
}

// ============================================
// GET AZURE OPENAI CLIENT
// ============================================
function getAzureClient() {
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT || "";
  const resourceName = endpoint
    .replace("https://", "")
    .replace(".openai.azure.com", "")
    .replace(/\/$/, "") || process.env.AZURE_OPENAI_RESOURCE_NAME || "";

  if (!apiKey || !resourceName) {
    throw new Error("Azure OpenAI not configured - missing API key or resource name");
  }

  return createAzure({ resourceName, apiKey });
}

// ============================================
// P8: AI ANALYSIS (for Lead Gen)
// ============================================

// Services we offer - AI will check if post demands any of these
export const SERVICES_LIST = [
  "تطوير مواقع ويب (Web Development)",
  "تطبيقات موبيل iOS & Android (Mobile Apps)",
  "متاجر إلكترونية E-commerce",
  "Marketing digital و السوشيال ميديا",
  "تصميم جرافيك و UI/UX",
  "أنظمة إدارة (Management Systems)",
  "Automation و Bots",
];

export async function analyzePostForLead(
  postContent: string,
  log: (msg: string) => void
): Promise<AIAnalysisResult> {
  log("🧠 Analyzing post for lead potential...");

  const services = loadServicesKnowledge();

  try {
    const azure = getAzureClient();
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o-mini";

    const systemPrompt = `You are a lead qualification AI for NextGen Coding, a digital services AGENCY in Tunisia.

=== OUR SERVICES ===
${SERVICES_LIST.map((s, i) => `${i + 1}. ${s}`).join("\n")}

=== CUSTOM SERVICES INFO ===
${services}

=== YOUR TASK ===
Determine if the person wants a project done by a freelancer or agency.

Respond with a JSON object:
{
  "isLead": true/false,
  "matchedService": "exact service name from list above" or null,
  "reason": "1 sentence in English explaining what project they need" or null,
  "keywords": ["keywords", "from", "post"],
  "suggestedComment": "A helpful comment in Tunisian Arabic (دارجة)" or null
}

=== WHAT IS A LEAD ===
Someone who needs a PROJECT done - website, app, design, marketing, etc.
Examples: "نحب نعمل موقع", "نلقى شكون يخدملي تطبيق", "محتاج شكون يعملي", "أبحث عن مطور يعملي"

=== ABSOLUTELY REJECT THESE (NOT LEADS) ===
❌ JOB OFFERS / EMPLOYMENT - "offre d'emploi", "we are hiring", "permanent position", "CDI", "poste", "recrute"
❌ INTERNSHIPS - "stage", "stagiaire", "PFE", "offre de stage", "stage académique"
❌ EQUITY / PARTNERSHIP - "equity", "parts", "co-founder", "partenaire", "associé", "% of company", "investisseur"
❌ STARTUP SEEKING TEAM MEMBERS - "looking for collaborators", "cherche associé", "join our team", "rejoindre notre équipe"
❌ FREE WORK REQUESTS - "gratuit", "bénévole", "volunteer", "free", "sans paiement", "بلاش", "مجاني"
❌ PEOPLE OFFERING THEIR SERVICES - freelancers promoting themselves

=== RULES ===
1. If the post mentions stage/internship/PFE = NOT A LEAD
2. If the post offers employment/job/position = NOT A LEAD  
3. If the post offers equity/partnership instead of payment = NOT A LEAD
4. If they want someone to JOIN their team = NOT A LEAD
5. We want CLIENTS who need a PROJECT, not employers hiring staff
6. suggestedComment should be natural in Tunisian dialect (عسلامة، كيفاش، etc.)`;

    const { text } = await generateText({
      model: azure(deployment),
      system: systemPrompt,
      prompt: `Analyze this post:\n\n${postContent}`,
    });

    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      if (result.isLead) {
        log(`✅ LEAD DETECTED: ${result.matchedService}`);
        log(`   Reason: ${result.reason}`);
      } else {
        log(`❌ Not a lead`);
      }
      return {
        isLead: result.isLead === true,
        matchedService: result.matchedService || null,
        reason: result.reason || null,
        keywords: result.keywords || [],
        suggestedComment: result.suggestedComment || null,
      };
    }

    throw new Error("Could not parse AI response");
  } catch (error) {
    log(`❌ AI analysis failed: ${error}`);
    return {
      isLead: false,
      matchedService: null,
      reason: null,
      keywords: [],
      suggestedComment: null,
    };
  }
}

// ============================================
// P9: AI REPLY GENERATION (for Message Agent)
// Uses tool calling for stage updates
// ============================================

// Result from AI with tool calls
export interface AIReplyResult {
  reply: string;
  toolCalls: {
    updateStage?: {
      stage: 'INTERESTED' | 'CTA_WHATSAPP' | 'CTA_PHONE' | 'CONVERTED' | 'LOST';
      reason: string;
      contactInfo?: string;
    };
    endConversation?: {
      reason: string;
    };
  };
}

export async function generateAIReply(
  fullName: string,
  conversation: Message[],
  log: (msg: string) => void
): Promise<string> {
  const result = await generateAIReplyWithTools(fullName, conversation, log);
  return result.reply;
}

export async function generateAIReplyWithTools(
  fullName: string,
  conversation: Message[],
  log: (msg: string) => void
): Promise<AIReplyResult> {
  const displayName = getDisplayName(fullName);
  const services = loadServicesKnowledge();

  log(`🧠 Generating AI reply for ${displayName}...`);
  log(`📊 Conversation has ${conversation.length} messages`);

  const result: AIReplyResult = {
    reply: "",
    toolCalls: {},
  };

  try {
    const azure = getAzureClient();
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o-mini";

    // Check if we've already greeted
    const ourPreviousMessages = conversation.filter((m) => m.sender === "us");
    const alreadyGreeted = ourPreviousMessages.length > 0;

    // Build conversation history
    const conversationHistory = conversation
      .map((m) => `${m.sender === "us" ? "أنت (المندوب)" : "العميل"}: ${m.text}`)
      .join("\n");

    const systemPrompt = `أنت مندوب مبيعات في NextGen Coding. تكتب بالدارجة التونسية كأنك شخص حقيقي يكتب على الماسنجر.

=== خدماتنا ===
${services}

=== أدوات متاحة (Tools) ===
لديك أدوات لتحديث حالة العميل:

1. updateLeadStage - استخدمها عندما:
   - INTERESTED: العميل يسأل عن الأسعار أو التفاصيل أو يبدي اهتمام
   - CTA_WHATSAPP: العميل أعطاك رقم واتساب
   - CTA_PHONE: العميل أعطاك رقم هاتف
   - CONVERTED: العميل وافق على المشروع
   - LOST: العميل قال لا يريد

2. endConversation - استخدمها عندما:
   - العميل قال وداع واضح (bye, bslema, a bientot)
   - اتفقتو على موعد/واتس والعميل أكد

=== قواعد استخدام الأدوات ===
✅ إذا العميل أرسل رقم (+216..., 8 أرقام) = استخدم updateLeadStage
✅ إذا العميل سأل "قداش" أو "كم" أو "كيفاش" = استخدم updateLeadStage مع INTERESTED
✅ إذا العميل قال "ok bslema" = استخدم endConversation

=== قواعد الرد ===
❌ لا تقول "عسلامة" إذا سبق وقلتها
❌ لا تكرر نفسك
❌ لا تكتب رسائل طويلة - 10 كلمات كافية
❌ لا emoji

=== كيف تتكلم ===
- مثل صاحبك على الماسنجر
- جمل قصيرة جداً
- ${alreadyGreeted ? "لا تقل عسلامة - خلاص سلمت عليه!" : "قل عسلامة مرة وحدة فقط"}
- اسمه: ${displayName}`;

    const userPrompt = `المحادثة:

${conversationHistory || "(أول رسالة - قل عسلامة)"}

${alreadyGreeted ? "⚠️ سبق وقلت عسلامة!" : ""}

تعليمات:
1. إذا العميل أرسل رقم هاتف = استخدم أداة updateLeadStage
2. إذا أبدى اهتمام (سأل عن الأسعار، التفاصيل) = استخدم أداة updateLeadStage مع INTERESTED
3. إذا ودع = استخدم أداة endConversation
4. اكتب ردك`;

    // Define schemas for tools (first generateReply)
    const updateLeadStageSchema1 = z.object({
      stage: z.enum(['INTERESTED', 'CTA_WHATSAPP', 'CTA_PHONE', 'CONVERTED', 'LOST'])
        .describe("The new stage for this lead"),
      reason: z.string()
        .describe("Brief reason for the stage update in English"),
      contactInfo: z.string().optional()
        .describe("Phone or WhatsApp number if provided by the lead"),
    });

    const endConversationSchema1 = z.object({
      reason: z.string()
        .describe("Brief reason for ending the conversation"),
    });

    // Define tools for the AI
    const tools = {
      updateLeadStage: tool({
        description: "Update the lead stage based on conversation progress. Call this when detecting interest, phone numbers, or WhatsApp numbers.",
        inputSchema: zodSchema(updateLeadStageSchema1),
        execute: async (input: z.infer<typeof updateLeadStageSchema1>) => {
          const { stage, reason, contactInfo } = input;
          log(`🎯 AI Tool: updateLeadStage(${stage}) - ${reason}`);
          if (contactInfo) {
            log(`📱 Contact info: ${contactInfo}`);
          }
          result.toolCalls.updateStage = { stage, reason, contactInfo };
          return { success: true, stage, reason };
        },
      }),
      endConversation: tool({
        description: "End the conversation when the lead says goodbye or confirms an agreement.",
        inputSchema: zodSchema(endConversationSchema1),
        execute: async (input: z.infer<typeof endConversationSchema1>) => {
          const { reason } = input;
          log(`🏁 AI Tool: endConversation() - ${reason}`);
          result.toolCalls.endConversation = { reason };
          return { success: true, reason };
        },
      }),
    };

    const { text, toolCalls } = await generateText({
      model: azure(deployment),
      system: systemPrompt,
      prompt: userPrompt,
      tools,
      stopWhen: stepCountIs(2), // Allow tool call + final response
    });

    // Log tool calls
    if (toolCalls && toolCalls.length > 0) {
      log(`🔧 AI made ${toolCalls.length} tool call(s)`);
    }

    result.reply = text.trim();
    
    // Handle [END_CONVERSATION] marker for backwards compatibility
    if (result.reply.includes("[END_CONVERSATION]") && !result.toolCalls.endConversation) {
      result.toolCalls.endConversation = { reason: "AI used END_CONVERSATION marker" };
    }

    log(`🤖 AI Reply: "${result.reply}"`);
    return result;
  } catch (error) {
    log(`❌ AI reply generation failed: ${error}`);
    // Fallback
    result.reply = `مرحبا ${displayName}! كيفاش نجم نعاونك؟`;
    return result;
  }
}

// ============================================
// POST CONTEXT TYPE (for context-aware replies)
// ============================================
export interface PostContext {
  postText: string;
  authorName: string;
  matchedService: string | null;
  groupName: string;
  postedAt: Date | null;
}

// ============================================
// GENERATE AI REPLY WITH FULL LEAD CONTEXT
// This version includes the original post for better replies
// ============================================
export async function generateAIReplyWithContext(
  fullName: string,
  conversation: Message[],
  postContext: PostContext | null,
  log: (msg: string) => void
): Promise<AIReplyResult> {
  const displayName = getDisplayName(fullName);
  const services = loadServicesKnowledge();

  log(`🧠 Generating AI reply for ${displayName} (with post context)...`);
  log(`📊 Conversation has ${conversation.length} messages`);
  if (postContext) {
    log(`📝 Original post: "${postContext.postText.substring(0, 50)}..."`);
    log(`🎯 Matched service: ${postContext.matchedService || "Unknown"}`);
  }

  const result: AIReplyResult = {
    reply: "",
    toolCalls: {},
  };

  try {
    const azure = getAzureClient();
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o-mini";

    // Check if we've already greeted
    const ourPreviousMessages = conversation.filter((m) => m.sender === "us");
    const alreadyGreeted = ourPreviousMessages.length > 0;

    // Build conversation history
    const conversationHistory = conversation
      .map((m) => `${m.sender === "us" ? "أنت (المندوب)" : "العميل"}: ${m.text}`)
      .join("\n");

    // Build post context section
    const postContextSection = postContext
      ? `
=== الطلب الأصلي للعميل ===
ما كتبه في المجموعة: "${postContext.postText}"
الخدمة المطلوبة: ${postContext.matchedService || "غير محدد"}
المجموعة: ${postContext.groupName}
${postContext.postedAt ? `تاريخ النشر: ${postContext.postedAt.toLocaleDateString()}` : ""}

⚠️ مهم: العميل محتاج "${postContext.matchedService || "خدمة"}". استخدم هذه المعلومات في ردك!
`
      : "";

    const systemPrompt = `أنت مندوب مبيعات في NextGen Coding. تكتب بالدارجة التونسية كأنك شخص حقيقي يكتب على الماسنجر.

=== خدماتنا ===
${services}
${postContextSection}
=== أدوات متاحة (Tools) ===
لديك أدوات لتحديث حالة العميل:

1. updateLeadStage - استخدمها عندما:
   - INTERESTED: العميل يسأل عن الأسعار أو التفاصيل أو يبدي اهتمام
   - CTA_WHATSAPP: العميل أعطاك رقم واتساب
   - CTA_PHONE: العميل أعطاك رقم هاتف
   - CONVERTED: العميل وافق على المشروع
   - LOST: العميل قال لا يريد

2. endConversation - استخدمها عندما:
   - العميل قال وداع واضح (bye, bslema, a bientot)
   - اتفقتو على موعد/واتس والعميل أكد

=== قواعد استخدام الأدوات ===
✅ إذا العميل أرسل رقم (+216..., 8 أرقام) = استخدم updateLeadStage
✅ إذا العميل سأل "قداش" أو "كم" أو "كيفاش" = استخدم updateLeadStage مع INTERESTED
✅ إذا العميل قال "ok bslema" = استخدم endConversation

=== قواعد الرد ===
❌ لا تقول "عسلامة" إذا سبق وقلتها
❌ لا تكرر نفسك
❌ لا تكتب رسائل طويلة - 10 كلمات كافية
❌ لا emoji
${postContext ? `✅ أذكر أنك رأيت طلبه عن "${postContext.matchedService || "الخدمة"}" إذا لم تفعل بعد` : ""}

=== كيف تتكلم ===
- مثل صاحبك على الماسنجر
- جمل قصيرة جداً
- ${alreadyGreeted ? "لا تقل عسلامة - خلاص سلمت عليه!" : "قل عسلامة مرة وحدة فقط"}
- اسمه: ${displayName}`;

    const userPrompt = `المحادثة:

${conversationHistory || "(أول رسالة - قل عسلامة)"}

${alreadyGreeted ? "⚠️ سبق وقلت عسلامة!" : ""}

تعليمات:
1. إذا العميل أرسل رقم هاتف = استخدم أداة updateLeadStage
2. إذا أبدى اهتمام (سأل عن الأسعار، التفاصيل) = استخدم أداة updateLeadStage مع INTERESTED
3. إذا ودع = استخدم أداة endConversation
4. اكتب ردك`;

    // Define schemas for tools (second generateReplyWithContext)
    const updateLeadStageSchema2 = z.object({
      stage: z.enum(['INTERESTED', 'CTA_WHATSAPP', 'CTA_PHONE', 'CONVERTED', 'LOST'])
        .describe("The new stage for this lead"),
      reason: z.string()
        .describe("Brief reason for the stage update in English"),
      contactInfo: z.string().optional()
        .describe("Phone or WhatsApp number if provided by the lead"),
    });

    const endConversationSchema2 = z.object({
      reason: z.string()
        .describe("Brief reason for ending the conversation"),
    });

    // Define tools for the AI
    const tools = {
      updateLeadStage: tool({
        description: "Update the lead stage based on conversation progress. Call this when detecting interest, phone numbers, or WhatsApp numbers.",
        inputSchema: zodSchema(updateLeadStageSchema2),
        execute: async (input: z.infer<typeof updateLeadStageSchema2>) => {
          const { stage, reason, contactInfo } = input;
          log(`🎯 AI Tool: updateLeadStage(${stage}) - ${reason}`);
          if (contactInfo) {
            log(`📱 Contact info: ${contactInfo}`);
          }
          result.toolCalls.updateStage = { stage, reason, contactInfo };
          return { success: true, stage, reason };
        },
      }),
      endConversation: tool({
        description: "End the conversation when the lead says goodbye or confirms an agreement.",
        inputSchema: zodSchema(endConversationSchema2),
        execute: async (input: z.infer<typeof endConversationSchema2>) => {
          const { reason } = input;
          log(`🏁 AI Tool: endConversation() - ${reason}`);
          result.toolCalls.endConversation = { reason };
          return { success: true, reason };
        },
      }),
    };

    const { text, toolCalls } = await generateText({
      model: azure(deployment),
      system: systemPrompt,
      prompt: userPrompt,
      tools,
      stopWhen: stepCountIs(2),
    });

    // Log tool calls
    if (toolCalls && toolCalls.length > 0) {
      log(`🔧 AI made ${toolCalls.length} tool call(s)`);
    }

    result.reply = text.trim();
    
    // Handle [END_CONVERSATION] marker for backwards compatibility
    if (result.reply.includes("[END_CONVERSATION]") && !result.toolCalls.endConversation) {
      result.toolCalls.endConversation = { reason: "AI used END_CONVERSATION marker" };
    }

    log(`🤖 AI Reply: "${result.reply}"`);
    return result;
  } catch (error) {
    log(`❌ AI reply generation failed: ${error}`);
    // Fallback
    result.reply = `مرحبا ${displayName}! كيفاش نجم نعاونك؟`;
    return result;
  }
}

// ============================================
// GENERATE INITIAL DM MESSAGE
// For Initiator Agent to send first DM
// ============================================
export async function generateInitialDM(
  authorName: string,
  postText: string,
  matchedService: string | null,
  log: (msg: string) => void
): Promise<string> {
  const displayName = getDisplayName(authorName);
  const services = loadServicesKnowledge();

  log(`🧠 Generating initial DM for ${displayName}...`);
  log(`📝 Post: "${postText.substring(0, 50)}..."`);

  try {
    const azure = getAzureClient();
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o-mini";

    const systemPrompt = `أنت مندوب مبيعات في NextGen Coding. تكتب بالدارجة التونسية كأنك شخص حقيقي.

=== خدماتنا ===
${services}

=== مهمتك ===
اكتب أول رسالة لشخص نشر طلب في مجموعة فيسبوك.

=== ما نشره العميل ===
"${postText}"

الخدمة المطلوبة: ${matchedService || "غير محدد"}

=== قواعد الرسالة ===
✅ ابدأ بـ "عسلامة" أو "السلام"
✅ اذكر أنك شفت طلبه في المجموعة
✅ قدم نفسك بشكل مختصر (نخدم في NextGen)
✅ اسأله سؤال واحد فقط عن المشروع
❌ لا تكتب رسالة طويلة - 2-3 جمل كافية
❌ لا emoji
❌ لا تذكر أسعار

=== اسم العميل ===
${displayName}`;

    const { text } = await generateText({
      model: azure(deployment),
      system: systemPrompt,
      prompt: "اكتب رسالة أولى قصيرة ومباشرة:",
    });

    log(`🤖 Generated DM: "${text.substring(0, 50)}..."`);
    return text.trim();
  } catch (error) {
    log(`❌ Initial DM generation failed: ${error}`);
    // Fallback message
    return `عسلامة ${displayName}! شفت طلبك في المجموعة. نخدم في NextGen Coding وعندنا خبرة في ${matchedService || "التطوير"}. نجمو نهدرو على المشروع؟`;
  }
}

// ============================================
// GENERATE COMMENT FOR POST
// For Initiator Agent to comment on posts
// ============================================
export async function generatePostComment(
  postText: string,
  matchedService: string | null,
  log: (msg: string) => void
): Promise<string> {
  log(`🧠 Generating comment for post...`);
  log(`📝 Post: "${postText.substring(0, 50)}..."`);

  try {
    const azure = getAzureClient();
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o-mini";

    const systemPrompt = `أنت تكتب تعليق على منشور في مجموعة فيسبوك. اكتب بالدارجة التونسية.

=== المنشور ===
"${postText}"

الخدمة المطلوبة: ${matchedService || "غير محدد"}

=== قواعد التعليق ===
✅ اكتب تعليق قصير ومفيد (جملة أو جملتين)
✅ اذكر أنك تنجم تعاونه
✅ اطلب منه يبعثلك رسالة خاصة
❌ لا تكتب رسالة طويلة
❌ لا emoji كثير
❌ لا تذكر أسعار
❌ لا تبان سبام

=== أمثلة جيدة ===
- "نجموا نعاونوك في هذا 👍 ابعثلي message"
- "عندنا خبرة في هذا المجال. نهدر معاك في inbox؟"
- "نخدموا في هذا المجال. ابعثلي رسالة نعطيك تفاصيل"`;

    const { text } = await generateText({
      model: azure(deployment),
      system: systemPrompt,
      prompt: "اكتب تعليق قصير:",
    });

    log(`🤖 Generated comment: "${text}"`);
    return text.trim();
  } catch (error) {
    log(`❌ Comment generation failed: ${error}`);
    // Fallback comment
    return `نجموا نعاونوك في هذا 👍 ابعثلي message`;
  }
}

// ============================================
// CHECK FOR END CONVERSATION MARKER
// ============================================
export function shouldEndConversation(aiReply: string): boolean {
  return aiReply.includes("[END_CONVERSATION]");
}

// ============================================
// CLEAN AI REPLY (remove markers)
// ============================================
export function cleanAIReply(aiReply: string): string {
  return aiReply.replace("[END_CONVERSATION]", "").trim();
}

// ============================================
// DETECT INTEREST KEYWORDS
// ============================================
export function detectInterest(messages: Message[]): boolean {
  const interestKeywords = [
    "نحب نعرف",
    "قداش",
    "كم",
    "interested",
    "price",
    "how much",
    "أبي",
    "نحب",
    "عندك",
    "عندكم",
    "موجود",
    "شنوة",
    "كيفاش",
    "وقتاش",
    "فين",
  ];

  for (const msg of messages) {
    if (msg.sender === "them") {
      const lowerText = msg.text.toLowerCase();
      for (const keyword of interestKeywords) {
        if (lowerText.includes(keyword.toLowerCase())) {
          return true;
        }
      }
    }
  }

  return false;
}
