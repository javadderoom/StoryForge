import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseActionBlocks,
  validateActionBlock,
  normalizeEntity,
  findExistingEntityByName,
} from './ActionProtocol';
import { prepareWorldChanges } from './oracleActions';
import type { WorldBible } from '@/lib/types/world';

describe('Oracle Easy Insert — Direct Data Ingestion', () => {
  it('parses action blocks with structured data payload', () => {
    const aiResponse = `
Here is the continent you specified:
\`\`\`storyforge-action
{
  "op": "create",
  "entity": "location",
  "data": {
    "name": "قارهٔ فراوند (Faravand Continent)",
    "region": "جهان شناخته‌شده (Known World)",
    "parentLocationName": "سیارهٔ فراوند (Planet Faravand)",
    "category": "wilderness",
    "dangerLevel": 3,
    "description": "تنها قارهٔ پیوسته و شناخته‌شده در مقیاس اروپای واقعی...",
    "atmosphere": "کهن، سنگین، جدی و آکنده از کشمکش‌های مذهبی..."
  }
}
\`\`\`
I have prepared the direct insertion for you.`;

    const actions = parseActionBlocks(aiResponse);
    assert.equal(actions.length, 1);
    assert.equal(actions[0].op, 'create');
    assert.equal(actions[0].entity, 'location');
    assert.ok(actions[0].data);
    assert.equal(actions[0].data?.name, 'قارهٔ فراوند (Faravand Continent)');
    assert.equal(actions[0].data?.dangerLevel, 3);
  });

  it('validates action block with data even without prompt', () => {
    const validCreate = validateActionBlock({
      op: 'create',
      entity: 'location',
      data: { name: 'Test Place' },
    });
    assert.equal(validCreate.valid, true);

    const validUpdate = validateActionBlock({
      op: 'update',
      entity: 'location',
      match: { byName: 'Test Place' },
      data: { dangerLevel: 4 },
    });
    assert.equal(validUpdate.valid, true);

    const invalidCreate = validateActionBlock({
      op: 'create',
      entity: 'location',
    });
    assert.equal(invalidCreate.valid, false);
    assert.match(invalidCreate.error || '', /prompt or data/);
  });

  it('normalizes Persian field keys to canonical schema properties', () => {
    const rawPersianData = {
      'نام مکان': 'قارهٔ فراوند',
      'ناحیه / منطقه': 'جهان شناخته‌شده',
      'موقعیت بالادست / در بر گیرنده': 'سیارهٔ فراوند',
      'دستهبندی مکان': 'طبیعت وحشی و بیابان',
      'سطح خطر': '3 · خطرناک',
      'شرح مکان و ظاهر': 'تنها قارهٔ پیوسته و شناخته‌شده در مقیاس اروپای واقعی...',
      'فضاسازی و لحن': 'کهن، سنگین، جدی...',
    };

    const normalized = normalizeEntity('location', rawPersianData);

    assert.equal(normalized.name, 'قارهٔ فراوند');
    assert.equal(normalized.region, 'جهان شناخته‌شده');
    assert.equal(normalized.parentLocationName, 'سیارهٔ فراوند');
    assert.equal(normalized.category, 'wilderness');
    assert.equal(normalized.dangerLevel, 3);
    assert.equal(normalized.description, 'تنها قارهٔ پیوسته و شناخته‌شده در مقیاس اروپای واقعی...');
    assert.equal(normalized.atmosphere, 'کهن، سنگین، جدی...');
    assert.ok(normalized.id.startsWith('loc_'));
  });

  it('resolves parentLocationName to parentLocationId in prepareWorldChanges', async () => {
    const sampleBible: WorldBible = {
      worldId: 'wb_test',
      worldName: 'Faravand Realm',
      summary: 'Test summary',
      themeNotes: 'Test themes',
      locations: [
        {
          id: 'loc_planet_1',
          name: 'سیارهٔ فراوند (Planet Faravand)',
          region: 'کیهان',
          category: 'wilderness',
          dangerLevel: 1,
          description: 'سیاره مبدا جهان',
          atmosphere: 'آرام و بی‌کران',
          connectedLocationIds: [],
        },
      ],
      factions: [],
      npcs: [],
      artifacts: [],
      bestiary: [],
      religions: [],
      timeline: [],
      laws: [],
      dramaBonds: [],
    };

    const action = {
      op: 'create' as const,
      entity: 'location' as const,
      data: {
        name: 'قارهٔ فراوند',
        region: 'جهان شناخته‌شده',
        parentLocationName: 'سیارهٔ فراوند',
        dangerLevel: 3,
        description: 'قاره اصلی',
      },
    };

    const res = await prepareWorldChanges({
      actions: [action],
      worldBible: sampleBible,
      worldContext: '',
      isPersian: true,
    });

    assert.equal(res.failed.length, 0);
    assert.equal(res.ready.length, 1);
    assert.equal(res.ready[0].newData.name, 'قارهٔ فراوند');
    assert.equal(res.ready[0].newData.parentLocationId, 'loc_planet_1');
    assert.equal(res.ready[0].newData.dangerLevel, 3);
  });

  it('supports direct data insertion across factions, NPCs, artifacts and laws', async () => {
    const factionAction = {
      op: 'create' as const,
      entity: 'faction' as const,
      data: {
        'نام': 'محفل زروانیان',
        'گرایش': 'Lawful Neutral',
        'اهداف علنی': 'نگهداری از رودهای مقدس',
        'دستور کار پنهان': 'دستیابی به هسته کهن',
        'scope': 'continental',
      },
    };

    const npcAction = {
      op: 'create' as const,
      entity: 'npc' as const,
      data: {
        'نام': 'استاد هیرام',
        'لقب': 'دیده‌بان هامون',
        'نقش': 'راهنمای کاروان‌ها',
      },
    };

    const artifactAction = {
      op: 'create' as const,
      entity: 'artifact' as const,
      data: {
        'نام': 'شمشیر زروان',
        'کمیابی': 'legendary',
        'شرح': 'شمشیری از برنز سپید',
      },
    };

    const lawAction = {
      op: 'create' as const,
      entity: 'world_law' as const,
      data: {
        'قانون': 'هیچ آب شیرینی در هامون بدون اذن پیران زروان تقسیم نمی‌شود',
        'category': 'society',
      },
    };

    const res = await prepareWorldChanges({
      actions: [factionAction, npcAction, artifactAction, lawAction],
      worldBible: { worldId: 'wb_1', locations: [], factions: [] } as any,
      worldContext: '',
      isPersian: true,
    });

    assert.equal(res.failed.length, 0);
    assert.equal(res.ready.length, 4);

    const fac = res.ready.find((r) => r.entity === 'faction')?.newData;
    assert.equal(fac.name, 'محفل زروانیان');
    assert.equal(fac.publicGoals, 'نگهداری از رودهای مقدس');
    assert.equal(fac.secretAgendas, 'دستیابی به هسته کهن');
    assert.equal(fac.scope, 'continental');

    const npc = res.ready.find((r) => r.entity === 'npc')?.newData;
    assert.equal(npc.name, 'استاد هیرام');
    assert.equal(npc.title, 'دیده‌بان هامون');
    assert.equal(npc.role, 'راهنمای کاروان‌ها');

    const art = res.ready.find((r) => r.entity === 'artifact')?.newData;
    assert.equal(art.name, 'شمشیر زروان');
    assert.equal(art.rarity, 'legendary');

    const law = res.ready.find((r) => r.entity === 'world_law')?.newData;
    assert.equal(law.rule, 'هیچ آب شیرینی در هامون بدون اذن پیران زروان تقسیم نمی‌شود');
    assert.equal(law.isImmutable, true);
  });

  it('correctly ingests user complex location data with category, special rules, and description', () => {
    const rawUserData = {
      'نام مکان': 'گذرگاه هیرام (Hiram Pass / Western Foothills)',
      'ناحیه / منطقه': 'حدفاصل جنوب باختری ارژن و دشت هیرام',
      'موقعیت بالادست / در بر گیرنده (Parent Location)': 'قارهٔ فراوند (Faravand Continent)',
      'دستهبندی مکان (Category)': 'طبیعت وحشی و بیابان',
      'سطح خطر (Danger 1–5)': '3 · خطرناک',
      'شرح مکان و ظاهر':
        'منطقهای ناهموار و بادگیر از تپهماهورهای خشک، درههای سنگلاخی فرسایشیافته و شکافهای کمعمق...',
      'فضاسازی و لحن (Atmosphere)':
        'برهوت، غبارآلود، فرساینده و بلاتکلیف میان دو اقلیم متضاد...',
      'قوانین ویژه مکان':
        'نوسان شدید دمای شبانهروز؛ تغییرات سریع دما\nطوفانهای غبار ناگهانی؛ جریانهای بادی\nمعبر کاروانهای گریزپا\nفقر منابع آب سطحی',
    };

    const normalized = normalizeEntity('location', rawUserData);

    assert.equal(normalized.name, 'گذرگاه هیرام (Hiram Pass / Western Foothills)');
    assert.equal(normalized.region, 'حدفاصل جنوب باختری ارژن و دشت هیرام');
    assert.equal(normalized.parentLocationName, 'قارهٔ فراوند (Faravand Continent)');
    assert.equal(normalized.category, 'wilderness');
    assert.equal(normalized.dangerLevel, 3);
    assert.ok(normalized.description.startsWith('منطقهای ناهموار'));
    assert.ok(normalized.atmosphere.startsWith('برهوت، غبارآلود'));
    assert.equal(Array.isArray(normalized.specialRules), true);
    assert.equal(normalized.specialRules.length, 4);
    assert.ok(normalized.specialRules[0].includes('نوسان شدید دما'));
    assert.ok(normalized.specialRules[3].includes('فقر منابع آب سطحی'));
  });

  it('findExistingEntityByName correctly matches existing entities across aliases and diacritics', () => {
    const wb: WorldBible = {
      worldId: 'wb_1',
      worldName: 'تست جهان',
      summary: 'خلاصه',
      themeNotes: 'تم',
      locations: [
        {
          id: 'loc_1',
          name: 'گذرگاه هیرام (Hiram Pass / Western Foothills)',
          region: 'غرب',
          dangerLevel: 3,
          description: 'توضیحات',
          atmosphere: 'بادگیر و سرد',
          connectedLocationIds: [],
        },
        {
          id: 'loc_2',
          name: 'The Obsidian Spire',
          region: 'North',
          dangerLevel: 4,
          description: 'A tall black tower',
          atmosphere: 'Dark and menacing',
          connectedLocationIds: [],
        },
      ],
      factions: [],
      npcs: [],
      artifacts: [],
      bestiary: [],
      religions: [],
      timeline: [],
      laws: [],
      dramaBonds: [],
    };

    // 1. Matches exact base name
    const m1 = findExistingEntityByName(wb, 'location', 'گذرگاه هیرام');
    assert.ok(m1);
    assert.equal(m1.id, 'loc_1');

    // 2. Matches full name
    const m2 = findExistingEntityByName(wb, 'location', 'گذرگاه هیرام (Hiram Pass / Western Foothills)');
    assert.ok(m2);
    assert.equal(m2.id, 'loc_1');

    // 3. Matches English location with different casing
    const m3 = findExistingEntityByName(wb, 'location', 'the obsidian spire');
    assert.ok(m3);
    assert.equal(m3.id, 'loc_2');

    // 4. Does NOT match different location
    const m4 = findExistingEntityByName(wb, 'location', 'دشت هیرام');
    assert.equal(m4, undefined);
  });

  it('prevents recreating already available locations in prepareWorldChanges (multi-turn de-duplication)', async () => {
    // World already has Location X ("گذرگاه هیرام")
    const existingBible: WorldBible = {
      worldId: 'wb_test',
      worldName: 'دنیای تست',
      summary: 'خلاصه تست',
      themeNotes: 'تم آزمایشی',
      locations: [
        {
          id: 'loc_x',
          name: 'گذرگاه هیرام (Hiram Pass)',
          region: 'جنوب باختری',
          dangerLevel: 3,
          description: 'گذرگاه سنگی',
          atmosphere: 'بادگیر و خشک',
          connectedLocationIds: [],
        },
      ],
      factions: [],
      npcs: [],
      artifacts: [],
      bestiary: [],
      religions: [],
      timeline: [],
      laws: [],
      dramaBonds: [],
    };

    // Oracle emitted both create X (already exists) and create Y ("دشت نمک" - new)
    const actionRecreateX = {
      op: 'create' as const,
      entity: 'location' as const,
      data: {
        name: 'گذرگاه هیرام',
        region: 'جنوب باختری',
        description: 'تکرار گذرگاه قبلی',
      },
    };

    const actionCreateY = {
      op: 'create' as const,
      entity: 'location' as const,
      data: {
        name: 'دشت نمک',
        region: 'خاور',
        description: 'دشت سپید و شور',
      },
    };

    const res = await prepareWorldChanges({
      actions: [actionRecreateX, actionCreateY],
      worldBible: existingBible,
      worldContext: '',
      isPersian: true,
    });

    // Action X must be skipped, ONLY Action Y must be in ready
    assert.equal(res.failed.length, 0);
    assert.equal(res.ready.length, 1);
    assert.equal(res.ready[0].newData.name, 'دشت نمک');
  });

  it('drops duplicate create actions in the same batch', async () => {
    const emptyBible: WorldBible = {
      worldId: 'wb_test',
      worldName: 'دنیای خالی',
      summary: 'خلاصه',
      themeNotes: 'تم',
      locations: [],
      factions: [],
      npcs: [],
      artifacts: [],
      bestiary: [],
      religions: [],
      timeline: [],
      laws: [],
      dramaBonds: [],
    };

    const action1 = {
      op: 'create' as const,
      entity: 'location' as const,
      data: { name: 'برج خاموش', region: 'شمال' },
    };

    const actionDuplicate = {
      op: 'create' as const,
      entity: 'location' as const,
      data: { name: 'برج خاموش', region: 'شمال' },
    };

    const res = await prepareWorldChanges({
      actions: [action1, actionDuplicate],
      worldBible: emptyBible,
      worldContext: '',
      isPersian: true,
    });

    assert.equal(res.failed.length, 0);
    assert.equal(res.ready.length, 1);
    assert.equal(res.ready[0].newData.name, 'برج خاموش');
  });
});
