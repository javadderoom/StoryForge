import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PowerSchoolSchema,
  PowerRankSchema,
  WorldBibleSchema,
  NPCDossierSchema,
  PowerSchool,
} from './world';

describe('PowerSchoolSchema & PowerRankSchema - Boundary Tests', () => {
  it('validates a flexible 3-tier occult power school', () => {
    const raw: PowerSchool = {
      id: 'school_pyromancy',
      name: 'جادوی آتش زروانی',
      nameEn: 'Zarvanite Pyromancy',
      description: 'دستکاری آتشین و شعله‌های کهن خاکستر زروان',
      category: 'arcane',
      sourceOfPower: 'بقایای آتشدان‌های باستانی هیرام',
      linkedStatId: 'arcana',
      linkedResourceId: 'mana',
      taboosAndCosts: 'تضعیف پیوند خونی در صورت مهارنشدن شعله',
      ranks: [
        {
          rank: 1,
          name: 'جرقه‌زن',
          nameEn: 'Spark-Caster',
          title: 'اخگر',
          description: 'روشن کردن آتش با نوک انگشتان و احساس رگه‌های گرما',
          unlockedAbilityIds: ['ab_spark'],
          statBonuses: { arcana: 1 },
          resourceBonuses: { mana: 10 },
          advancementCost: { masteryPointsRequired: 50, resourceCosts: { mana: 20 } },
          narrativeScope: 'mortal',
        },
        {
          rank: 2,
          name: 'آتش‌افروز',
          nameEn: 'Flame-Weaver',
          title: 'آذرخش‌بان',
          description: 'احضار تیغه‌های آتشین و مصونیت در برابر سوختگی‌های سطحی',
          unlockedAbilityIds: ['ab_flame_blade'],
          statBonuses: { arcana: 2 },
          resourceBonuses: { mana: 25 },
          advancementCost: { masteryPointsRequired: 150, resourceCosts: { mana: 50 }, requiredItemIds: ['item_cinder_core'] },
          narrativeScope: 'heroic',
        },
        {
          rank: 3,
          name: 'خورشیدبان',
          nameEn: 'Solar Magister',
          title: 'شعله‌سالار',
          description: 'فروپاشی صخره‌ها با ستون‌های آتش ناب و مهار توفان‌های آذرین',
          unlockedAbilityIds: ['ab_solar_pillar'],
          statBonuses: { arcana: 4 },
          resourceBonuses: { mana: 60 },
          narrativeScope: 'superhuman',
        },
      ],
    };

    const parsed = PowerSchoolSchema.parse(raw);
    assert.equal(parsed.id, 'school_pyromancy');
    assert.equal(parsed.ranks.length, 3);
    assert.equal(parsed.ranks[0].rank, 1);
    assert.equal(parsed.ranks[1].advancementCost?.masteryPointsRequired, 150);
  });

  it('validates NPC dossier with power affiliations', () => {
    const npc = {
      id: 'npc_radman',
      name: 'کاروان‌سالار رادمان',
      title: 'ساربان کهنه‌کار',
      currentLocationId: 'loc_shakh_zarrin',
      powerAffiliations: [
        { schoolId: 'school_hiram_sandblade', rank: 2, title: 'بادبُران' },
      ],
    };
    const parsed = NPCDossierSchema.parse(npc);
    assert.equal(parsed.powerAffiliations?.length, 1);
    assert.equal(parsed.powerAffiliations?.[0].rank, 2);
  });

  it('validates WorldBible with embedded powerSchools', () => {
    const wb = {
      worldId: 'w_test',
      worldName: 'آرداوان',
      summary: 'جهان آزمایشی',
      themeNotes: 'تاریک',
      powerSchools: [
        {
          id: 'ps_1',
          name: 'شمشیرزنی باد',
          description: 'سبک کهن شن‌زار',
          category: 'martial',
          sourceOfPower: 'بادهای سرخ',
          ranks: [
            { rank: 1, name: 'ساربند', description: 'گام‌های بی‌صدا در ماسه' },
          ],
        },
      ],
    };
    const parsed = WorldBibleSchema.parse(wb);
    assert.equal(parsed.powerSchools?.length, 1);
    assert.equal(parsed.powerSchools?.[0].ranks[0].name, 'ساربند');
  });
});
