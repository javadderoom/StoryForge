export interface CreditPackageData {
  sku: string;
  title: string;
  titleEn: string;
  credits: number;
  priceToman: number;
  priceRial: number;
  originalPriceToman: number;
  discountPercent: number;
  badge: string | null;
  description: string;
  isActive: boolean;
  sortOrder: number;
}

export const DEFAULT_CREDIT_PACKAGES: CreditPackageData[] = [
  {
    sku: 'afsanehsaz_credits_50',
    title: 'بسته کاوشگر تازه',
    titleEn: 'Starter Scout Pack',
    credits: 50,
    priceToman: 29000,
    priceRial: 290000,
    originalPriceToman: 29000,
    discountPercent: 0,
    badge: null,
    description: '۵۰ صحنه داستانی تعاملی با هوش مصنوعی',
    isActive: true,
    sortOrder: 1,
  },
  {
    sku: 'afsanehsaz_credits_150',
    title: 'بسته ماجراجوی شجاع',
    titleEn: 'Brave Adventurer Pack',
    credits: 150,
    priceToman: 69000,
    priceRial: 690000,
    originalPriceToman: 87000,
    discountPercent: 20,
    badge: 'محبوب‌ترین',
    description: '۱۵۰ صحنه داستانی + ۲۰٪ اعتبار هدیه',
    isActive: true,
    sortOrder: 2,
  },
  {
    sku: 'afsanehsaz_credits_500',
    title: 'بسته افسانه‌ای والوریا',
    titleEn: 'Legendary Realm Pack',
    credits: 500,
    priceToman: 189000,
    priceRial: 1890000,
    originalPriceToman: 290000,
    discountPercent: 35,
    badge: 'بیشترین تخفیف (۳۵٪)',
    description: '۵۰۰ صحنه داستانی برای روایت‌های طولانی و نبردهای حماسی',
    isActive: true,
    sortOrder: 3,
  },
];
