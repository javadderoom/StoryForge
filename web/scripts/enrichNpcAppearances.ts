import dotenv from 'dotenv';
dotenv.config();
process.env.ENABLE_DB = 'true';

import { getPrisma } from '../src/lib/db/client';

async function main() {
  const prisma = getPrisma();
  if (!prisma) throw new Error('Database not connected');

  const story = await prisma.story.findUnique({
    where: { id: 'story_mt4ofllt' },
  });

  if (!story) throw new Error('Story story_mt4ofllt not found');

  const manifest = story.manifest as any;
  const wb = manifest.worldBible || {};
  const npcs = wb.npcs || [];

  const appearances: Record<string, any> = {
    // 1. Caravan Master Borzou Sangtarash
    npc_borzou: {
      physicalBuild: 'مردی بلندبالا و چهارشانه با استخوان‌بندی درشت و شانه‌هایی ستبر و اندکی خمیده ناشی از سال‌ها پتک زدن بر سنگ، گام‌های سنگین و خستگی‌ناپذیر',
      faceAndGaze: 'چهره‌ای سوخته در آفتاب چون چرم کهنه، خطوط عمیق خشم و تجربه بر پیشانی، ریش جوگندمی و زبر آغشته به غبار سرخ کویر، چشمان کهربایی باریک و تیزبین',
      attire: 'ردای بلند پشمین تیره تا مچ پا، شال نمدی خرمایی بر کمر با غلاف چرمی دشنه‌ای کهنه و تسمه‌های تراز، گیوه‌های چرمی ضخیم بیابان‌گردی',
      mannerisms: 'دستانی فراخ و پینه‌بسته، گرفتن مهار شتر پیشرو با دست چپ و سایه‌بان کردن دست راست بر پیشانی برای پاییدن ستیغ تپه‌ها',
    },
    // 2. Bahram Dashban
    npc_bahram: {
      physicalBuild: 'قامت بلند، کشیده و لاغر ترکه‌ای با عضلات خشک و ورزیده، گام‌های بلند، نرم و بی‌صدا هم‌پای شتران سرخ',
      faceAndGaze: 'بینی باریک و کمی شکسته، چشمان سیاه، درخشان و تیزبین چون شاهین بیابان، گونه‌های برجسته آفتاب‌زده با خطوط هوشیار',
      attire: 'جلیقه بی‌دکمه از پوست گوسفند روی پیراهن کرباس سرمه‌ای نخ‌نما، مچ‌بندهای چرمی ساربانی، چوب‌دستی بلند و گره‌دار از چوب ارژن',
      mannerisms: 'پاییدن دائم کفی‌های گوشتی و سم شترها، نواختن سوت‌های مقطع ساربانی برای هدایت و آرام کردن کاروان',
    },
    // 3. Maziar Mashk-Dar
    npc_maziar: {
      physicalBuild: 'قامت متوسط متمایل به کوتاه، تنه‌ای توپر و ستبر، گردنی عضلانی و پاهایی چابک و ورزیده که خاک بادیه بر آن نشسته',
      faceAndGaze: 'چفیه نیلی‌رنگ پیچیده دور سر، لب‌های آفتاب‌سوخته و ترک‌خورده با خط لبخند کنایه‌آمیز، چشمان روشن، نافذ و آرام',
      attire: 'حمایل چرمی ضربدری روی سینه با حلقه‌های برنجی، پیمانه‌های مسین فرورفته و سنبه‌های چرمی، مشک‌های بزرگ بز بسته به یال شتر، چکمه‌های نرم بی‌پاشنه',
      mannerisms: 'چرخاندن پیمانه مسین میان انگشتان تر و خنک، سنجش وزن مشک‌ها با تکان‌های ملایم دست، ریختن جرعه‌های دقیق آب بدون هدررفت',
    },
    // 4. Farrokhzad Namak-Chin
    npc_farrokhzad: {
      physicalBuild: 'قامتی متوسط با پشت اندکی قوزکرده ناشی از سال‌ها کار روی ترازوی نمک، گام‌های کوتاه، محتاط و مضطرب',
      faceAndGaze: 'پوست رنگ‌پریده با سرخی نوک بینی و گونه‌ها، ابروهای پیوسته و گره‌خورده از دلواپسی، چشمان ریز و خاکستری که مدام آسمان را برای ابرها می‌کاوند',
      attire: 'ردای قهوه‌ای کتان با حاشیه‌های لکه‌دار از شورهٔ سپید نمک، پیش‌بند چرمی کارگاهی با جای قلمدان و سنجه، دستکش‌های چرمی بی‌انگشت',
      mannerisms: 'فوت کردن مدام گرد نمک از لای پره‌های بینی، دست کشیدن وسواسی به برزنت گاری‌ها برای اطمینان از خشک ماندن بارهای سنگ‌نمک',
    },
    // 5. Sohrab Choob-Dast
    npc_sohrab: {
      physicalBuild: 'تنومند، سنگین‌وزن و استوار، با گردنی کلفت و سینه‌ای ستبر، قدم‌های کوبنده با حفظ تعادل جنگی و آمادگی شمشیرکشی',
      faceAndGaze: 'چهره‌ای سنگی و بی‌حالت، جای زخم قدیمی خنجر از زیر چشم چپ تا امتداد فک، ته ریش سیاه تیغ‌کشیده، چشمان سرد و بی‌پلک‌زدن',
      attire: 'جوشن چرمی میخ‌کوب‌شده روی پیراهن نمدی پادگانی، کمربند پهن سربازی با خنجر سنگین قمه و تبرزین دسته چوبی، ساق‌بندهای فلزی کدر',
      mannerisms: 'قرار دادن دائم کف دست راست روی قبضه قمه، اسکن مداوم صخره‌های بالادست و شکاف پشته‌ها بدون چرخاندن بالاتنه',
    },
    // 6. Parviz Kateb
    npc_parviz: {
      physicalBuild: 'باریک‌اندام، استخوانی و شکننده با شانه‌های جمع‌شده به سمت درون، گام‌های سریع، نامطمئن و شتاب‌زده',
      faceAndGaze: 'چهره‌ای رنگ‌پریده و مهتابی با چشمان میشی درشت و هراسان ناشی از کم‌خوابی، ریش کوتاه مرتب، لب‌های همیشه در حال نجوا',
      attire: 'ردای یشمی رنگ‌ورورفته با آستین‌های گشاد در مچ جمع‌شده، لکه‌های جوهر دوده بر سرانگشتان، بقچه‌ای مخملین بسته به دوش حاوی لوله‌های طومار',
      mannerisms: 'محکم فشردن بقچه طومارها به قفسه سینه، نگاه مضطرب به پشت سر و وحشت ناگهانی از صدای سم اسبان یا گزمه‌ها',
    },
    // 7. Farangis Pardeh-Neshin
    npc_farangis: {
      physicalBuild: 'اندامی ظریف، کشیده و باوقار، نشستی با قامت صاف و اشرافی حتی درون کجاوه‌های تاریک و تکان‌های تند شتر',
      faceAndGaze: 'پنهان در پشت نقاب حریر نازک سیاه؛ تنها چشمان نافذ، بادامی و عمیق سرمه‌کشیده‌اش پیداست که غمی کهنه و غروری سرد را بازمی‌تابانند',
      attire: 'چادر شب ابریشمی سرمه‌ای‌رنگ با بافت متراکم و تاریک، دستکش‌های حریر تیره با رد انگشتری عقیق، گردنبندی با آویز فیروزه زیر جامه',
      mannerisms: 'سکوت ممتد، کنار زدن گوشه پرده کجاوه تنها به اندازه پهنای دو انگشت، سخن گفتن با نوای نجواگونه فاخر و موجز',
    },
    // 8. Sarbanan-e Hiram (Group)
    npc_sarbanan_hiram: {
      physicalBuild: 'مردانی سخت‌کوش، لاغر و آفتاب‌سوخته با عضلات پیچیده و کشیده، اندام‌های ورزیده و خستگی‌ناپذیر هماهنگ با ریتم گام‌های شتر',
      faceAndGaze: 'صورت‌های پوشیده در دستارهای خاکی رس برای مهار طوفان شن، چشمان باریک و تیزبین، خطوط پوست چرمی و مقاوم به خشکی',
      attire: 'جامه‌های کرباس نخ‌نما به رنگ‌های خاکی و اخرایی با شال‌های دور کمر، پاپوش‌های تسمه‌پیچ چرمی، چوب‌دستی‌های باریک ساربانی',
      mannerisms: 'زمزمه‌های بم و کش‌دار حدی‌خوانی، بالا بردن هم‌زمان چوب‌دستی‌ها برای اعلام خطر یا تغییر جهت قطار شترها',
    },
    // 9. Qaravolan-e Caravan (Group)
    npc_qaravolan_caravan: {
      physicalBuild: 'مزدوران تنومند، خشن و استوار با جثه‌های پهن و بازوان ستبر، آرایش دفاعی در دو سوی قطار گاری‌ها',
      faceAndGaze: 'چهره‌های خسته اما هوشیار و دست‌به‌قبضه، دستمال‌های سیاه بسته دور پیشانی، چشمانی تیز و مشکوک به هر سایه در افق',
      attire: 'نیم‌تنه‌های چرم سخت یا زره‌های تیغه‌ای فلزی زنگارگرفته، کلاه‌خودهای ساده با گردن‌پوش زنجیری، نیزه‌های کوتاه و سپرهای گرد چوبی',
      mannerisms: 'تکیه بر تیرک ارابه‌ها در توقف‌ها، سرفه‌های خشک در گردوغبار، دست بر قبضه قمه یا غلاف کمان با نزدیک شدن مسافران ناشناس',
    },
  };

  let updatedCount = 0;
  for (const npc of npcs) {
    if (appearances[npc.id]) {
      npc.appearance = appearances[npc.id];
      updatedCount++;
    }
  }

  // Also check if npc_borzou exists or add it
  const hasBorzou = npcs.some((n: any) => n.id === 'npc_borzou' || n.name.includes('برزو'));
  if (!hasBorzou) {
    npcs.push({
      id: 'npc_borzou',
      name: 'برزو سنگ‌تراش',
      title: 'کاروان‌سالار کاروان شترهای سرخ هیرام',
      role: 'caravan_master',
      kind: 'individual',
      currentLocationId: 'loc_muzo9ij9_ycy6',
      applicableLocationIds: ['loc_muzo9ij9_ycy6', 'loc_rabat_sorkh', 'loc_mtr1h3jy_8dv6', 'loc_mtr2c3uu_yocj'],
      personalityTraits: ['دوراندیش', 'باصلابت', 'مسئولیت‌پذیر', 'دقیق در سنجش تراز بار'],
      speechStyle: 'صدایی بم، زنگ‌دار و کارآزموده با فریادهای کوتاه برای نظم دادن به ساربانان و تشویق چهارپایان',
      appearance: appearances.npc_borzou,
      goals: ['رساندن سلامت بارهای گندم و سنگ به بارانداز زرین‌پل', 'پیش‌دستی بر طوفان‌های سرخ بادیه'],
      secrets: [
        {
          id: 'sec_borzou_1',
          description: 'او پیش از کاروان‌داری یکی از سنگ‌تراشان محراب ارگ باختر بوده و کتیبه‌ای سنگی را از ارگ بیرون برده است',
          requiredTrustLevel: 30,
          revealed: false,
        },
      ],
      initialTrust: 5,
    });
    updatedCount++;
  } else {
    const b = npcs.find((n: any) => n.id === 'npc_borzou' || n.name.includes('برزو'));
    if (b) {
      b.id = 'npc_borzou';
      b.appearance = appearances.npc_borzou;
    }
  }

  // Also ensure trade route 1 has Borzou in travelingNpcIds
  for (const route of wb.tradeRoutes || []) {
    if (route.id === 'route_mv00dghz_fosto') {
      if (!route.travelingNpcIds.includes('npc_borzou')) {
        route.travelingNpcIds.unshift('npc_borzou');
      }
    }
  }

  manifest.worldBible = wb;

  await prisma.story.update({
    where: { id: 'story_mt4ofllt' },
    data: { manifest },
  });

  console.log(`✅ Successfully enriched ${updatedCount} NPCs with literary physical portraits in story_mt4ofllt manifest!`);

  // Sync to WorldBible record if present
  if (story.worldId) {
    const worldWb = await prisma.worldBible.findUnique({
      where: { worldId: story.worldId },
    });
    if (worldWb) {
      await prisma.worldBible.update({
        where: { id: worldWb.id },
        data: {
          npcs: wb.npcs as any,
          tradeRoutes: wb.tradeRoutes as any,
        },
      });
      console.log('✅ Synced to World worldBible:', worldWb.id);
    }
  }
}

main().catch(console.error).finally(() => process.exit(0));
