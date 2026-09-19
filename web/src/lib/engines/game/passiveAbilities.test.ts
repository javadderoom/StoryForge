import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAbilityModifier,
  isShieldEquipped,
  evaluatePassiveAbilities,
} from './passiveAbilities';
import { PlayerState } from '@/lib/types/gameplay';
import { AbilityDefinition, RPGSystemSchema } from '@/lib/types/rpg';

function makePlayerState(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    characterName: 'Barzin',
    archetypeName: 'Vanguard',
    stats: { might: 12 },
    resources: { hp: 30 },
    inventory: [],
    equipment: {},
    discoveredLocationIds: ['loc_quay'],
    relationships: {},
    activeQuestIds: [],
    completedQuestIds: [],
    currentLocationId: 'loc_quay',
    ...overrides,
  };
}

describe('Passive Abilities Engine — Automated Parsing & Resolution', () => {
  describe('parseAbilityModifier', () => {
    it('parses standard explicit positive and negative modifiers', () => {
      assert.equal(
        parseAbilityModifier({
          effectSummary: '+3 به دفاع در برابر حملات دوربرد سبک با سپر',
        }),
        3
      );
      assert.equal(
        parseAbilityModifier({
          effectSummary: '-3 در آزمون‌های متقاعدسازی مأموران اداری',
        }),
        -3
      );
      assert.equal(
        parseAbilityModifier({
          description: '+2 bonus on stealth and tracking',
        }),
        2
      );
    });

    it('parses Persian digits and inverted RTL sign notations', () => {
      assert.equal(
        parseAbilityModifier({
          effectSummary: '+۳ پاداش به دفاع در برابر پرتابه‌ها',
        }),
        3
      );
      assert.equal(
        parseAbilityModifier({
          effectSummary: '۳- در درک نیت کاتبان دیوان',
        }),
        -3
      );
      assert.equal(
        parseAbilityModifier({
          description: 'پاداش ۲ در هدایت حیوانات بارکش',
        }),
        2
      );
      assert.equal(
        parseAbilityModifier({
          description: 'جریمه ۴ در آزمون‌های اداری',
        }),
        -4
      );
    });

    it('returns 0 when no numeric modifier is present', () => {
      assert.equal(
        parseAbilityModifier({
          description: 'مهار و هدایت شتر و قاطر در دشت‌های بیابانی.',
        }),
        0
      );
    });
  });

  describe('isShieldEquipped', () => {
    it('returns true when an offHand item is typed or named as a shield', () => {
      const stateWithShield = makePlayerState({
        inventory: [
          {
            id: 'item_wooden_shield',
            name: 'سپر چوبی گشت',
            type: 'shield',
            quantity: 1,
            description: 'A round wooden shield',
          },
        ],
        equipment: {
          offHand: 'item_wooden_shield',
        },
      });

      assert.equal(isShieldEquipped(stateWithShield), true);
    });

    it('returns false when offHand is empty or holds a non-shield weapon', () => {
      const stateWithDagger = makePlayerState({
        inventory: [
          {
            id: 'item_dagger',
            name: 'خنجر برنزی',
            type: 'weapon',
            quantity: 1,
            description: 'A bronze dagger',
          },
        ],
        equipment: {
          offHand: 'item_dagger',
        },
      });

      assert.equal(isShieldEquipped(stateWithDagger), false);

      const stateEmpty = makePlayerState();
      assert.equal(isShieldEquipped(stateEmpty), false);
    });
  });

  describe('evaluatePassiveAbilities', () => {
    const abilities: AbilityDefinition[] = [
      {
        id: 'ab_shield_wall',
        name: 'دیوار بارانداز',
        type: 'passive_skill',
        description: 'تا زمانی که سپر در دست دارید، در دفاع در برابر پرتابه‌های سبک پاداش پدافندی دارید.',
        effectSummary: '+3 پاداش به دفاع در برابر حملات دوربرد سبک (تیر و سنگ) هنگام مجهز بودن به سپر',
        tier: 1,
      },
      {
        id: 'ab_scribe_mistrust',
        name: 'بی‌اعتمادی به مهر و قلم',
        type: 'passive_feat',
        description: 'آزمون‌های متقاعدسازی کاتبان با دشواری بالاتر انجام می‌شود.',
        effectSummary: '-3 در آزمون‌های متقاعدسازی یا درک نیت مأموران اداری و کاتبان',
        tier: 1,
      },
      {
        id: 'ab_caravan',
        name: 'کاروان',
        type: 'passive_feat',
        description: 'مهار و هدایت شتر و قاطر، جهت‌یابی با ستارگان در شب‌های دشت.',
        tier: 1,
      },
    ];

    const rpgSystem: RPGSystemSchema = {
      hasCombat: true,
      diceType: 'd20',
      stats: [{ id: 'might', name: 'نیرو', baseValue: 10, description: 'نیروی بدنی' }],
      resources: [{ id: 'hp', name: 'سلامت', current: 30, max: 30, min: 0 }],
      abilities,
      skills: [],
      startingInventory: [],
      inventoryCapacity: 12,
    };

    it('awards +3 defense bonus when defending with a shield against projectiles', () => {
      const playerWithShield = makePlayerState({
        abilities: ['ab_shield_wall', 'ab_scribe_mistrust', 'ab_caravan'],
        inventory: [
          {
            id: 'sh_wood',
            name: 'سپر چوبی بارانداز',
            type: 'shield',
            quantity: 1,
            description: 'Sturdy wooden shield',
          },
        ],
        equipment: {
          offHand: 'sh_wood',
        },
      });

      const res = evaluatePassiveAbilities(
        'سپر را بالا می‌آورم تا تیرهای گزمه را مهار کنم و پشت دیواره پناه بگیرم',
        playerWithShield,
        rpgSystem
      );

      assert.equal(res.totalModifier, 3);
      assert.equal(res.appliedPassives.length, 1);
      assert.equal(res.appliedPassives[0].id, 'ab_shield_wall');
      assert.equal(res.appliedPassives[0].modifier, 3);
      assert.ok(res.appliedPassives[0].reason.includes('Shield Defense Bonus'));
    });

    it('does NOT award shield defense bonus when player has no shield equipped', () => {
      const playerWithoutShield = makePlayerState({
        abilities: ['ab_shield_wall'],
      });

      const res = evaluatePassiveAbilities(
        'سپر را بالا می‌آورم تا تیرها را مهار کنم',
        playerWithoutShield,
        rpgSystem
      );

      assert.equal(res.totalModifier, 0);
      assert.equal(res.appliedPassives.length, 0);
    });

    it('applies -3 social penalty when negotiating with scribes or administrative officials', () => {
      const player = makePlayerState({
        abilities: ['ab_scribe_mistrust'],
      });

      const res = evaluatePassiveAbilities(
        'تلاش برای متقاعد کردن کاتب دیوان جهت دریافت مجوز عبور بارها',
        player,
        rpgSystem
      );

      assert.equal(res.totalModifier, -3);
      assert.equal(res.appliedPassives.length, 1);
      assert.equal(res.appliedPassives[0].id, 'ab_scribe_mistrust');
      assert.equal(res.appliedPassives[0].modifier, -3);
    });

    it('awards caravan mastery bonus when handling beasts or navigating by stars', () => {
      const player = makePlayerState({
        abilities: ['ab_caravan'],
      });

      const res = evaluatePassiveAbilities(
        'مهار کردن شترهای وحشت‌زده کاروان در تاریکی دشت',
        player,
        rpgSystem
      );

      assert.equal(res.totalModifier, 2); // tier 1 * 2 = 2
      assert.equal(res.appliedPassives.length, 1);
      assert.equal(res.appliedPassives[0].id, 'ab_caravan');
    });
  });
});
