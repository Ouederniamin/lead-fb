// Services offered by Creator Labs
export const servicesData = [
  {
    name: 'Website Development',
    nameFrench: 'Développement Web',
    nameArabic: 'تطوير المواقع',
    description: 'Modern, responsive websites built with the latest technologies',
    descriptionFrench: 'Sites web modernes et responsive avec les dernières technologies',
    descriptionArabic: 'نطوروا مواقع عصرية وسريعة تخدم على كل الأجهزة',
    category: 'web',
    keywords: [
      'website', 'site web', 'développement web', 'création site', 'web developer',
      'développeur', 'wordpress', 'landing page', 'vitrine', 'blog'
    ],
    keywordsArabic: [
      'موقع', 'تطوير موقع', 'نحب موقع', 'عندي مشروع', 'سايت', 'ويب',
      'نحب نعمل موقع', 'شكون يعمل مواقع', 'محتاج موقع'
    ],
    priceRange: 'من 500 دينار',
    priceMin: 500,
    priceMax: 3000,
    currency: 'TND',
    deliveryTime: '2-4 أسابيع',
    features: [
      'تصميم عصري وجذاب',
      'متوافق مع الموبايل',
      'سريع التحميل',
      'SEO محسّن',
      'لوحة تحكم سهلة',
      'دعم تقني مجاني',
    ],
    targetAudience: 'الشركات الصغيرة، الستارتابات، الفريلانسر',
    responseTemplate: 'أهلا! شفت اللي تحتاج موقع. نحنا متخصصين في تطوير المواقع العصرية. شنو نوع الموقع اللي تحب تعملو؟ (vitrine, e-commerce, blog...)',
    qualifyingQuestions: [
      'شنية نوع الموقع اللي تحتاجو؟ (vitrine, e-commerce, blog...)',
      'عندك محتوى جاهز (نصوص، صور) ولا تحتاج مساعدة؟',
      'شنية الميزانية اللي حاططها للمشروع تقريبا؟',
      'وقتاش تحب يكون الموقع جاهز؟',
    ],
    objectionHandlers: [
      {
        objection: 'غالي برشا',
        response: 'نفهم، أسعارنا تنافسية في السوق التونسي. الجودة والدعم بعد التسليم يستاهلو. نجمو نتفاهمو على صيغة دفع مريحة إذا تحب.',
      },
      {
        objection: 'نلقى أرخص',
        response: 'عندك حق فما أرخص. أما نحنا نضمنولك جودة الخدمة والدعم التقني بعد التسليم. المشاريع الرخيصة في الغالب تولي تكلفك أكثر في الآخر.',
      },
      {
        objection: 'ما عنديش وقت',
        response: 'ماشي مشكل، نحنا نتكفلو بكل شي. كان تعطينا المعلومات الأساسية ونحنا نخدمو الباقي. ما تحتاجش تضيع وقت.',
      },
    ],
    isActive: true,
  },
  {
    name: 'E-commerce Development',
    nameFrench: 'Développement E-commerce',
    nameArabic: 'تطوير متاجر إلكترونية',
    description: 'Complete online stores with payment and delivery integration',
    descriptionFrench: 'Boutiques en ligne complètes avec paiement et livraison',
    descriptionArabic: 'نبنيولك متجر إلكتروني كامل مع نظام الدفع والتوصيل',
    category: 'ecommerce',
    keywords: [
      'e-commerce', 'boutique en ligne', 'online store', 'vente en ligne', 'shop',
      'magasin', 'shopify', 'woocommerce', 'dropshipping'
    ],
    keywordsArabic: [
      'متجر', 'بيع أونلاين', 'نبيع أونلاين', 'موقع بيع', 'نحب نبيع',
      'تجارة إلكترونية', 'دروبشيبينغ', 'شوبيفاي'
    ],
    priceRange: 'من 1000 دينار',
    priceMin: 1000,
    priceMax: 5000,
    currency: 'TND',
    deliveryTime: '3-6 أسابيع',
    features: [
      'كتالوج منتجات كامل',
      'سلة مشتريات',
      'دفع إلكتروني (Flouci, D17, بطاقات)',
      'تتبع الطلبات',
      'إدارة المخزون',
      'لوحة تحكم سهلة',
    ],
    targetAudience: 'التجار، أصحاب المتاجر، رواد الأعمال',
    responseTemplate: 'أهلا! شفت اللي تحب تبيع أونلاين. نحنا نبنيو متاجر إلكترونية كاملة مع نظام الدفع والتوصيل. شنو تبيع؟',
    qualifyingQuestions: [
      'شنية المنتجات اللي تبيع فيها؟',
      'قداش عندك منتج تقريبا؟',
      'تحب دفع إلكتروني ولا عند التوصيل ولا الزوز؟',
      'عندك صور منتجات جاهزة؟',
    ],
    objectionHandlers: [
      {
        objection: 'مش عارف كيفاش نديرو',
        response: 'ماتخافش، نحنا نتكفلو بكل شي من البداية للنهاية. ونعلموك كيفاش تستعمل لوحة التحكم. بسيطة برشا.',
      },
      {
        objection: 'عندي فيسبوك يكفي',
        response: 'الفيسبوك باهي للتسويق، أما الموقع يعطيك مصداقية أكثر وتنظيم أفضل. وما تبقاش تعتمد على منصة واحدة.',
      },
    ],
    isActive: true,
  },
  {
    name: 'Mobile App Development',
    nameFrench: 'Développement Applications Mobiles',
    nameArabic: 'تطوير تطبيقات الموبايل',
    description: 'Cross-platform mobile apps for iOS and Android',
    descriptionFrench: 'Applications mobiles cross-platform pour iOS et Android',
    descriptionArabic: 'نطوروا تطبيقات للموبايل تخدم على Android و iOS',
    category: 'mobile',
    keywords: [
      'application mobile', 'app', 'android', 'ios', 'mobile', 'application',
      'react native', 'flutter'
    ],
    keywordsArabic: [
      'تطبيق', 'ابليكاسيون', 'موبايل', 'أندرويد', 'آيفون',
      'نحب نعمل تطبيق', 'فكرة تطبيق'
    ],
    priceRange: 'من 2000 دينار',
    priceMin: 2000,
    priceMax: 10000,
    currency: 'TND',
    deliveryTime: '4-8 أسابيع',
    features: [
      'يخدم على Android و iOS',
      'Push notifications',
      'يخدم بدون انترنت',
      'نشر على App Store و Play Store',
      'تحليلات وإحصائيات',
    ],
    targetAudience: 'الشركات، الستارتابات، أصحاب أفكار تطبيقات',
    responseTemplate: 'أهلا! شفت اللي تحتاج تطبيق موبايل. نحنا نطوروا تطبيقات تخدم على Android و iOS. شنية الفكرة متاع التطبيق؟',
    qualifyingQuestions: [
      'شنية الفكرة متاع التطبيق؟',
      'تحتاج Android ولا iOS ولا الزوز؟',
      'عندك تصميم جاهز ولا نخدموه نحنا؟',
      'التطبيق يحتاج backend (سيرفر)؟',
    ],
    objectionHandlers: [
      {
        objection: 'غالي برشا',
        response: 'التطبيقات تطلب وقت وجهد أكثر من المواقع. أما نجمو نبداو بنسخة MVP أبسط بسعر أقل ونطوروها مع الوقت.',
      },
    ],
    isActive: true,
  },
  {
    name: 'Digital Marketing',
    nameFrench: 'Marketing Digital',
    nameArabic: 'التسويق الرقمي',
    description: 'Social media management and advertising campaigns',
    descriptionFrench: 'Gestion des réseaux sociaux et campagnes publicitaires',
    descriptionArabic: 'نديرولك حملات إعلانية ونخدمولك السوشيال ميديا',
    category: 'marketing',
    keywords: [
      'marketing', 'publicité', 'ads', 'facebook ads', 'instagram', 'social media',
      'community manager', 'pub', 'sponsoring', 'boost'
    ],
    keywordsArabic: [
      'تسويق', 'إعلان', 'ماركتينغ', 'فيسبوك', 'انستغرام', 'سوشيال ميديا',
      'حملة إعلانية', 'سبونسور', 'بوست', 'نحب نعمل إعلان'
    ],
    priceRange: 'من 300 دينار/شهر',
    priceMin: 300,
    priceMax: 2000,
    currency: 'TND',
    deliveryTime: 'خدمة مستمرة',
    features: [
      'إدارة صفحات السوشيال ميديا',
      'إنشاء محتوى',
      'حملات إعلانية مستهدفة',
      'تحليل وتقارير شهرية',
      'استراتيجية تسويقية',
    ],
    targetAudience: 'الشركات، المتاجر، المطاعم، المؤثرين',
    responseTemplate: 'أهلا! شفت اللي تحتاج تسويق. نحنا نخدمو حملات إعلانية ناجحة. شنو نوع البزنس متاعك؟',
    qualifyingQuestions: [
      'شنو نوع البزنس متاعك؟',
      'عندك صفحات سوشيال ميديا موجودة؟',
      'شنو الهدف متاعك؟ (مبيعات، متابعين، وعي بالماركة...)',
      'شنية الميزانية الشهرية للإعلانات؟',
    ],
    objectionHandlers: [
      {
        objection: 'الإعلانات ما تخدمش',
        response: 'الإعلانات تخدم كي تكون مستهدفة صح. نحنا نحللو السوق ونستهدفو الجمهور المناسب. نقدر نوريك أمثلة على حملات ناجحة.',
      },
      {
        objection: 'نديرها وحدي',
        response: 'باهي إذا عندك الوقت والخبرة. أما التسويق الاحترافي يفرق. نجمو نخدمو مع بعض ونعلموك في نفس الوقت.',
      },
    ],
    isActive: true,
  },
  {
    name: 'UI/UX Design',
    nameFrench: 'Design UI/UX',
    nameArabic: 'تصميم واجهات',
    description: 'Modern user interface and experience design',
    descriptionFrench: 'Design d\'interface utilisateur moderne',
    descriptionArabic: 'نصمموا واجهات عصرية وسهلة الاستعمال',
    category: 'design',
    keywords: [
      'design', 'ui', 'ux', 'interface', 'graphisme', 'logo', 'charte graphique',
      'figma', 'maquette'
    ],
    keywordsArabic: [
      'تصميم', 'ديزاين', 'واجهة', 'لوقو', 'شعار', 'هوية بصرية'
    ],
    priceRange: 'من 200 دينار',
    priceMin: 200,
    priceMax: 1500,
    currency: 'TND',
    deliveryTime: '1-2 أسابيع',
    features: [
      'تصميم على Figma',
      'نماذج تفاعلية',
      'تصميم متوافق مع الموبايل',
      'ملفات مصدرية',
      'تعديلات متعددة',
    ],
    targetAudience: 'أي حد يحتاج تصميم احترافي لمشروعه',
    responseTemplate: 'أهلا! شفت اللي تحتاج تصميم. نحنا نصمموا واجهات عصرية وجذابة. شنو نوع التصميم اللي تحتاجو؟',
    qualifyingQuestions: [
      'تصميم لموقع ولا تطبيق ولا لوقو؟',
      'عندك فكرة على الألوان والستايل اللي تحبو؟',
      'عندك أمثلة على تصاميم عجبوك؟',
    ],
    objectionHandlers: [],
    isActive: true,
  },
  {
    name: 'Landing Page',
    nameFrench: 'Page de Destination',
    nameArabic: 'صفحة هبوط',
    description: 'High-converting landing pages for marketing campaigns',
    descriptionFrench: 'Pages de destination à haute conversion',
    descriptionArabic: 'صفحات هبوط تجيب نتائج للحملات الإعلانية',
    category: 'marketing',
    keywords: [
      'landing page', 'page de vente', 'publicité', 'ads', 'campagne',
      'squeeze page', 'conversion'
    ],
    keywordsArabic: [
      'صفحة هبوط', 'لاندينغ بايج', 'صفحة إعلان'
    ],
    priceRange: 'من 150 دينار',
    priceMin: 150,
    priceMax: 500,
    currency: 'TND',
    deliveryTime: '3-5 أيام',
    features: [
      'تصميم محسّن للتحويلات',
      'متوافق مع الموبايل',
      'سريع التحميل',
      'نموذج اتصال',
      'ربط مع Google Analytics',
    ],
    targetAudience: 'المسوقين، أصحاب الإعلانات، البزنس',
    responseTemplate: 'أهلا! شفت اللي تحتاج landing page. نخدموها في 3-5 أيام. شنو المنتج/الخدمة اللي تبي تروج ليها؟',
    qualifyingQuestions: [
      'شنو المنتج أو الخدمة اللي تبي تروج ليها؟',
      'عندك محتوى جاهز (نصوص، صور)؟',
      'شنو الهدف؟ (جمع leads، مبيعات، تسجيلات...)',
    ],
    objectionHandlers: [],
    isActive: true,
  },
];
