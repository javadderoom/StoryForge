import type { EntityType } from './ActionProtocol.types';

export const PERSIAN_FIELD_MAP: Record<string, string> = {
  'نام': 'name',
  'عنوان': 'title',
  'لقب': 'title',
  'شرح': 'description',
  'توصیف': 'description',
  'توضیح': 'description',
  'توضیحات': 'description',
  'شرح مکان و ظاهر': 'description',
  'شرح مکان': 'description',
  'ناحیه': 'region',
  'منطقه': 'region',
  'ناحیه / منطقه': 'region',
  'سطح خطر': 'dangerLevel',
  'سطح_خطر': 'dangerLevel',
  'خطر': 'dangerLevel',
  'فضاسازی': 'atmosphere',
  'فضاسازی و لحن': 'atmosphere',
  'لحن': 'atmosphere',
  'جو': 'atmosphere',
  'اتمسفر': 'atmosphere',
  'دسته‌بندی': 'category',
  'دستهبندی': 'category',
  'دسته‌بندی مکان': 'category',
  'دستهبندی مکان': 'category',
  'دسته': 'category',
  'والد': 'parentLocationName',
  'مکان والد': 'parentLocationName',
  'موقعیت بالادست': 'parentLocationName',
  'موقعیت بالادست / در بر گیرنده': 'parentLocationName',
  'در بر گیرنده': 'parentLocationName',
  'قوانین خاص': 'specialRules',
  'قوانین خاص مکان': 'specialRules',
  'قوانین ویژه': 'specialRules',
  'قوانین ویژه مکان': 'specialRules',
  'قوانین مکان': 'specialRules',
  'قوانین': 'specialRules',
  'قلمرو': 'territoryIds',
  'قلمروها': 'territoryIds',
  'اهداف علنی': 'publicGoals',
  'اهداف': 'publicGoals',
  'دستور کار پنهان': 'secretAgendas',
  'اهداف پنهان': 'secretAgendas',
  'گرایش': 'alignment',
  'نقش': 'role',
  'گونه': 'speciesCategory',
  'دسته موجود': 'speciesCategory',
  'حوزه': 'domain',
  'قلمرو ایزدی': 'domain',
  'نماد مقدس': 'sacredSymbol',
  'باور اصلی': 'coreDogma',
  'اصول': 'coreDogma',
  'خطوط قرمز': 'taboos',
  'حرمت‌ها': 'taboos',
  'مواهب': 'divineBlessings',
  'برکت‌ها': 'divineBlessings',
  'نادرستی': 'rarity',
  'کمیابی': 'rarity',
  'فراوانی': 'rarity',
  'سطح کمیابی': 'rarity',
  'زیستگاه': 'habitatLocationIds',
  'زیستگاه‌ها': 'habitatLocationIds',
  'مکان‌ها': 'habitatLocationIds',
  'طعمه‌ها': 'preySpecies',
  'شکارچیان': 'predatorSpecies',
  'مواد رام‌سازی': 'pacificationReagents',
  'گیاهان رام‌سازی': 'pacificationReagents',
  'مواد رام سازی': 'pacificationReagents',
  'گیاهان رام سازی': 'pacificationReagents',
  'طعمه‌های رام‌سازی': 'pacificationReagents',
  'روش استخراج': 'extractionMethod',
  'نحوه استخراج': 'extractionMethod',
  'خطرات استخراج': 'extractionMethod',
  'خواص کیمیاگری': 'craftingProperties',
  'کاربردهای ساخت': 'craftingProperties',
  'کاربرد ساخت': 'craftingProperties',
  'خواص فیزیکی': 'craftingProperties',
  'قدرت‌ها': 'powers',
  'قدرت': 'powers',
  'نفرین': 'curseOrCost',
  'هزینه': 'curseOrCost',
  'قانون': 'rule',
  'اصل': 'rule',
  'سال یا دوره': 'yearOrEra',
  'دوره': 'yearOrEra',
  'اهمیت': 'significance',
  'رنگ': 'color',
  'کد رنگ': 'color',
  'جهت‌دار': 'isDirected',
  'جهت دار': 'isDirected',
  'مبدا': 'sourceCategory',
  'مبدأ': 'sourceCategory',
  'مقصد': 'targetCategory',
  'راهنمای گفتار': 'voiceGuide',
  'راهنمای دیالوگ': 'voiceGuide',
  'دیالوگ‌ها': 'sampleDialogue',
  'دیالوگ': 'sampleDialogue',
  'نمونه دیالوگ': 'sampleDialogue',
  'تکیه‌کلام‌ها': 'speechQuirks',
  'تکیه کلام‌ها': 'speechQuirks',
  'تکیه‌کلام': 'speechQuirks',
  'نقاط آسیب‌پذیری': 'negotiationVulnerabilities',
  'نقاط اثرپذیری': 'negotiationVulnerabilities',
  'نقطه شکست روانی': 'psychologicalBreakingPoint',
  'کالیبراسیون رزمی': 'statCalibration',
  'ویژگی‌های رزمی': 'statCalibration',
  'درجه چالش': 'challengeRating',
  'مبنای درجه چالش': 'crBasis',
  'منشأ خطر': 'crBasis',
  'سطح نبرد': 'combatTier',
  'رده رزمی': 'combatTier',
  'توانایی‌های ویژه': 'signatureAbilities',
  'توانایی‌ها': 'signatureAbilities',
  'تجهیزات مجهز': 'equippedGear',
  'تجهیزات': 'equippedGear',
  'سلاح‌ها': 'equippedGear',
  'علائم حیاتی': 'vitals',
  'جان': 'vitals',
  'سلامتی': 'vitals',
  'مخازن منابع': 'resourcePools',
  'منابع': 'resourcePools',
};

export const STAT_CANONICAL_ALIASES: Record<string, string> = {
  // Might
  might: 'might',
  migh: 'might',
  نیرو: 'might',
  زور: 'might',
  قدرت: 'might',
  توان: 'might',
  // Cunning
  cunning: 'cunning',
  cunnin: 'cunning',
  هوش: 'cunning',
  ذکاوت: 'cunning',
  زیرکی: 'cunning',
  دانش: 'cunning',
  // Agility
  agility: 'agility',
  agilty: 'agility',
  چابکی: 'agility',
  سرعت: 'agility',
  فرزی: 'agility',
  // Arcana
  arcana: 'arcana',
  arcan: 'arcana',
  جادو: 'arcana',
  ماورا: 'arcana',
  افسون: 'arcana',
  سحر: 'arcana',
  // Charisma
  charisma: 'charisma',
  charis: 'charisma',
  کاریزما: 'charisma',
  جذبه: 'charisma',
  نفوذ: 'charisma',
  هیبت: 'charisma',
};

export function normalizeEntity(entity: EntityType, data: any): any {
  if (!data || typeof data !== 'object') return data;
  const res: Record<string, any> = { ...data };

  // Map Persian / natural language keys to canonical schema keys
  for (const [k, v] of Object.entries(data)) {
    const rawTrimmed = k.trim();
    const cleanKey = rawTrimmed.replace(/\s*\(.*?\)\s*/g, '').trim();
    let mapped = PERSIAN_FIELD_MAP[cleanKey] || PERSIAN_FIELD_MAP[rawTrimmed];

    if (!mapped) {
      if (/^نام(\s+|$)/.test(cleanKey)) mapped = 'name';
      else if (/^(شرح|توصیف|توضیح)/.test(cleanKey)) mapped = 'description';
      else if (/^(ناحیه|منطقه)/.test(cleanKey)) mapped = 'region';
      else if (/خطر/.test(cleanKey)) mapped = 'dangerLevel';
      else if (/^(فضاسازی|لحن|اتمسفر|جو)/.test(cleanKey)) mapped = 'atmosphere';
      else if (/^(والد|بالادست|در\s*بر\s*گیرنده|موقعیت\s*بالادست)/.test(cleanKey) || /بالادست/.test(cleanKey)) mapped = 'parentLocationName';
      else if (/^(دسته|دسته‌بندی|دستهبندی)/.test(cleanKey)) mapped = 'category';
      else if (/^قوانین(\s+|$)/.test(cleanKey) || /قوانین/.test(cleanKey)) mapped = 'specialRules';
      else if (/^رنگ/.test(cleanKey)) mapped = 'color';
    }

    if (mapped && !(mapped in res)) {
      res[mapped] = v;
    }
  }

  // Ensure unique canonical ID if not present
  if (!res.id) {
    const prefix: Record<EntityType, string> = {
      faction: 'fac',
      location: 'loc',
      npc: 'npc',
      artifact: 'art',
      creature: 'creature',
      deity: 'deity',
      timeline_event: 'evt',
      world_law: 'law',
      place_category: 'cat_place',
      law_category: 'cat_law',
      npc_role: 'role',
      domain: 'dom',
      relation_type: 'rel',
    };
    const isOntology = [
      'place_category',
      'law_category',
      'npc_role',
      'domain',
      'relation_type',
    ].includes(entity);

    const slug = isOntology && typeof res.name === 'string'
      ? res.name.trim().toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '_').slice(0, 24)
      : '';
    res.id = slug || `${prefix[entity] || 'ent'}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  }

  // Type-specific field sanitation & normalization
  if (entity === 'location') {
    if (typeof res.dangerLevel === 'string') {
      const parsedNum = parseInt(res.dangerLevel.match(/\d+/)?.[0] || '1', 10);
      res.dangerLevel = Math.max(1, Math.min(5, isNaN(parsedNum) ? 1 : parsedNum));
    } else if (typeof res.dangerLevel === 'number') {
      res.dangerLevel = Math.max(1, Math.min(5, Math.round(res.dangerLevel)));
    } else {
      res.dangerLevel = 1;
    }

    const validCategories = [
      'settlement',
      'stronghold',
      'ruins',
      'dungeon',
      'plains',
      'waterway',
      'seas',
      'wilderness',
      'anomaly',
    ];
    if (res.category) {
      const catLower = String(res.category).toLowerCase();
      if (
        catLower.includes('دریا') ||
        catLower.includes('اقیانوس') ||
        catLower.includes('خلیج') ||
        catLower.includes('تنگه') ||
        catLower.includes('مجمع‌الجزایر') ||
        catLower.includes('جزیره') ||
        catLower.includes('sea') ||
        catLower.includes('ocean') ||
        catLower.includes('gulf') ||
        catLower.includes('bay') ||
        catLower.includes('strait') ||
        catLower.includes('archipelago')
      ) {
        res.category = 'seas';
      } else if (
        catLower.includes('رودخانه') ||
        catLower.includes('رود') ||
        catLower.includes('دریاچه') ||
        catLower.includes('آبراه') ||
        catLower.includes('هور') ||
        catLower.includes('سرچشمه') ||
        catLower.includes('river') ||
        catLower.includes('lake') ||
        catLower.includes('waterway') ||
        catLower.includes('canal')
      ) {
        res.category = 'waterway';
      } else if (
        catLower.includes('دشت') ||
        catLower.includes('جلگه') ||
        catLower.includes('چراگاه') ||
        catLower.includes('مرتع') ||
        catLower.includes('تپه‌ماهور') ||
        catLower.includes('plain') ||
        catLower.includes('pasture') ||
        catLower.includes('meadow')
      ) {
        res.category = 'plains';
      } else if (
        catLower.includes('قلعه') ||
        catLower.includes('دژ') ||
        catLower.includes('بارو') ||
        catLower.includes('پادگان') ||
        catLower.includes('برج') ||
        catLower.includes('استحکامات') ||
        catLower.includes('پاسگاه') ||
        catLower.includes('stronghold') ||
        catLower.includes('fortress') ||
        catLower.includes('citadel') ||
        catLower.includes('outpost')
      ) {
        res.category = 'stronghold';
      } else if (
        catLower.includes('ویرانه') ||
        catLower.includes('خرابه') ||
        catLower.includes('معبد') ||
        catLower.includes('محراب') ||
        catLower.includes('زیارتگاه') ||
        catLower.includes('یادمان') ||
        catLower.includes('مدفون') ||
        catLower.includes('متروکه') ||
        catLower.includes('ruin') ||
        catLower.includes('shrine') ||
        catLower.includes('temple')
      ) {
        res.category = 'ruins';
      } else if (
        catLower.includes('سیاه‌چال') ||
        catLower.includes('دخمه') ||
        catLower.includes('غار') ||
        catLower.includes('سرداب') ||
        catLower.includes('هزارتو') ||
        catLower.includes('dungeon') ||
        catLower.includes('cave') ||
        catLower.includes('crypt')
      ) {
        res.category = 'dungeon';
      } else if (
        catLower.includes('ناهنجاری') ||
        catLower.includes('گرداب') ||
        catLower.includes('گسله') ||
        catLower.includes('شگفتی') ||
        catLower.includes('نامتعارف') ||
        catLower.includes('جادویی') ||
        catLower.includes('پرتگاه') ||
        catLower.includes('anomaly') ||
        catLower.includes('rift')
      ) {
        res.category = 'anomaly';
      } else if (
        catLower.includes('طبیعت') ||
        catLower.includes('بیابان') ||
        catLower.includes('wild') ||
        catLower.includes('کویر') ||
        catLower.includes('استپ') ||
        catLower.includes('جنگل') ||
        catLower.includes('کوه') ||
        catLower.includes('گذرگاه') ||
        catLower.includes('دره') ||
        catLower.includes('لجنزار') ||
        catLower.includes('مرداب') ||
        catLower.includes('صخره')
      ) {
        res.category = 'wilderness';
      } else if (
        catLower.includes('شهر') ||
        catLower.includes('روستا') ||
        catLower.includes('آبادی') ||
        catLower.includes('بندر') ||
        catLower.includes('بازار') ||
        catLower.includes('بارانداز') ||
        catLower.includes('کانون') ||
        catLower.includes('settle') ||
        catLower.includes('town') ||
        catLower.includes('city') ||
        catLower.includes('port')
      ) {
        res.category = 'settlement';
      } else if (!res.category || typeof res.category !== 'string' || !res.category.trim()) {
        res.category = 'wilderness';
      } else {
        res.category = res.category.trim();
      }
    } else {
      res.category = 'wilderness';
    }

    if (typeof res.specialRules === 'string') {
      res.specialRules = res.specialRules
        .split(/\r?\n+/)
        .map((s: string) => s.replace(/^[-*•\d+.)]\s*/, '').trim())
        .filter((s: string) => s.length > 0);
    } else if (!Array.isArray(res.specialRules)) {
      res.specialRules = [];
    }
    if (!Array.isArray(res.connectedLocationIds)) res.connectedLocationIds = [];
  } else if (entity === 'faction') {
    if (!Array.isArray(res.territoryIds)) res.territoryIds = [];
    if (!Array.isArray(res.alliedFactionIds)) res.alliedFactionIds = [];
    if (!Array.isArray(res.rivalFactionIds)) res.rivalFactionIds = [];
    const validScopes = ['street', 'regional', 'continental', 'mythic'];
    if (!validScopes.includes(res.scope)) res.scope = 'regional';
  } else if (entity === 'npc') {
    if (!Array.isArray(res.personalityTraits)) res.personalityTraits = [];
    if (!Array.isArray(res.goals)) res.goals = [];
    if (!Array.isArray(res.secrets)) res.secrets = [];
    else {
      // Normalize secret reveal methods (OR-list; bundled params act as AND)
      const validKinds = ['trust', 'pressure', 'item', 'ritual', 'location', 'quest', 'custom'];
      res.secrets = res.secrets
        .filter((s: unknown) => s && typeof s === 'object')
        .map((s: unknown) => {
          const sec = s as Record<string, unknown>;
          if (!Array.isArray(sec.revealMethods)) return sec;
          const methods = (sec.revealMethods as unknown[])
            .filter((m) => m && typeof m === 'object')
            .map((m) => {
              const rec = m as Record<string, unknown>;
              const kindAliases: Record<string, string> = {
                'اعتماد': 'trust',
                'فشار': 'pressure',
                'تهدید': 'pressure',
                'وسیله': 'item',
                'ابزار': 'item',
                'آیین': 'ritual',
                'جراحی': 'ritual',
                'مکان': 'location',
                'مأموریت': 'quest',
                'ماموریت': 'quest',
                'سفارشی': 'custom',
              };
              const kindRaw = String(rec.kind || 'trust').trim().toLowerCase();
              const aliased = kindAliases[kindRaw] || kindRaw;
              const kind = (validKinds as string[]).includes(aliased) ? aliased : 'trust';
              const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
              const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
              return {
                kind,
                ...(num(rec.trustThreshold) !== undefined ? { trustThreshold: num(rec.trustThreshold) } : {}),
                ...(str(rec.itemId) ? { itemId: str(rec.itemId) } : {}),
                ...(str(rec.itemName) ? { itemName: str(rec.itemName) } : {}),
                ...(str(rec.ritual) ? { ritual: str(rec.ritual) } : {}),
                ...(str(rec.locationId) ? { locationId: str(rec.locationId) } : {}),
                ...(str(rec.questId) ? { questId: str(rec.questId) } : {}),
                ...(str(rec.detail) ? { detail: str(rec.detail) } : {}),
              };
            });
          return { ...sec, revealMethods: methods };
        });
    }
    if (typeof res.initialTrust !== 'number') res.initialTrust = 0;

    // Normalize voiceGuide if present
    if (res.voiceGuide && typeof res.voiceGuide === 'object') {
      const rawVg = res.voiceGuide;
      const vg: any = {};
      for (const [k, v] of Object.entries(rawVg)) {
        const cleanK = k.trim().replace(/\s*\(.*?\)\s*/g, '').trim();
        const mapped = PERSIAN_FIELD_MAP[cleanK] || PERSIAN_FIELD_MAP[k.trim()] || cleanK;
        vg[mapped] = v;
      }
      if (!Array.isArray(vg.speechQuirks)) vg.speechQuirks = [];
      if (!Array.isArray(vg.sampleDialogue)) vg.sampleDialogue = [];
      else {
        vg.sampleDialogue = vg.sampleDialogue.map((d: any) => ({
          context: ['greeting', 'bargaining', 'threatened', 'dying'].includes(d.context)
            ? d.context
            : 'greeting',
          quote: String(d.quote || d.text || d.dialogue || ''),
        }));
      }
      if (!Array.isArray(vg.negotiationVulnerabilities)) vg.negotiationVulnerabilities = [];
      if (typeof vg.psychologicalBreakingPoint !== 'string') {
        vg.psychologicalBreakingPoint = vg.psychologicalBreakingPoint ? String(vg.psychologicalBreakingPoint) : '';
      }
      if (res.name) vg.npcName = res.name;
      res.voiceGuide = vg;
    }

    // Normalize statCalibration if present
    if (res.statCalibration && typeof res.statCalibration === 'object') {
      const rawSc = res.statCalibration;
      const sc: any = {};
      for (const [k, v] of Object.entries(rawSc)) {
        const cleanK = k.trim().replace(/\s*\(.*?\)\s*/g, '').trim();
        const mapped = PERSIAN_FIELD_MAP[cleanK] || PERSIAN_FIELD_MAP[k.trim()] || cleanK;
        sc[mapped] = v;
      }
      if (res.id) sc.npcId = res.id;
      if (res.name) sc.npcName = res.name;
      const validTiers = ['civilian', 'apprentice', 'veteran', 'elite', 'boss', 'mythic'];
      if (!validTiers.includes(sc.combatTier)) sc.combatTier = 'veteran';
      const parsedCr = typeof sc.challengeRating === 'number'
        ? sc.challengeRating
        : (parseInt(sc.challengeRating) || 5);
      sc.challengeRating = Math.max(1, Math.min(20, Math.round(parsedCr)));
      // What drives CR when it diverges from raw combat ability (may be '').
      const rawBasis = sc.crBasis ?? sc['مبنای درجه چالش'] ?? sc['منشأ خطر'];
      sc.crBasis = typeof rawBasis === 'string' ? rawBasis.trim() : '';

      if (!sc.statRatings || typeof sc.statRatings !== 'object') {
        sc.statRatings = {};
      } else {
        const normalizedRatings: Record<string, number> = {};
        for (const [k, v] of Object.entries(sc.statRatings)) {
          const trimmed = String(k || '').trim();
          const cleanKey = trimmed.toLowerCase();
          const canonical = STAT_CANONICAL_ALIASES[cleanKey] || STAT_CANONICAL_ALIASES[trimmed] || trimmed;
          // Discard hallucinated non-stats
          if (canonical.toLowerCase() === 'charlatany') continue;
          const num = Number(v);
          normalizedRatings[canonical] = Number.isFinite(num) ? Math.round(num) : 3;
        }
        sc.statRatings = normalizedRatings;
      }
      if (!Array.isArray(sc.signatureAbilities)) sc.signatureAbilities = [];
      if (!Array.isArray(sc.equippedGear)) sc.equippedGear = [];
      else {
        sc.equippedGear = sc.equippedGear.map((g: any) => ({
          name: String(g.name || ''),
          type: String(g.type || 'gear'),
          description: g.description ? String(g.description) : undefined,
        }));
      }
      // Normalize vitals & resource pools (clamp current into [0, max]).
      // Nested Persian aliases are resolved here since the top-level key
      // mapper only covers statCalibration's direct keys.
      const pick = (obj: unknown, ...keys: string[]): unknown => {
        if (!obj || typeof obj !== 'object') return undefined;
        const rec = obj as Record<string, unknown>;
        for (const k of keys) {
          const v = rec[k];
          if (v !== undefined && v !== null && v !== '') return v;
        }
        return undefined;
      };
      const normalizeBar = (raw: unknown, fallbackMax: number) => {
        // Explicit max 0 floors to 1; only absent/garbage falls back.
        const pickedMax = pick(raw, 'max', 'حداکثر', 'بیشینه');
        const parsedMax = Number(pickedMax);
        const max = pickedMax === undefined
          ? fallbackMax
          : Math.max(1, Math.round(Number.isFinite(parsedMax) ? parsedMax : fallbackMax));
        const rawCurrent = pick(raw, 'current', 'فعلی', 'کنونی');
        // Absent current means fully rested; explicit values clamp into [0, max].
        const current = rawCurrent === undefined
          ? max
          : Math.max(0, Math.min(max, Math.round(Number(rawCurrent) || 0)));
        return { current, max };
      };
      const rawVitals: unknown = sc.vitals && typeof sc.vitals === 'object' ? sc.vitals : {};
      const rawStamina = pick(rawVitals, 'stamina', 'استقامت');
      const rawMana = pick(rawVitals, 'mana', 'مانا');
      sc.vitals = {
        health: normalizeBar(pick(rawVitals, 'health', 'جان', 'سلامتی'), 10),
        ...(rawStamina ? { stamina: normalizeBar(rawStamina, 10) } : {}),
        ...(rawMana ? { mana: normalizeBar(rawMana, 10) } : {}),
      };
      if (!Array.isArray(sc.resourcePools)) sc.resourcePools = [];
      else {
        sc.resourcePools = sc.resourcePools
          .filter((p: unknown) => {
            if (!p || typeof p !== 'object') return false;
            const rec = p as Record<string, unknown>;
            return Boolean(rec.name || rec.id || rec['نام']);
          })
          .map((p: unknown, idx: number) => {
            const rec = p as Record<string, unknown>;
            const name = String(pick(rec, 'name', 'نام') || rec.id || `Pool ${idx + 1}`);
            const max = Math.max(1, Math.round(Number(pick(rec, 'max', 'حداکثر', 'بیشینه')) || 1));
            const rawCurrent = pick(rec, 'current', 'فعلی', 'کنونی');
            return {
              id: String(rec.id || `pool_${idx}`),
              name,
              current: rawCurrent === undefined
                ? max
                : Math.max(0, Math.min(max, Math.round(Number(rawCurrent) || 0))),
              max,
            };
          });
      }
      res.statCalibration = sc;
    }
  } else if (entity === 'artifact') {
    if (!Array.isArray(res.powers)) res.powers = [];
    const validRarities = ['uncommon', 'rare', 'epic', 'legendary', 'mythic'];
    if (!validRarities.includes(res.rarity)) res.rarity = 'rare';
  } else if (entity === 'creature') {
    if (!Array.isArray(res.weaknesses)) res.weaknesses = [];
    if (!Array.isArray(res.resistances)) res.resistances = [];
    if (!Array.isArray(res.harvestableLoot)) res.harvestableLoot = [];
    if (typeof res.dangerLevel === 'number') {
      res.dangerLevel = Math.max(1, Math.min(5, Math.round(res.dangerLevel)));
    } else {
      res.dangerLevel = 2;
    }
  } else if (entity === 'deity') {
    if (!Array.isArray(res.taboos)) res.taboos = [];
    if (!Array.isArray(res.divineBlessings)) res.divineBlessings = [];
    if (!Array.isArray(res.holyLocationIds)) res.holyLocationIds = [];
    if (!Array.isArray(res.affiliatedFactionIds)) res.affiliatedFactionIds = [];
  } else if (entity === 'timeline_event') {
    if (res.knownByPublic === undefined) res.knownByPublic = true;
  } else if (entity === 'world_law') {
    res.isImmutable = true;
  } else if (entity === 'place_category') {
    if (!res.color) res.color = '#F59E0B';
  } else if (entity === 'law_category') {
    if (!res.color) res.color = '#A855F7';
  } else if (entity === 'npc_role') {
    if (!res.color) res.color = '#6366F1';
  } else if (entity === 'domain') {
    if (!res.color) res.color = '#10B981';
  } else if (entity === 'relation_type') {
    if (!res.color) res.color = '#38BDF8';
    if (res.isDirected === undefined) res.isDirected = true;
    if (!res.sourceCategory) res.sourceCategory = 'any';
    if (!res.targetCategory) res.targetCategory = 'any';
  }

  return res;
}
