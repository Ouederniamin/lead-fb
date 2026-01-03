// Business Profile for Creator Labs
export const businessData = {
  id: 'creatorlabs',
  name: 'Creator Labs',
  description: `Creator Labs هي وكالة تونسية متخصصة في التطوير الرقمي والتسويق. نخدمو مع الشركات الصغيرة والمتوسطة، الستارتابات، والأفراد اللي يحبو يطوروا وجودهم الرقمي.

نحنا نقدمو خدمات شاملة: من تصميم وتطوير المواقع والتطبيقات، لإدارة الحملات الإعلانية والتسويق الرقمي. فريقنا يجمع بين الخبرة التقنية والإبداع التسويقي باش نوصلو لأفضل النتائج.`,
  location: 'Tunis, Tunisia',
  whatsapp: '+216 29 293 037',
  website: 'https://creatorlabs.tn',
  languages: ['Arabic', 'Tunisian Arabic', 'French', 'English'],
  targetAudience: 'الشركات الصغيرة والمتوسطة، الستارتابات، رواد الأعمال، المؤثرين، أصحاب المتاجر، وكل واحد يحب يطور وجوده الرقمي',
  uniqueSellingPoints: [
    'فريق تونسي يفهم السوق المحلي',
    'أسعار تنافسية مقارنة بالسوق',
    'دعم تقني بعد التسليم',
    'نتائج مضمونة في التسويق',
    'تواصل مباشر ومتابعة مستمرة',
    'خبرة في التقنيات الحديثة (Next.js, React, Node.js)',
    'نخدمو بالعربي والفرنساوي',
  ],
};

// Portfolio Items
export const portfolioData = [
  {
    title: 'متجر إلكتروني للموضة',
    description: 'موقع e-commerce كامل مع نظام الدفع والتوصيل لماركة ملابس تونسية',
    category: 'ecommerce',
    technologies: ['Next.js', 'Stripe', 'PostgreSQL', 'Tailwind CSS'],
    clientName: 'Fashion TN',
    completedDate: 'Nov 2025',
    featured: true,
  },
  {
    title: 'تطبيق توصيل طعام',
    description: 'تطبيق موبايل للمطاعم يمكن الحرفاء من الطلب والتتبع في الوقت الحقيقي',
    category: 'mobile',
    technologies: ['React Native', 'Node.js', 'Socket.io', 'MongoDB'],
    clientName: 'Resto Express',
    completedDate: 'Oct 2025',
    featured: true,
  },
  {
    title: 'حملة تسويقية لعقارات',
    description: 'حملة إعلانية على فيسبوك وانستغرام جابت +500 lead في شهر',
    category: 'marketing',
    technologies: ['Meta Ads', 'Google Analytics', 'Lead Forms'],
    clientName: 'Immobilier Plus',
    completedDate: 'Sep 2025',
    featured: true,
  },
  {
    title: 'موقع لوكالة سياحية',
    description: 'موقع vitrine مع نظام حجز للرحلات والفنادق',
    category: 'web',
    technologies: ['Next.js', 'Prisma', 'PostgreSQL'],
    clientName: 'Tunisia Tours',
    completedDate: 'Aug 2025',
    featured: false,
  },
];
