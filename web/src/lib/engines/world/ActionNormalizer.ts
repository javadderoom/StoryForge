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
  'قدرت‌ها': 'powers',
  'قدرت': 'powers',
  'نفرین': 'curseOrCost',
  'هزینه': 'curseOrCost',
  'قانون': 'rule',
  'اصل': 'rule',
  'سال یا دوره': 'yearOrEra',
  'دوره': 'yearOrEra',
  'اهمیت': 'significance',
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
    };
    res.id = `${prefix[entity]}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
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
      } else if (!validCategories.includes(res.category)) {
        res.category = 'wilderness';
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
    if (typeof res.initialTrust !== 'number') res.initialTrust = 0;
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
  }

  return res;
}
