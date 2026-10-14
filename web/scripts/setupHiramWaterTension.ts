import dotenv from 'dotenv';
dotenv.config();
process.env.ENABLE_DB = 'true';

import { getPrisma } from '../src/lib/db/client';

async function main() {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error('Database not configured');
  }

  const storyId = 'story_mt4ofllt';
  const story = await prisma.story.findUnique({
    where: { id: storyId },
  });

  if (!story) {
    throw new Error(`Story ${storyId} not found`);
  }

  const manifest = story.manifest as any;
  const wb = manifest.worldBible || {};
  if (!wb.locations) wb.locations = [];

  const hiramParentId = 'loc_mtpqnxvl_jdgi'; // دشت هیرام
  const hiramLoc = wb.locations.find((l: any) => l.id === hiramParentId);

  if (!hiramLoc) {
    throw new Error(`Parent location ${hiramParentId} (دشت هیرام) not found`);
  }

  // 1. Configure the Persistent Threat Clock on Hiram Plains
  hiramLoc.threatClockDefault = {
    name: 'ذخیره آب کاروان',
    maxSegments: 6,
    crisisDescription:
      'مشک‌های آب خالی می‌شوند؛ تشنگی کشنده دامن‌گیر کاروان شده و شترهای باری یکی پس از دیگری زمین‌گیر می‌شوند...',
  };

  const hiramRules = [
    'اقلیم بادیهٔ هیرام و تنش آب: پهنهٔ بیابان با تابش خورشید و بادهای گزندهٔ خشک، ذخایر آب کاروان را تهدید می‌کند. تعلل در سفر، گم کردن راه، یا شکست در چالش‌ها، ساعت تنش «ذخیره آب کاروان» را پیش می‌برد.',
    'بحران بی‌آبی: رسیدن ساعت ذخیره آب به حداکثر، منجر به بحران تشنگی شدید، آسیب به بنیه و سلامت جسمانی مسافران، و تلف شدن شترهای بارکش خواهد شد.',
  ];

  const currentHiramRules = Array.isArray(hiramLoc.specialRules) ? hiramLoc.specialRules : [];
  for (const r of hiramRules) {
    if (!currentHiramRules.includes(r)) {
      currentHiramRules.push(r);
    }
  }
  hiramLoc.specialRules = currentHiramRules;

  // 2. Set parentLocationId for all wilderness transit nodes to inherit the Hiram water clock
  const childDesertLocIds = [
    'loc_muzo9ij9_ycy6', // چاه سنگ
    'loc_mv00yw4l_lbqn', // بادپناه
    'loc_mv0qancl_iked', // سپیدچال
    'loc_rabat_sorkh',  // رباط سرخ
    'loc_mtpu9x8z_cus5', // پشته‌های باختری هیرام
  ];

  for (const childId of childDesertLocIds) {
    const child = wb.locations.find((l: any) => l.id === childId);
    if (child) {
      child.parentLocationId = hiramParentId;
      console.log(`Set parentLocationId of ${child.name} (${child.id}) -> ${hiramParentId}`);
    }
  }

  // 3. Enrich Chah-e Sang (loc_muzo9ij9_ycy6) with Oasis / Refill special rule
  const chahSang = wb.locations.find((l: any) => l.id === 'loc_muzo9ij9_ycy6');
  if (chahSang) {
    const refillRule =
      'واحه و منبع آب شیرین: چاه‌های عمیق سنگی چاه‌سنگ فرصت آب‌گیری مجدد مشک‌ها را برای مازیار مشک‌دار و کاروان فراهم می‌سازد. موفقیت در اقدامات مرتبط با تأمین آب یا استراحت کاروانیان، تنش ذخیره آب را کاهش داده یا تثبیت می‌کند.';
    const rules = Array.isArray(chahSang.specialRules) ? chahSang.specialRules : [];
    if (!rules.includes(refillRule)) {
      rules.unshift(refillRule);
      chahSang.specialRules = rules;
    }
  }

  // 4. Enrich Rabat-e Sorkh (loc_rabat_sorkh) with Fortified Cistern special rule
  const rabatSorkh = wb.locations.find((l: any) => l.id === 'loc_rabat_sorkh');
  if (rabatSorkh) {
    const cisternRule =
      'آب‌انبار خشتی رباط سرخ: آخرین ایستگاه مطمئن برای برداشتن آب پیش از فرود نهایی به درهٔ زروان‌رود. مسافران با دادوستد یا هماهنگی با نگهبانان رباط می‌توانند ذخایر آب خود را تا رسیدن به پل تکمیل نمایند.';
    const rules = Array.isArray(rabatSorkh.specialRules) ? rabatSorkh.specialRules : [];
    if (!rules.includes(cisternRule)) {
      rules.unshift(cisternRule);
      rabatSorkh.specialRules = rules;
    }
  }

  manifest.worldBible = wb;

  // 5. Update Story in Prisma
  await prisma.story.update({
    where: { id: storyId },
    data: { manifest },
  });

  // 6. Update dedicated WorldBible row
  const wbRow = await prisma.worldBible.findFirst({
    where: { storyId },
  });

  if (wbRow) {
    await prisma.worldBible.update({
      where: { id: wbRow.id },
      data: {
        locations: wb.locations as any,
      },
    });
  }

  console.log(`\n✅ Successfully configured Option 1 (Journey-Wide Persistent Water Threat Clock) for ${storyId}!`);
  console.log(`Threat Clock: "${hiramLoc.threatClockDefault.name}" (${hiramLoc.threatClockDefault.maxSegments} segments)`);
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
