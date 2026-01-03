import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAzure } from "@ai-sdk/azure";
import { generateText } from "ai";
import { prisma } from "@/lib/db";

// Load services/knowledge from database
async function loadServicesKnowledge(): Promise<string> {
  try {
    const business = await prisma.business.findFirst();
    const services = await prisma.service.findMany({ where: { isActive: true } });
    
    const data = {
      business: business?.name || "NextGen Coding",
      description: business?.description || "",
      services: services.map(s => ({
        name: s.nameArabic || s.name,
        description: s.descriptionArabic || s.description,
        price: s.priceRange || ""
      })),
      contact: {
        whatsapp: business?.whatsapp || "",
        website: business?.website || ""
      }
    };
    return JSON.stringify(data, null, 2);
  } catch (error) {
    console.error("Failed to load services from DB:", error);
  }
  return JSON.stringify({
    business: "NextGen Coding",
    services: [
      { name: "تطوير المواقع", description: "مواقع و تطبيقات ويب", price: "يبدا من 500 دينار" },
      { name: "تطبيقات الموبايل", description: "تطبيقات iOS و Android", price: "يبدا من 1000 دينار" },
      { name: "التجارة الإلكترونية", description: "متاجر إلكترونية مع الدفع", price: "يبدا من 800 دينار" },
    ]
  }, null, 2);
}

// Load custom prompt from database
async function loadCustomPrompt(): Promise<string | null> {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: "ai_conversation_prompt" }
    });
    return setting?.value || null;
  } catch (error) {
    console.error("Failed to load custom prompt from DB:", error);
    return null;
  }
}

// Save custom prompt to database
async function saveCustomPrompt(prompt: string): Promise<boolean> {
  try {
    await prisma.setting.upsert({
      where: { key: "ai_conversation_prompt" },
      update: { value: prompt },
      create: { key: "ai_conversation_prompt", value: prompt }
    });
    return true;
  } catch (error) {
    console.error("Failed to save prompt to DB:", error);
    return false;
  }
}

// Delete custom prompt from database
async function deleteCustomPrompt(): Promise<boolean> {
  try {
    await prisma.setting.deleteMany({
      where: { key: "ai_conversation_prompt" }
    });
    return true;
  } catch (error) {
    console.error("Failed to delete prompt from DB:", error);
    return false;
  }
}

// Default Tunisian prompt
function getDefaultPrompt(servicesKnowledge: string): string {
  return `انت تونسي اصيل من تونس العاصمة. تحكي بالتونسي الصحيح - بالحروف العربية.
تخدم في شركة تقنية اسمها NextGen Coding. هدفك تقنع الناس باش يشريو خدماتنا.

🗣️ كيفاش تحكي:
- استعمل كلمات تونسية صحيحة: "آش", "كيفاش", "علاش", "وقتاش", "فماش", "ماكش", "باهي", "برشا", "توا", "هاو", "هاني", "يزي", "خاطر", "باش", "نجمو", "لازمني", "عندك", "موش"
- استعمل التحيات التونسية: "أهلا", "يعيشك", "لاباس", "صحيت", "الله يعطيك الصحة"
- كون ودود و طبيعي - كيف تحكي مع صاحبك
- ما تكتبش بالفرنساوي أو بالفرانكو (حروف لاتينية) - كان بالعربي
- جاوب قصير و مباشر - ماكش روبو

📝 أمثلة على الكلام التونسي الصحيح:
- "أهلا! كيفاش نجم نعاونك؟"
- "آش تحب تعرف على خدماتنا؟"
- "برشا باهي، توا نفهمك كل شي"
- "يعيشك على السؤال"
- "موش مشكل، نجمو نحكيو على التفاصيل"
- "باهي ياخي، آش رأيك؟"
- "خليني نشوف كيفاش نعاونك"
- "هاني موجود لأي سؤال"

🎯 معلومات على الشركة:
${servicesKnowledge}

⚠️ قواعد مهمة:
1. ديما بالعربي - ما تكتبش بالفرانكو
2. قصير و مباشر - ما تطولش
3. كون ودود و حبوب
4. حاول تفهم آش يحب الكليان
5. اقترح الخدمة المناسبة
6. ما تكررش نفسك`;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, messages, customPrompt, testMessage } = body;

    // Handle different actions
    if (action === "getPrompt") {
      const servicesKnowledge = await loadServicesKnowledge();
      const customSaved = await loadCustomPrompt();
      const defaultPrompt = getDefaultPrompt(servicesKnowledge);
      
      return NextResponse.json({
        success: true,
        defaultPrompt,
        customPrompt: customSaved,
        servicesKnowledge
      });
    }

    if (action === "savePrompt") {
      if (!customPrompt) {
        return NextResponse.json({ error: "No prompt provided" }, { status: 400 });
      }
      const saved = await saveCustomPrompt(customPrompt);
      return NextResponse.json({ success: saved });
    }

    if (action === "resetPrompt") {
      const deleted = await deleteCustomPrompt();
      return NextResponse.json({ success: deleted });
    }

    if (action === "addCorrection") {
      const { wrongText, correctText, currentPrompt } = body;
      
      if (!wrongText || !correctText) {
        return NextResponse.json({ error: "Missing correction data" }, { status: 400 });
      }

      // Generate a concise correction rule using AI
      const azure = createAzure({
        resourceName: process.env.AZURE_OPENAI_RESOURCE_NAME || "nextgen-east-us2",
        apiKey: process.env.AZURE_OPENAI_API_KEY || "",
      });

      const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "gpt-5-mini";

      const rulePrompt = `أنت مساعد يكتب قواعد مختصرة للهجة التونسية.
المستخدم يريد تصحيح طريقة الكلام.

الكلمة/العبارة الغالطة: "${wrongText}"
الصحيح بالتونسي: "${correctText}"

اكتب قاعدة واحدة مختصرة جداً (سطر واحد فقط) تشرح هذا التصحيح.
مثال: "ما تقولش 'ماذا تريد' → قول 'آش تحب'"
أو: "استعمل '${correctText}' بدل '${wrongText}'"

اكتب القاعدة فقط بدون شرح إضافي:`;

      const result = await generateText({
        model: azure(deployment),
        prompt: rulePrompt,
        temperature: 0.3,
      });

      const newRule = result.text.trim();

      // Add the rule to the prompt
      const servicesKnowledge = await loadServicesKnowledge();
      const basePrompt = currentPrompt || await loadCustomPrompt() || getDefaultPrompt(servicesKnowledge);
      
      // Check if there's already a corrections section
      let updatedPrompt: string;
      if (basePrompt.includes("📝 تصحيحات:")) {
        // Add to existing corrections section
        updatedPrompt = basePrompt.replace(
          "📝 تصحيحات:",
          `📝 تصحيحات:\n- ${newRule}`
        );
      } else {
        // Add new corrections section before the rules
        updatedPrompt = basePrompt + `\n\n📝 تصحيحات:\n- ${newRule}`;
      }

      // Save the updated prompt
      const saved = await saveCustomPrompt(updatedPrompt);
      
      if (saved) {
        return NextResponse.json({
          success: true,
          updatedPrompt,
          addedRule: newRule
        });
      } else {
        return NextResponse.json({ error: "Failed to save correction" }, { status: 500 });
      }
    }

    if (action === "testReply") {
      // Test the AI with a conversation
      const servicesKnowledge = await loadServicesKnowledge();
      const savedPrompt = await loadCustomPrompt();
      const systemPrompt = customPrompt || savedPrompt || getDefaultPrompt(servicesKnowledge);

      // Build conversation context
      let conversationContext = "";
      if (messages && messages.length > 0) {
        conversationContext = "\n\n📜 المحادثة السابقة:\n";
        for (const msg of messages) {
          if (msg.sender === "them") {
            conversationContext += `الكليان: ${msg.text}\n`;
          } else {
            conversationContext += `انت: ${msg.text}\n`;
          }
        }
      }

      // Add the test message
      if (testMessage) {
        conversationContext += `\nالكليان: ${testMessage}\n`;
      }

      const fullPrompt = systemPrompt + conversationContext + "\n\nجاوب الكليان (قصير و بالتونسي):";

      // Initialize Azure OpenAI
      const azure = createAzure({
        resourceName: process.env.AZURE_OPENAI_RESOURCE_NAME || "nextgen-east-us2",
        apiKey: process.env.AZURE_OPENAI_API_KEY || "",
      });

      const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "gpt-5-mini";

      const result = await generateText({
        model: azure(deployment),
        prompt: fullPrompt,
        temperature: 0.8,
      });

      const reply = result.text.trim();

      return NextResponse.json({
        success: true,
        reply,
        promptUsed: systemPrompt.substring(0, 200) + "...",
        conversationContext: conversationContext.substring(0, 500)
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  } catch (error) {
    console.error("AI Tune error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process request" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const servicesKnowledge = await loadServicesKnowledge();
    const customSaved = await loadCustomPrompt();
    const defaultPrompt = getDefaultPrompt(servicesKnowledge);

    return NextResponse.json({
      success: true,
      defaultPrompt,
      customPrompt: customSaved,
      servicesKnowledge
    });
  } catch (error) {
    console.error("GET error:", error);
    return NextResponse.json({ error: "Failed to load prompts" }, { status: 500 });
  }
}
