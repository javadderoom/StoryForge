import dotenv from 'dotenv';
dotenv.config();
process.env.ENABLE_DB = 'true';

import { getPrisma } from '../src/lib/db/client';
import { NPCDossier, WorldLocation, WorldTradeRoute } from '../src/lib/types/world';

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
  const wb = manifest.worldBible || {};

  // 1. Define New Locations
  const newLocations: WorldLocation[] = [
    {
      id: 'loc_rabat_sorkh',
      name: 'رباط سرخ',
      region: 'دشت هیرام (Hiram Plains)',
      description: 'آب‌انباری سنگی با دیوارهای خشت پخته و گنبدی سرخ‌فام در میانهٔ دشت خشک هیرام که پناهگاه شتربانان در طوفان‌های ریگ است.',
      category: 'settlement',
      dangerLevel: 2,
      atmosphere: 'خشک، بادگیر، بوی خاک گرم و سایهٔ خنک طاق‌های سنگی',
      connectedLocationIds: ['loc_muzo9ij9_ycy6', 'loc_mtr1h3jy_8dv6', 'loc_mtr2k2fz_gnqv'],
    },
    {
      id: 'loc_tangeh_niloufar',
      name: 'تنگهٔ نیلوفر',
      region: 'کوهپایه‌های ارژن',
      description: 'معبری باریک و مه‌آلود میان صخره‌های مرطوب که آبراهه‌های دریاچهٔ زمرد را به کرانه‌های زروان‌رود پیوند می‌دهد.',
      category: 'wilderness',
      dangerLevel: 2,
      atmosphere: 'مه‌آلود، بوی نی و سنگ مرطوب، صدای پایدار چکیدن قطرات آب',
      connectedLocationIds: ['loc_mtptnyfb_qb5k', 'loc_mtr2c3uu_yocj'],
    },
  ];

  // 2. Define New NPCs
  const newNpcs: NPCDossier[] = [
    {
      id: 'npc_farrokhzad',
      name: 'فرخزاد نمک‌چین',
      title: 'استخراج‌کنندهٔ معادن سپیدچال و ناظر بارهای نمک',
      role: 'artisan',
      kind: 'individual',
      currentLocationId: 'loc_mv0qancl_iked',
      applicableLocationIds: ['loc_mv0qancl_iked', 'loc_mv00yw4l_lbqn', 'loc_mtr1h3jy_8dv6'],
      personalityTraits: ['دقیق', 'محتاط', 'دلواپس رطوبت بار', 'متنفر از باج‌خواهی گزمه‌ها'],
      speechStyle: 'لهجهٔ خاکی هیرام، شمرده و نگران، با تأکید مداوم بر حفظ سلامت بلورهای نمک و مراقبت در برابر باران و گل',
      goals: ['رساندن سالم بارهای سنگ‌نمک به انبارهای خاوران', 'جلوگیری از کسر وزن نمک توسط مأموران خراج'],
      secrets: [
        {
          id: 'sec_farrokhzad_1',
          description: 'در کف یکی از ارابه‌ها بلورهای خالص نمک حاوی رگه‌های گوگرد پنهان شده که برای کیمیاگری کاربرد دارد',
          requiredTrustLevel: 25,
          revealed: false,
        },
      ],
      initialTrust: 0,
    },
    {
      id: 'npc_sohrab',
      name: 'سهراب چوب‌دست',
      title: 'دیده‌بان و محافظ کاروان در گردنهٔ بادپناه',
      role: 'guard',
      kind: 'individual',
      currentLocationId: 'loc_mv00yw4l_lbqn',
      applicableLocationIds: ['loc_mv00yw4l_lbqn', 'loc_mtr1h3jy_8dv6'],
      personalityTraits: ['هوشیار', 'کم‌حرف', 'محتاط در برابر کمین‌گاه‌ها', 'وفادار به دستمزد'],
      speechStyle: 'کوتاه، خشن و نظامی؛ با نگاه دائم به عوارض زمین، بادگیرها و شکاف صخره‌ها',
      goals: ['حفظ امنیت بارهای کاروان در برابر راهزنان بادپناه', 'رسیدن سالم به بارانداز و دریافت سهم نقره'],
      secrets: [
        {
          id: 'sec_sohrab_1',
          description: 'او رد پای شبیخون‌زنانی را در گردنهٔ بادپناه دیده که پرچم‌های بدون نشان بر نیزه دارند',
          requiredTrustLevel: 30,
          revealed: false,
        },
      ],
      initialTrust: 0,
    },
    {
      id: 'npc_bahram',
      name: 'بهرام دشت‌بان',
      title: 'مهاردار شتران سرخ چاه سنگ',
      role: 'drover',
      kind: 'individual',
      currentLocationId: 'loc_muzo9ij9_ycy6',
      applicableLocationIds: ['loc_muzo9ij9_ycy6', 'loc_rabat_sorkh', 'loc_mtr1h3jy_8dv6'],
      personalityTraits: ['پرانرژی', 'مهربان با حیوانات', 'خرافاتی در مورد ارواح بیابان', 'سریع در بستن مهار'],
      speechStyle: 'پرتکاپو، آمیخته با سوت‌ها و اصطلاحات ساربانی، با کلماتی مقطع برای آرام کردن شترهای وحشی',
      goals: ['رساندن سلامت ماده‌شترهای سرخ به بازار دام زرین پل', 'جلوگیری از رمیدن حیوانات در بوی تعفن لجن‌زار'],
      secrets: [
        {
          id: 'sec_bahram_1',
          description: 'یکی از شتران سرخ حیوانی دست‌آموز متعلق به یکی از سرداران فراری هیرام است',
          requiredTrustLevel: 20,
          revealed: false,
        },
      ],
      initialTrust: 0,
    },
    {
      id: 'npc_maziar',
      name: 'مازیار مشک‌دار',
      title: 'آب‌رسان و راهنمای پایاب‌های خشک هیرام',
      role: 'guide',
      kind: 'individual',
      currentLocationId: 'loc_rabat_sorkh',
      applicableLocationIds: ['loc_rabat_sorkh', 'loc_mtr1h3jy_8dv6'],
      personalityTraits: ['صبور', 'شوخ‌طبع', 'سخت‌جان', 'عاشق چشمه‌های زیرزمینی'],
      speechStyle: 'آرام، نجیب و کنایه‌آمیز؛ فاصله‌ها را با پیمانه‌های آب می‌سنجد و به حرص دیگران برای طلا می‌خندد',
      goals: ['تأمین آب گوارا برای کاروانیان تا پایان معبر', 'شناسایی سفره‌های آب پاک در حاشیهٔ زروان‌رود'],
      secrets: [
        {
          id: 'sec_maziar_1',
          description: 'او معبری خشک در دل بستر باستانی رود می‌شناسد که در مه شبانه بدون دیده شدن از پل عبور می‌کند',
          requiredTrustLevel: 35,
          revealed: false,
        },
      ],
      initialTrust: 0,
    },
    {
      id: 'npc_parviz',
      name: 'پرویز کاتب',
      title: 'نسخه‌خوان و راوی طومارهای کهن دریاچهٔ زمرد',
      role: 'scholar',
      kind: 'individual',
      currentLocationId: 'loc_mtptnyfb_qb5k',
      applicableLocationIds: ['loc_mtptnyfb_qb5k', 'loc_tangeh_niloufar', 'loc_mtr2c3uu_yocj'],
      personalityTraits: ['مضطرب', 'کتاب‌خوان', 'محتاط در گفت‌وگو با غریبه‌ها', 'عاشق تاریخ باستان'],
      speechStyle: 'نجواگونه، کتابی، با وسواس در به‌کارگیری کلمات؛ مدام به اطراف می‌نگرد مبادا کسی گوش ایستاده باشد',
      goals: ['رساندن طومارهای خطی ارژنگ و الواح نجومی به کتابخانهٔ باختر', 'گریز از بازرسی کاتبان دیوان تفتیش'],
      secrets: [
        {
          id: 'sec_parviz_1',
          description: 'طوماری که با خود حمل می‌کند نقشه‌ای مخفی از معابد غرق‌شده در اعماق دریاچهٔ زمرد است',
          requiredTrustLevel: 40,
          revealed: false,
        },
      ],
      initialTrust: 0,
    },
    {
      id: 'npc_farangis',
      name: 'فرنگیس پرده‌نشین',
      title: 'مسافر ناشناس و تحت تعقیب در کجاوه‌های تاریک',
      role: 'fugitive',
      kind: 'individual',
      currentLocationId: 'loc_tangeh_niloufar',
      applicableLocationIds: ['loc_tangeh_niloufar', 'loc_mtr2c3uu_yocj'],
      personalityTraits: ['باوقار', 'پنهان‌کار', 'رنج‌دیده', 'محتاط و هراسان از نور مشعل‌ها'],
      speechStyle: 'آهسته، فاخر و محزون؛ تنها از پشت پرده‌های کجاوه‌ها و هنگامی که غریبه‌ها حضور ندارند لب به سخن می‌گشاید',
      goals: ['عبور بی‌سر‌وصدا از ایستگاه بازرسی پل زروان بدون باز شدن نقابش', 'رسیدن به معبد خاوران برای طلب پناهندگی'],
      secrets: [
        {
          id: 'sec_farangis_1',
          description: 'او دختر یکی از اشراف‌زادگان خلع‌شدهٔ باختر است که حکم اعدام غیابی او از سوی دارالحکومه صادر شده است',
          requiredTrustLevel: 45,
          revealed: false,
        },
      ],
      initialTrust: -5,
    },
    // Cohort / Group NPCs
    {
      id: 'npc_sarbanan_hiram',
      name: 'ساربانان هیرام',
      title: 'کارگران، ساربانان و مهارداران شتران سرخ کاروان',
      role: 'drover',
      kind: 'template',
      currentLocationId: 'loc_muzo9ij9_ycy6',
      applicableLocationIds: ['loc_muzo9ij9_ycy6', 'loc_rabat_sorkh', 'loc_mtr1h3jy_8dv6', 'loc_mtr2c3uu_yocj'],
      personalityTraits: ['سخت‌کوش', 'کم‌حرف', 'بدبین به گزمه‌ها', 'همبسته در دفاع از یکدیگر'],
      speechStyle: 'همهمهٔ خشن، تکیه‌کلام‌های ساربانی هیرام، اخطار به بیگانگان برای فاصله گرفتن از بارهای سنگین',
      goals: ['تغذیه و تیمار شترها', 'تخلیه بار در بارانداز و دریافت مزد روزمزد'],
      secrets: [],
      initialTrust: 0,
    },
    {
      id: 'npc_qaravolan_caravan',
      name: 'قراولان کاروان',
      title: 'مزدوران مسلح و قراولان شب‌زنده‌دار کاروان‌های تجاری',
      role: 'guard',
      kind: 'template',
      currentLocationId: 'loc_mv0qancl_iked',
      applicableLocationIds: ['loc_mv0qancl_iked', 'loc_mv00yw4l_lbqn', 'loc_mtr1h3jy_8dv6'],
      personalityTraits: ['هوشیار', 'خسته از راه', 'دست‌به‌قبضه', 'بی‌اعتنا به مسافران عادی'],
      speechStyle: 'دستورهای کوتاه، غرش‌های نگهبانی، سرفه‌های ناشی از گردوخاک و اخطار به نزدیک‌شوندگان',
      goals: ['حفاظت از صندوق‌ها و گاری‌ها تا تحویل به انباردار ارگ', 'جلوگیری از دستبرد دزدان در گرگ‌ومیش'],
      secrets: [],
      initialTrust: 0,
    },
  ];

  // Merge Locations
  const existingLocIds = new Set((wb.locations || []).map((l: any) => l.id));
  for (const loc of newLocations) {
    if (!existingLocIds.has(loc.id)) {
      wb.locations.push(loc);
      existingLocIds.add(loc.id);
    }
  }

  // Update connected locations
  const chahSang = wb.locations.find((l: any) => l.id === 'loc_muzo9ij9_ycy6');
  if (chahSang && !chahSang.connectedLocationIds.includes('loc_rabat_sorkh')) {
    chahSang.connectedLocationIds.push('loc_rabat_sorkh');
  }
  const emeraldLake = wb.locations.find((l: any) => l.id === 'loc_mtptnyfb_qb5k');
  if (emeraldLake && !emeraldLake.connectedLocationIds.includes('loc_tangeh_niloufar')) {
    emeraldLake.connectedLocationIds.push('loc_tangeh_niloufar');
  }

  // Merge NPCs
  const existingNpcIds = new Set((wb.npcs || []).map((n: any) => n.id));
  for (const npc of newNpcs) {
    if (!existingNpcIds.has(npc.id)) {
      wb.npcs.push(npc);
      existingNpcIds.add(npc.id);
    } else {
      const idx = wb.npcs.findIndex((n: any) => n.id === npc.id);
      wb.npcs[idx] = npc;
    }
  }

  // Update Trade Routes travelingNpcIds & intermediateLocationIds
  for (const route of wb.tradeRoutes || []) {
    if (route.id === 'route_mv0qm4v5_aohv2') {
      // Salt Caravan: Sepid-Chal - Zarrin-Pol
      route.travelingNpcIds = ['npc_farrokhzad', 'npc_sohrab', 'npc_qaravolan_caravan'];
      if (!route.intermediateLocationIds) route.intermediateLocationIds = [];
      if (!route.intermediateLocationIds.includes('loc_mv00yw4l_lbqn')) {
        route.intermediateLocationIds.push('loc_mv00yw4l_lbqn');
      }
    } else if (route.id === 'route_mv00dghz_fosto') {
      // Camel Caravan: Chah-Sang - Zarrin-Pol
      route.travelingNpcIds = ['npc_bahram', 'npc_maziar', 'npc_sarbanan_hiram'];
      if (!route.intermediateLocationIds) route.intermediateLocationIds = [];
      if (!route.intermediateLocationIds.includes('loc_rabat_sorkh')) {
        route.intermediateLocationIds.push('loc_rabat_sorkh');
      }
    } else if (route.id === 'route_mv0umx9a_ebcfd') {
      // Emerald Lake - Zarrin-Pol / Shakhe Zarrin Caravanserai
      route.travelingNpcIds = ['npc_parviz', 'npc_farangis'];
      if (!route.intermediateLocationIds) route.intermediateLocationIds = [];
      if (!route.intermediateLocationIds.includes('loc_tangeh_niloufar')) {
        route.intermediateLocationIds.push('loc_tangeh_niloufar');
      }
    }
  }

  manifest.worldBible = wb;

  await prisma.story.update({
    where: { id: 'story_mt4ofllt' },
    data: { manifest },
  });

  console.log('Successfully updated story manifest with 6 individual NPCs, 2 group NPCs, 2 way-stations, and linked caravan travel routes!');
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
