// Seed script for Creator Labs business profile and services
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { config } from "dotenv";

// Load environment variables from .env.local
config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🏢 Seeding Creator Labs business profile and services...\n");

  // ========================================
  // 1. CREATE/UPDATE BUSINESS PROFILE
  // ========================================
  console.log("📋 Creating business profile...");
  
  // Delete existing business (if any)
  await prisma.business.deleteMany({});
  
  const business = await prisma.business.create({
    data: {
      name: "Creator Labs",
      description: "شركة تونسية متخصصة في تطوير البرمجيات والحلول الرقمية. نقدم خدمات احترافية في تطوير المواقع، التطبيقات، والتجارة الإلكترونية بأسعار تنافسية وجودة عالية.",
      location: "تونس العاصمة، تونس",
      whatsapp: "+216 XX XXX XXX",
      website: "https://creatorlabs.tn",
      languages: ["العربية", "الفرنسية", "الإنجليزية"],
      targetAudience: "رواد الأعمال، الشركات الناشئة، المتاجر، المؤسسات التعليمية، الأطباء والعيادات",
      uniqueSellingPoints: [
        "فريق تونسي محترف",
        "أسعار تنافسية",
        "دعم فني مستمر",
        "تسليم في الوقت المحدد",
        "تصاميم عصرية",
        "خبرة +5 سنوات",
        "مشاريع ناجحة +100",
        "عملاء راضين +50"
      ],
    }
  });
  
  console.log(`✅ Business created: ${business.name}\n`);

  // ========================================
  // 2. CREATE PORTFOLIO ITEMS
  // ========================================
  console.log("🖼️ Creating portfolio items...");
  
  await prisma.portfolio.deleteMany({});
  
  const portfolioItems = [
    {
      businessId: business.id,
      title: "متجر إلكتروني للملابس",
      description: "متجر احترافي مع نظام دفع إلكتروني وتوصيل",
      category: "ecommerce",
      technologies: ["Next.js", "Stripe", "PostgreSQL"],
      clientName: "Fashion TN",
      featured: true,
    },
    {
      businessId: business.id,
      title: "تطبيق توصيل طعام",
      description: "تطبيق iOS و Android مع لوحة تحكم للمطاعم",
      category: "mobile",
      technologies: ["React Native", "Node.js", "Firebase"],
      clientName: "Foody",
      featured: true,
    },
    {
      businessId: business.id,
      title: "موقع عيادة طبية",
      description: "موقع مع نظام حجز مواعيد إلكتروني",
      category: "web",
      technologies: ["React", "Express", "MongoDB"],
      clientName: "Dr. Med Clinic",
      featured: true,
    },
    {
      businessId: business.id,
      title: "منصة تعليمية",
      description: "منصة كورسات أونلاين مع نظام اشتراكات",
      category: "web",
      technologies: ["Next.js", "Prisma", "Stripe"],
      clientName: "Learn TN",
      featured: false,
    },
  ];

  for (const item of portfolioItems) {
    await prisma.portfolio.create({ data: item });
  }
  
  console.log(`✅ Created ${portfolioItems.length} portfolio items\n`);

  // ========================================
  // 3. CREATE SERVICES
  // ========================================
  console.log("🛠️ Creating services...");
  
  // Delete existing services
  await prisma.service.deleteMany({});
  
  const services = [
    // ===== WEB DEVELOPMENT =====
    {
      name: "Web Development",
      nameFrench: "Développement Web",
      nameArabic: "تطوير مواقع ويب",
      description: "Professional websites and web applications",
      descriptionFrench: "Sites web et applications web professionnels",
      descriptionArabic: "مواقع واب احترافية وتطبيقات ويب متطورة - مواقع تعريفية، مدونات، لوحات تحكم",
      category: "web",
      keywords: ["website", "web", "site", "landing page", "portfolio", "blog", "dashboard"],
      keywordsArabic: ["موقع", "ويب", "واب", "صفحة", "بورتفوليو", "مدونة", "لاندينغ", "landing", "site web", "موقع ويب", "موقع واب"],
      priceRange: "500 - 2000 دينار",
      priceMin: 500,
      priceMax: 2000,
      currency: "TND",
      deliveryTime: "2-4 أسابيع",
      features: [
        "تصميم عصري ومتجاوب",
        "لوحة تحكم سهلة",
        "تحسين محركات البحث SEO",
        "شهادة SSL مجانية",
        "استضافة مجانية لمدة سنة",
        "دعم فني لمدة 3 أشهر"
      ],
      targetAudience: "شركات، رواد أعمال، محامين، أطباء، مهندسين",
      responseTemplate: "عسلامة! شفت طلبك. نخدموا في تطوير المواقع - كيفاش نجم نعاونك؟",
      qualifyingQuestions: [
        "آش نوع الموقع تحب؟ (تعريفي، مدونة، لوحة تحكم)",
        "عندك محتوى جاهز (صور، نصوص) ولا نحضروه؟",
        "تحب domain خاص (.tn, .com)؟"
      ],
      objectionHandlers: [
        { objection: "غالي", response: "نجمو نبداو بباكاج بسيط ونكبرو بعد. آش الميزانية الي عندك؟" },
        { objection: "وقت طويل", response: "حسب تعقيد المشروع، موقع بسيط نجمو نخلصوه في أسبوع" }
      ],
      isActive: true,
    },
    
    // ===== MOBILE APPS =====
    {
      name: "Mobile Apps",
      nameFrench: "Applications Mobiles",
      nameArabic: "تطبيقات موبيل iOS & Android",
      description: "Native and cross-platform mobile applications",
      descriptionFrench: "Applications mobiles natives et cross-platform",
      descriptionArabic: "تطبيقات موبايل للآيفون والأندرويد - تطبيقات احترافية بتصميم عصري",
      category: "mobile",
      keywords: ["app", "mobile", "ios", "android", "application", "تطبيق", "موبايل"],
      keywordsArabic: ["تطبيق", "ابلكيشن", "موبايل", "application", "app", "آيفون", "أندرويد", "ios", "android", "تطبيقة", "appli"],
      priceRange: "1500 - 5000 دينار",
      priceMin: 1500,
      priceMax: 5000,
      currency: "TND",
      deliveryTime: "4-8 أسابيع",
      features: [
        "تطبيق iOS و Android",
        "تصميم UI/UX احترافي",
        "Push Notifications",
        "نشر على App Store و Play Store",
        "دعم فني لمدة 6 أشهر",
        "تحديثات مجانية"
      ],
      targetAudience: "مطاعم، متاجر، خدمات توصيل، شركات",
      responseTemplate: "عسلامة! شفت طلبك. نخدموا تطبيقات موبايل - آش الفكرة تاعك؟",
      qualifyingQuestions: [
        "آش فكرة التطبيق؟",
        "تحب iOS فقط ولا Android ولا الزوز؟",
        "التطبيق يحتاج backend/server?"
      ],
      objectionHandlers: [
        { objection: "غالي", response: "نجمو نبداو بـ MVP بسيط ونطورو بعد. آش الميزات الأساسية؟" },
        { objection: "معقد", response: "نسهلوا عليك. قولي الفكرة ونعطيك plan واضح" }
      ],
      isActive: true,
    },
    
    // ===== E-COMMERCE =====
    {
      name: "E-commerce",
      nameFrench: "E-commerce",
      nameArabic: "متجر إلكتروني / E-commerce",
      description: "Complete online stores with payment integration",
      descriptionFrench: "Boutiques en ligne complètes avec intégration de paiement",
      descriptionArabic: "متاجر إلكترونية متكاملة مع أنظمة دفع وتوصيل - ابدأ تبيع أونلاين",
      category: "ecommerce",
      keywords: ["store", "shop", "ecommerce", "online store", "boutique", "متجر"],
      keywordsArabic: ["متجر", "بوتيك", "أونلاين", "تجارة", "بيع", "شراء", "e-commerce", "ecommerce", "boutique", "store", "shop", "متجر الكتروني"],
      priceRange: "1000 - 3500 دينار",
      priceMin: 1000,
      priceMax: 3500,
      currency: "TND",
      deliveryTime: "3-6 أسابيع",
      features: [
        "تصميم متجر احترافي",
        "نظام إدارة المنتجات",
        "بوابات دفع (Flouci, Konnect, D17)",
        "نظام شحن وتوصيل",
        "لوحة تحكم للطلبات",
        "تقارير المبيعات",
        "دعم فني لمدة 6 أشهر"
      ],
      targetAudience: "تجار، محلات ملابس، منتجات يدوية، مستحضرات",
      responseTemplate: "عسلامة! شفت طلبك. نخدموا متاجر إلكترونية - آش تبيع؟",
      qualifyingQuestions: [
        "آش المنتجات الي تبيعها؟",
        "قداش منتج عندك تقريباً؟",
        "تحب دفع إلكتروني ولا عند التسليم فقط؟"
      ],
      objectionHandlers: [
        { objection: "عندي فيسبوك يكفي", response: "المتجر يعطيك مصداقية أكثر وتنظم الطلبات أحسن. نجمو نربطوه بالفيسبوك زادة" },
        { objection: "غالي", response: "المتجر استثمار. نجمو نبداو بباكاج starter ونكبرو بعد" }
      ],
      isActive: true,
    },
    
    // ===== SOCIAL MEDIA MARKETING =====
    {
      name: "Social Media Marketing",
      nameFrench: "Marketing Réseaux Sociaux",
      nameArabic: "تسويق سوشيال ميديا",
      description: "Social media management and marketing campaigns",
      descriptionFrench: "Gestion des réseaux sociaux et campagnes marketing",
      descriptionArabic: "إدارة صفحات السوشيال ميديا وحملات إعلانية - فيسبوك، إنستا، تيك توك",
      category: "marketing",
      keywords: ["marketing", "social media", "facebook", "instagram", "ads", "pub", "تسويق"],
      keywordsArabic: ["تسويق", "ماركتينغ", "سوشيال", "ميديا", "إعلانات", "pub", "ads", "فيسبوك", "انستا", "marketing digital"],
      priceRange: "300 - 1500 دينار/شهر",
      priceMin: 300,
      priceMax: 1500,
      currency: "TND",
      deliveryTime: "خدمة شهرية",
      features: [
        "إدارة الصفحات",
        "تصميم منشورات",
        "حملات إعلانية",
        "تحليل وتقارير",
        "الرد على الرسائل",
        "زيادة المتابعين"
      ],
      targetAudience: "شركات، متاجر، مطاعم، مؤثرين",
      responseTemplate: "عسلامة! شفت طلبك. نخدموا في التسويق الرقمي - آش نوع البزنس تاعك؟",
      qualifyingQuestions: [
        "آش المنصات الي تستعملها؟",
        "عندك صفحات موجودة ولا نبداو من الصفر؟",
        "آش الهدف؟ (زيادة مبيعات، متابعين، وعي)"
      ],
      objectionHandlers: [
        { objection: "نخدم روحي", response: "التسويق ياخذ وقت. نخدمو بالنيابة عنك وتفرغ للبزنس" },
        { objection: "ما نعرفش إذا يخدم", response: "نعطيوك تجربة أسبوع ونوريوك النتائج" }
      ],
      isActive: true,
    },
    
    // ===== UI/UX DESIGN =====
    {
      name: "UI/UX Design",
      nameFrench: "Design UI/UX",
      nameArabic: "تصميم واجهات UI/UX",
      description: "User interface and experience design",
      descriptionFrench: "Conception d'interfaces et d'expérience utilisateur",
      descriptionArabic: "تصميم واجهات المستخدم وتجربة الاستخدام - Figma، Adobe XD",
      category: "design",
      keywords: ["design", "ui", "ux", "figma", "تصميم", "واجهة"],
      keywordsArabic: ["تصميم", "ديزاين", "واجهة", "ui", "ux", "فيقما", "figma", "design", "مصمم"],
      priceRange: "300 - 1500 دينار",
      priceMin: 300,
      priceMax: 1500,
      currency: "TND",
      deliveryTime: "1-3 أسابيع",
      features: [
        "تصميم Figma/XD",
        "تصميم متجاوب",
        "ألوان وخطوط",
        "نظام تصميم كامل",
        "تسليم ملفات المصدر",
        "تعديلات مجانية"
      ],
      targetAudience: "شركات تقنية، startups، مطورين",
      responseTemplate: "عسلامة! شفت طلبك. نخدموا تصميم UI/UX - آش المشروع؟",
      qualifyingQuestions: [
        "آش نوع المشروع؟ (موقع، تطبيق)",
        "عندك branding جاهز (لوقو، ألوان)؟",
        "قداش صفحة/شاشة تقريباً؟"
      ],
      objectionHandlers: [],
      isActive: true,
    },
    
    // ===== AUTOMATION & BOTS =====
    {
      name: "Automation & Bots",
      nameFrench: "Automatisation & Bots",
      nameArabic: "أتمتة وبوتات",
      description: "Business automation, chatbots, and AI solutions",
      descriptionFrench: "Automatisation d'entreprise, chatbots et solutions IA",
      descriptionArabic: "أتمتة العمليات، شات بوتات، وحلول ذكاء اصطناعي - وفر وقتك",
      category: "automation",
      keywords: ["bot", "automation", "ai", "chatbot", "scraping", "أتمتة"],
      keywordsArabic: ["بوت", "أتمتة", "روبوت", "شات بوت", "ai", "ذكاء اصطناعي", "automation", "bot"],
      priceRange: "500 - 3000 دينار",
      priceMin: 500,
      priceMax: 3000,
      currency: "TND",
      deliveryTime: "2-4 أسابيع",
      features: [
        "Chatbot ذكي",
        "أتمتة المهام",
        "تكامل APIs",
        "Scraping بيانات",
        "تقارير آلية",
        "دعم فني"
      ],
      targetAudience: "شركات، متاجر، خدمات عملاء",
      responseTemplate: "عسلامة! شفت طلبك. نخدموا في الأتمتة والبوتات - آش تحب تأتمت؟",
      qualifyingQuestions: [
        "آش العملية الي تحب تأتمتها؟",
        "آش الأدوات الي تستعملها حالياً؟",
        "قداش تكرر هالعملية؟ (يومياً، أسبوعياً)"
      ],
      objectionHandlers: [],
      isActive: true,
    },
  ];

  for (const service of services) {
    await prisma.service.create({ data: service });
  }
  
  console.log(`✅ Created ${services.length} services\n`);

  // ========================================
  // 4. SUMMARY
  // ========================================
  console.log("📊 Database Summary:");
  console.log("====================");
  
  const businessCount = await prisma.business.count();
  const portfolioCount = await prisma.portfolio.count();
  const servicesCount = await prisma.service.count();
  const settingsCount = await prisma.setting.count();
  
  console.log(`   Business profiles: ${businessCount}`);
  console.log(`   Portfolio items: ${portfolioCount}`);
  console.log(`   Services: ${servicesCount}`);
  console.log(`   AI Settings (prompts): ${settingsCount}`);
  
  // List services
  console.log("\n🛠️ Active Services:");
  const activeServices = await prisma.service.findMany({ where: { isActive: true } });
  activeServices.forEach((s, i) => {
    console.log(`   ${i + 1}. ${s.nameArabic} (${s.name}) - ${s.priceRange}`);
  });
  
  console.log("\n✨ Creator Labs business setup complete!");
}

main()
  .catch((e) => {
    console.error("❌ Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
