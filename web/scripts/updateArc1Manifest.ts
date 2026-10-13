import dotenv from 'dotenv';
dotenv.config();
process.env.ENABLE_DB = 'true';

import { getPrisma } from '../src/lib/db/client';

async function main() {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error('Database not configured');
  }

  const story = await prisma.story.findUnique({
    where: { id: 'story_mt4ofllt' },
  });

  if (!story) {
    throw new Error('Story story_mt4ofllt not found');
  }

  const manifest = story.manifest as any;

  // 1. Update initial scene ID
  manifest.initialSceneId = 'scene_hiram_trail_01';

  // 2. Update initial story beat (Prologue on the Hiram Trail)
  manifest.initialStoryBeats = [
    {
      sceneId: 'scene_hiram_trail_01',
      chapterId: 'act_mtw24uoe_q9q4',
      locationId: 'loc_muzo9ij9_ycy6',
      choices: [],
      narrativeText:
        'سپیده‌دم بر فراز بادیهٔ هیرام شکافته می‌شود؛ نوار باریکی از روشنایی زرین و سرخ‌فام بر پهنهٔ تپه‌ماهورهای خشک، صخره‌های بادخورده و بوته‌های تنک خاربُن می‌گسترد. بادی سرد و گزنده از سوی کوهسار باختر بر خاک سرخ می‌وزد و غبار جاده را تا ساق پا بالا می‌کشد.\n\nپیش رویت، در میان خاک و خاشاک دشت، صف طویل کاروان شترهای سرخ هیرام به راه افتاده است. زنگ‌های درای برنزی که از گردن شترهای پیشاهنگ آویخته‌اند، در هماهنگی با گام‌های سنگین و خستگی‌ناپذیر حیوانات طنینی بم و یکدست در فضای دشت می‌اندازند—آوایی که قرن‌هاست نشان حیات در این خاک بی‌آب است. بوی خاک داغ، پشم نم‌کشیدهٔ چهارپایان، بار چرم، و دود خاکستریِ آخرین خارهای سوزانده‌شده در آتشگاه شب گذشته، مشام را پر می‌کند.\n\nکاروان‌سالار برزو سنگ‌تراش، مردی جاافتاده و آفتاب‌سوخته با ردایی تیره از پشم ضخیم، پیشاپیش مهار شتر پیشرو را در دست دارد. او در حال تنظیم تنگ و تسمهٔ بارهای سنگین سنگ و غلات است و زیر لب ساربانان را با فریادی کوتاه و کارآزموده به پیش می‌خواند:\n«پایین دره هنوز بادِ سرخ ننشسته! قدم‌ها رو سست نکنید... تا آفتاب به نیمهٔ آسمون برسه باید به حوالی رباط سرخ نزدیک بشیم. بادیه با کسی که تعلل کنه شوخی نداره.»\n\nکمی عقب‌تر، بهرام دشت‌بان با چوب‌دستی بلندش میان شترها گام برمی‌دارد و نعل و سم حیوانات را بررسی می‌کند، در حالی که مازیار مشک‌دار با چند مشک آبِ بسته‌شده به یال شترها، دهان کاروانیان را با جرعه‌ای آب خنک تازه می‌کند و ساربانان هیرام با نوای آرام حدی‌خوانی، کاروان را در شیار جاده هدایت می‌کنند.\n\nافق دشت هیرام پیش روی شما باز است؛ فرسنگ‌ها راه در خاک بیابان تا رسیدن به ایستگاه رباط سرخ و سرانجام سرازیر شدن به درهٔ زروان‌رود و باراندازهای پررونق زرین‌پل. خطرات راه—از طوفان‌های ریگ و گزندگان بیابان تا شیب‌های سنگلاخی—همچنان در کمین‌اند، اما کاروان هم‌اکنون در پناه هوشیاری همراهانش گام به دل جاده گذاشته است.',
    },
  ];

  // 3. Update Saga Chapter 1 (Arc 1: The Caravan in the Hiram Wilderness)
  const chapters = manifest.saga?.chapters || [];
  const arc1Index = chapters.findIndex((c: any) => c.id === 'act_mtw24uoe_q9q4' || c.chapterNumber === 1);

  const updatedArc1 = {
    id: 'act_mtw24uoe_q9q4',
    chapterNumber: 1,
    title: 'پرده ۱: کاروان در بادیهٔ هیرام',
    scopeTier: 'wilderness',
    narrativeGoal:
      'همراهی و هدایت کاروان در گسترهٔ خشک و ناهموار دشت هیرام، رویارویی با خطرات جاده و پدیده‌های کویر (طوفان‌های سرخ، جانوران بادیه، کمبود آب و انتخاب معابر)، پشت سر گذاشتن ایستگاه‌های بین‌راهی (رباط سرخ)، و رساندن کاروان به سلامت به بارانداز کاروانسرای شاخ زرین و دروازه‌های گشودهٔ زرین‌پل.',
    completionSummaryPrompt:
      'پایان موفقیت‌آمیز گذر از بادیهٔ هیرام و رسیدن کاروان به کاروانسرای شاخ زرین در کرانهٔ زروان‌رود با دروازه‌های باز شهر.',
    prerequisiteFlags: [],
    scenes: [],
    stages: [
      {
        id: 'stage_mtxbgel0_d0cc',
        order: 1,
        stageType: 'inciting_incident',
        title: 'آغاز سفر — حرکت از چاه سنگ به دل بادیه',
        description:
          'کاروان شترهای سرخ و مسافران، اتراق‌گاه چاه سنگ را ترک کرده و پا به پهنهٔ گسترده و بادگیر دشت هیرام می‌گذارند. آشنایی با همراهان، بررسی توشه و سلاح‌ها، و قرار گرفتن در صف پیش‌قراولان یا حامیان کاروان در نخستین فرسنگ‌های راه.',
      },
      {
        id: 'stage_mtxbgel0_5knz',
        order: 2,
        stageType: 'rising_action',
        title: 'آزمون‌های راه — دشت‌های بی‌حاصل و اتراق در رباط سرخ',
        description:
          'پیشروی در خاک‌های فرسایندهٔ هیرام و مواجهه با پدیده‌های بیابان (ردپای جانوران درنده و گزندگان کویر، طوفان‌های غبار سرخ، یا عارضه‌های زمین‌شناسی)، رسیدن به آب‌انبار خشتی رباط سرخ برای توقف، آب‌گیری، تبادل اخبار و حل تنش‌های میان مسافران.',
      },
      {
        id: 'stage_mtxbgel0_sm3g',
        order: 3,
        stageType: 'climax',
        title: 'گذرگاه پرمخاطره — پشته‌های باختری و آزمون نهایی بادیه',
        description:
          'گذر از دشوارترین بخش مسیر در شیب‌ها و پشته‌های ناهموار غربی هیرام پیش از سرازیر شدن به درهٔ زروان‌رود؛ تصمیم‌گیری دربارهٔ مسیرهای میان‌بر یا امن، نجات کاروان از رانش ریگ یا درندگان شب، و اثبات شایستگی به عنوان حافظ و راهنمای کاروان.',
      },
      {
        id: 'stage_mtxbgel0_n913',
        order: 4,
        stageType: 'resolution',
        title: 'پایان بادیه — فرود به درهٔ زروان‌رود و بارانداز شاخ زرین',
        description:
          'افق کویر جای خود را به درهٔ رودخانه می‌دهد. پهنهٔ پرآب زروان‌رود و هیبت سنگی زرین‌پل در افق پدیدار می‌شود. کاروان با بارهای سالم وارد محوطهٔ باز کاروانسرای شاخ زرین می‌شود؛ دروازه‌های شهر باز و شرایط عادی است و راه برای ورود به بازارچه و ماجراهای درون شهر گشوده می‌گردد.',
      },
    ],
  };

  if (arc1Index >= 0) {
    chapters[arc1Index] = updatedArc1;
  } else {
    chapters.unshift(updatedArc1);
  }

  manifest.saga = {
    ...(manifest.saga || {}),
    chapters,
  };

  // 4. Ensure trade routes point to the appropriate origin and destinations
  if (Array.isArray(manifest.worldBible?.tradeRoutes)) {
    const mainCaravan = manifest.worldBible.tradeRoutes.find((r: any) => r.id === 'route_mv00dghz_fosto');
    if (mainCaravan) {
      mainCaravan.originLocationId = 'loc_muzo9ij9_ycy6';
      mainCaravan.destinationLocationId = 'loc_mtr2c3uu_yocj';
    }
  }

  // 5. Save updated manifest to Prisma database
  await prisma.story.update({
    where: { id: 'story_mt4ofllt' },
    data: {
      manifest,
    },
  });

  console.log('✅ Arc 1 and Opening Scene successfully updated for story_mt4ofllt!');
  console.log('InitialSceneId:', manifest.initialSceneId);
  console.log('InitialBeat locationId:', manifest.initialStoryBeats[0].locationId);
  console.log('Chapter 1 title:', manifest.saga.chapters[0].title);
  console.log('Chapter 1 scope:', manifest.saga.chapters[0].scopeTier);
  console.log('Stages count:', manifest.saga.chapters[0].stages.length);
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
