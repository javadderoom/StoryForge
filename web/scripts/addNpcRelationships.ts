import dotenv from 'dotenv';
dotenv.config();
process.env.ENABLE_DB = 'true';

import { getPrisma } from '../src/lib/db/client';
import { NPCDramaBond } from '../src/lib/types/world';

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
  if (!wb.npcs) wb.npcs = [];
  if (!wb.dramaBonds) wb.dramaBonds = [];

  // ==========================================
  // 1. UPDATE NPC SECRETS & GOALS
  // ==========================================

  // 1.1. Borzou Zangband (npc_borzou)
  const borzou = wb.npcs.find((n: any) => n.id === 'npc_borzou');
  if (borzou) {
    const borzouSecret = (borzou.secrets || []).find((s: any) => s.id === 'secret_mv0yzp76');
    const updatedDesc =
      'یکی از شترهای ماده‌اش حامِل کالای قاچاق نیست، بلکه حامل یک کودک فراری از خاندانی محکوم در غرب است که قصد دارد او را دور از چشم کاتبان به محله‌های فقیرنشین پایاب برساند تا از طریق «ناخدا شیرو لجن‌پا» با بلم از آبراهه به بیرون قاچاق شود یا تحت پناه و نظارت «پیربزرگ کاوه» (ریش‌سفید سنگ‌تراشان و معتمد بومیان) مخفی گردد.';
    if (borzouSecret) {
      borzouSecret.description = updatedDesc;
    } else {
      if (!borzou.secrets) borzou.secrets = [];
      borzou.secrets.push({
        id: 'secret_mv0yzp76',
        description: updatedDesc,
        revealed: false,
        requiredTrustLevel: 70,
        revealMethods: [],
      });
    }
  }

  // 1.2. Farrokhzad Namakchin (npc_farrokhzad)
  const farrokhzad = wb.npcs.find((n: any) => n.id === 'npc_farrokhzad');
  if (farrokhzad) {
    const farrokhzadSecret = (farrokhzad.secrets || []).find((s: any) => s.id === 'sec_farrokhzad_1');
    const updatedDesc =
      'در کف یکی از ارابه‌ها بلورهای خالص نمک حاوی رگه‌های گوگرد پنهان شده که برای کیمیاگری و ساخت اکسیرهای تند به کار می‌رود؛ خریدار مخفی این بار «ماه‌بانو دل‌آشوب» (کیمیاگر و زهرشناس بازارچه) است و پول آن باید از طریق «بانو تهمینه سیمین‌سنج» (صراف ارشد) نقد شود.';
    if (farrokhzadSecret) {
      farrokhzadSecret.description = updatedDesc;
    } else {
      if (!farrokhzad.secrets) farrokhzad.secrets = [];
      farrokhzad.secrets.push({
        id: 'sec_farrokhzad_1',
        description: updatedDesc,
        revealed: false,
        requiredTrustLevel: 25,
      });
    }
  }

  // 1.3. Ostad Pirooz (npc_mv0uzcpc)
  const pirooz = wb.npcs.find((n: any) => n.id === 'npc_mv0uzcpc');
  if (pirooz) {
    const piroozSecret = (pirooz.secrets || []).find((s: any) => s.id === 'secret_mv0z1you');
    const updatedDesc =
      'لای برخی از توبره‌های نمک، تکه‌هایی از «بلور نمک فیروزه» پنهان کرده است؛ سنگ‌های قیمتی و نایابی که «ماه‌بانو دل‌آشوب» به عنوان تثبیت‌کنندهٔ سموم خریدار آن‌هاست و «بانو تهمینه سیمین‌سنج» برای نقد کردن و تبدیلشان به شمش نقره با او تبانی دارد.';
    if (piroozSecret) {
      piroozSecret.description = updatedDesc;
    } else {
      if (!pirooz.secrets) pirooz.secrets = [];
      pirooz.secrets.push({
        id: 'secret_mv0z1you',
        description: updatedDesc,
        revealed: false,
        requiredTrustLevel: 70,
        revealMethods: [{ kind: 'pressure' }],
      });
    }
  }

  // 1.4. Parviz Kateb (npc_parviz)
  const parviz = wb.npcs.find((n: any) => n.id === 'npc_parviz');
  if (parviz) {
    const parvizSecret = (parviz.secrets || []).find((s: any) => s.id === 'sec_parviz_1');
    const updatedDesc =
      'طوماری که با خود حمل می‌کند نقشه‌ای مخفی از معابد غرق‌شده در اعماق دریاچهٔ زمرد است؛ او در پی رساندن این نقشه و الواح خطی به «موبد هیربد» در دکهٔ کتیبه‌خوانی است، در حالی که «دادرس مهرداد کاتب» با شک به ارتداد طومارها، او را زیر نظر دارد.';
    if (parvizSecret) {
      parvizSecret.description = updatedDesc;
    } else {
      if (!parviz.secrets) parviz.secrets = [];
      parviz.secrets.push({
        id: 'sec_parviz_1',
        description: updatedDesc,
        revealed: false,
        requiredTrustLevel: 40,
      });
    }
    parviz.goals = [
      'رساندن طومارهای خطی ارژنگ و الواح نجومی به دست موبد هیربد جهت بازخوانی کتیبه‌ها',
      'گریز از بازرسی کاتبان دیوان تفتیش و چنگال دادرس مهرداد کاتب',
    ];
  }

  // 1.5. Maziar Mashkdar (npc_maziar)
  const maziar = wb.npcs.find((n: any) => n.id === 'npc_maziar');
  if (maziar) {
    const maziarSecret = (maziar.secrets || []).find((s: any) => s.id === 'sec_maziar_1');
    const updatedDesc =
      'او معبری خشک در دل بستر باستانی رود می‌شناسد که در مه شبانه بدون دیده شدن از پل عبور می‌کند؛ این راهِ گریز با همکاری «برادران بلم‌ران هور» در لجن‌زار و شبکهٔ «کاروان‌سالار رادمان دشت‌پیما» در شاخ زرین، مسیری برای دور زدن گیت‌های تفتیش است.';
    if (maziarSecret) {
      maziarSecret.description = updatedDesc;
    } else {
      if (!maziar.secrets) maziar.secrets = [];
      maziar.secrets.push({
        id: 'sec_maziar_1',
        description: updatedDesc,
        revealed: false,
        requiredTrustLevel: 35,
      });
    }
    maziar.goals = [
      'تأمین آب گوارا برای کاروانیان تا پایان معبر',
      'هماهنگی با برادران بلم‌ران هور و شبکهٔ رادمان دشت‌پیما برای گریز شبانه از ایستگاه‌های تفتیش',
    ];
  }

  // ==========================================
  // 2. DEFINE NEW DRAMA BONDS
  // ==========================================

  const newDramaBonds: NPCDramaBond[] = [
    // 2.1. Borzou -> Shiroo & Kaveh
    {
      id: 'bond_borzou_shiro',
      sourceNpcId: 'npc_borzou',
      targetNpcId: 'npc_mtreh7m3',
      relationTypeId: 'ally',
      affinity: 65,
      isPublic: false,
      secretTension:
        'برزو برای قاچاق و خروج شبانهٔ کودک فراری از مسیر آبراه‌های پایاب به بلم‌های ناخدا شیرو لجن‌پا وابسته است؛ شیرو در ازای این خطر، قول سهمی از شترهای باری مرغوب هیرام را گرفته است.',
    },
    {
      id: 'bond_borzou_kaveh',
      sourceNpcId: 'npc_borzou',
      targetNpcId: 'npc_mtrjesl0',
      relationTypeId: 'ally',
      affinity: 75,
      isPublic: false,
      secretTension:
        'پیربزرگ کاوه به عنوان ریش‌سفید سنگ‌تراشان و معتمد بومیان، برزو را امین خود می‌داند و مخفیگاهی امن در میان کارگاه‌های سنگی پایاب برای پناه دادن به کودک فراری فراهم کرده است.',
    },

    // 2.2. Farrokhzad -> Mahbanoo Delashoob & Banoo Tahmineh
    {
      id: 'bond_farrokhzad_dalashoub',
      sourceNpcId: 'npc_farrokhzad',
      targetNpcId: 'npc_mtshsc58',
      relationTypeId: 'ally',
      affinity: 60,
      isPublic: false,
      secretTension:
        'فرخزاد نمک‌چین بلورهای خالص نمک گوگردی را به سفارش مستقیم ماه‌بانو دل‌آشوب قاچاق می‌کند تا در ساخت زهرها و ترکیبات کیمیاگری نامتعارف بازارچه استفاده شود.',
    },
    {
      id: 'bond_farrokhzad_tahmineh',
      sourceNpcId: 'npc_farrokhzad',
      targetNpcId: 'npc_mtrk813x',
      relationTypeId: 'custom',
      affinity: 55,
      isPublic: false,
      secretTension:
        'فرخزاد پیش از رسیدن به باج‌گاه پل، حواله‌های نمک قاچاق خود را نزد بانو تهمینه سیمین‌سنج نقد می‌کند تا مالیات سنگین دیوان خراج بر نقره‌هایش اعمال نشود.',
    },

    // 2.3. Ostad Pirooz -> Mahbanoo Delashoob & Banoo Tahmineh
    {
      id: 'bond_pirooz_dalashoub',
      sourceNpcId: 'npc_mv0uzcpc',
      targetNpcId: 'npc_mtshsc58',
      relationTypeId: 'custom',
      affinity: 60,
      isPublic: false,
      secretTension:
        'استاد پیروز بلورهای قیمتی نمک فیروزه را به ماه‌بانو دل‌آشوب می‌رساند؛ ماده‌ای نادر که دل‌آشوب برای خنثی‌سازی زرداب و نگهداری سموم بیابان به آن محتاج است.',
    },
    {
      id: 'bond_pirooz_tahmineh',
      sourceNpcId: 'npc_mv0uzcpc',
      targetNpcId: 'npc_mtrk813x',
      relationTypeId: 'custom',
      affinity: 50,
      isPublic: false,
      secretTension:
        'بانو تهمینه سیمین‌سنج به ارزش واقعی نمک‌های فیروزهٔ پیروز واقف است و با ثبت بدهی‌های صوری کاروان، بهای سنگ‌ها را با شمش نقره به او پرداخت می‌کند.',
    },

    // 2.4. Parviz Kateb -> Moobed Hirbod & Dadras Mehrdad
    {
      id: 'bond_parviz_hirbod',
      sourceNpcId: 'npc_parviz',
      targetNpcId: 'npc_mtsh4zlo',
      relationTypeId: 'ally',
      affinity: 80,
      isPublic: false,
      secretTension:
        'موبد هیربد در دکهٔ کتیبه‌خوانی چشم‌انتظار رسیدن پرویز کاتب است تا با استفاده از نقشهٔ معابد غرق‌شدهٔ دریاچهٔ زمرد، کتیبه‌های باستانی زروان‌رود را پیش از نابودی نجات دهند.',
    },
    {
      id: 'bond_parviz_mehrdad',
      sourceNpcId: 'npc_parviz',
      targetNpcId: 'npc_mtr4uw76_bxlj',
      relationTypeId: 'rival',
      affinity: -70,
      isPublic: true,
      secretTension:
        'دادرس مهرداد کاتب به طومارهای پنهان‌شده در انبان پرویز مشکوک شده و او را در سیاههٔ مظنونان به حمل اسناد ضالّه و ارتداد قرار داده تا هنگام عبور از پل به حبس بکشد.',
    },

    // 2.5. Maziar Mashkdar -> Radman Dashtpeima & Baradaran-e Balamran-e Hoor
    {
      id: 'bond_maziar_radman',
      sourceNpcId: 'npc_maziar',
      targetNpcId: 'npc_mtsi0ubl',
      relationTypeId: 'ally',
      affinity: 70,
      isPublic: false,
      secretTension:
        'مازیار مشک‌دار و رادمان دشت‌پیما در شاخ زرین شبکه‌ای مخفی تشکیل داده‌اند؛ مازیار کاروان‌های تحت فشار را از معبر خشک بستر باستانی رود به بارانداز رادمان می‌رساند تا از پرداخت باج و تفتیش خلاص شوند.',
    },
    {
      id: 'bond_maziar_balamran',
      sourceNpcId: 'npc_maziar',
      targetNpcId: 'npc_mtslvt8c_jyil',
      relationTypeId: 'ally',
      affinity: 65,
      isPublic: false,
      secretTension:
        'برادران بلم‌ران هور معبرهای لجن‌زاری متصل به بستر باستانی رود را با نشانه‌های رمزی برای مازیار خلوت نگه می‌دارند تا کاروان بدون برخورد با قایق‌های گشتی عبور کند.',
    },
  ];

  // Merge into dramaBonds by id
  for (const bond of newDramaBonds) {
    const existingIdx = wb.dramaBonds.findIndex((b: any) => b.id === bond.id);
    if (existingIdx >= 0) {
      wb.dramaBonds[existingIdx] = bond;
    } else {
      wb.dramaBonds.push(bond);
    }
  }

  manifest.worldBible = wb;

  // 3. Save Story manifest
  await prisma.story.update({
    where: { id: storyId },
    data: { manifest },
  });

  // 4. Also update the dedicated world_bibles table row
  const wbRow = await prisma.worldBible.findFirst({
    where: { storyId },
  });

  if (wbRow) {
    await prisma.worldBible.update({
      where: { id: wbRow.id },
      data: {
        npcs: wb.npcs as any,
        dramaBonds: wb.dramaBonds as any,
      },
    });
  }

  console.log(`✅ Successfully added ${newDramaBonds.length} new NPC drama bonds and updated secrets/goals!`);
  console.log(`Total drama bonds now: ${wb.dramaBonds.length}`);
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
