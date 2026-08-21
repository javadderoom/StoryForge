import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TimelineEventSchema,
  WorldArtifactSchema,
  WorldCreatureSchema,
  WorldDeitySchema,
  NPCDramaBondSchema,
  WorldLawSchema,
  WorldLocationSchema,
  WorldBibleSchema,
} from './world';

describe('WorldBibleSchema - Zod Runtime Schema Boundary Tests', () => {
  describe('TimelineEventSchema', () => {
    it('accepts valid timeline event', () => {
      const valid = {
        id: 'evt_ancient_war',
        yearOrEra: '300 Years Ago',
        title: 'The Great Siege',
        summary: 'The citadel was besieged by flame drakes.',
        significance: 'Extinguished the dragon flight.',
        knownByPublic: true,
        eraCategory: 'war',
      };
      const parsed = TimelineEventSchema.parse(valid);
      assert.equal(parsed.eraCategory, 'war');
      assert.equal(parsed.title, 'The Great Siege');
    });

    it('rejects timeline event with invalid eraCategory', () => {
      const invalid = {
        id: 'evt_invalid',
        yearOrEra: '100 BC',
        title: 'Test',
        eraCategory: 'futuristic_sci_fi_era', // Invalid
      };
      assert.throws(() => TimelineEventSchema.parse(invalid));
    });
  });

  describe('WorldArtifactSchema', () => {
    it('accepts valid artifact with powers and attunement rules', () => {
      const valid = {
        id: 'art_sun_blade',
        name: 'Sun Blade',
        title: 'Blade of Light',
        originEra: 'Age of Dawn',
        rarity: 'mythic',
        description: 'Blazing sword of pure light.',
        powers: ['+5 Radiant Damage', 'Illuminate darkness'],
        curseOrCost: 'Blinds user in dark environments',
        attunementRules: 'Requires Might 14',
        currentHolderType: 'npc',
        currentHolderId: 'npc_hero',
      };
      const parsed = WorldArtifactSchema.parse(valid);
      assert.equal(parsed.rarity, 'mythic');
      assert.equal(parsed.powers.length, 2);
    });

    it('rejects artifact with invalid rarity tier', () => {
      const invalid = {
        id: 'art_fake',
        name: 'Fake Relic',
        rarity: 'super_ultra_divine', // Invalid
      };
      assert.throws(() => WorldArtifactSchema.parse(invalid));
    });
  });

  describe('WorldCreatureSchema', () => {
    it('accepts valid creature with danger ratings 1 through 5', () => {
      const valid = {
        id: 'creature_spider',
        name: 'Cave Spider',
        speciesCategory: 'beast',
        dangerLevel: 2,
        habitatLocationIds: ['loc_cave'],
        behavioralTactics: 'Ambush from above',
        weaknesses: ['Fire'],
        resistances: ['Poison'],
        harvestableLoot: [{ itemId: 'silk', name: 'Spider Silk', dropRate: '80%' }],
        loreDescription: 'Venomous subterranean arachnid.',
      };
      const parsed = WorldCreatureSchema.parse(valid);
      assert.equal(parsed.dangerLevel, 2);
      assert.equal(parsed.speciesCategory, 'beast');
    });

    it('rejects creature with invalid danger level out of 1-5 bounds', () => {
      const invalid = {
        id: 'creature_overpowered',
        name: 'Cosmic Destroyer',
        dangerLevel: 10, // Invalid: must be 1, 2, 3, 4, or 5
      };
      assert.throws(() => WorldCreatureSchema.parse(invalid));
    });
  });

  describe('WorldDeitySchema', () => {
    it('accepts valid deity with dogma and blessings', () => {
      const valid = {
        id: 'deity_sol',
        name: 'Sol Invictus',
        title: 'Lord of the Blazing Noon',
        domain: 'light',
        sacredSymbol: 'Solar Disk',
        coreDogma: 'Bring order to the chaos.',
        taboos: ['Cowardice', 'Shadow sorcery'],
        divineBlessings: ['Courage in battle'],
        affiliatedFactionIds: ['fac_paladins'],
        holyLocationIds: ['loc_temple'],
      };
      const parsed = WorldDeitySchema.parse(valid);
      assert.equal(parsed.domain, 'light');
      assert.equal(parsed.taboos.length, 2);
    });
  });

  describe('NPCDramaBondSchema', () => {
    it('accepts valid drama bond with positive or negative affinity', () => {
      const validNegative = {
        id: 'bond_rivalry',
        sourceNpcId: 'npc_a',
        targetNpcId: 'npc_b',
        relationTypeId: 'blood_debt',
        affinity: -80,
        secretTension: 'Accused of regicide',
        isPublic: false,
      };
      const parsed = NPCDramaBondSchema.parse(validNegative);
      assert.equal(parsed.affinity, -80);
      assert.equal(parsed.isPublic, false);
    });

    it('rejects affinity greater than 100 or less than -100', () => {
      assert.throws(() =>
        NPCDramaBondSchema.parse({
          id: 'bond_bad',
          sourceNpcId: 'npc_a',
          targetNpcId: 'npc_b',
          affinity: 150, // Out of bounds
        })
      );
      assert.throws(() =>
        NPCDramaBondSchema.parse({
          id: 'bond_bad_2',
          sourceNpcId: 'npc_a',
          targetNpcId: 'npc_b',
          affinity: -200, // Out of bounds
        })
      );
    });
  });

  describe('WorldLawSchema', () => {
    it('enforces that laws must be strictly immutable', () => {
      const valid = {
        id: 'law_1',
        rule: 'Dead souls cannot return without sacrifice.',
        description: 'Cosmic law of soul conservation.',
        category: 'magic',
        isImmutable: true,
      };
      const parsed = WorldLawSchema.parse(valid);
      assert.equal(parsed.isImmutable, true);

      const invalid = {
        id: 'law_2',
        rule: 'Mortal rule',
        description: 'A mutable rule',
        isImmutable: false, // Invalid: World Laws are absolute
      };
      assert.throws(() => WorldLawSchema.parse(invalid));
    });
  });
});
