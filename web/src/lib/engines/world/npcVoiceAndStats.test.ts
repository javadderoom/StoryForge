import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEntity } from './ActionNormalizer';
import type { NPCDossier, NpcVoiceGuide, NpcStatCalibration } from '@/lib/types';

describe('NPC Voice & Dialogue Guides and RPG Stats Normalization', () => {
  it('normalizes voiceGuide with English structure and clamps invalid contexts', () => {
    const rawNpc = {
      name: 'Rolan',
      voiceGuide: {
        speechQuirks: ['Speaks softly'],
        sampleDialogue: [
          { context: 'greeting', quote: 'Hail traveller.' },
          { context: 'unknown_context', quote: 'Hold fast.' },
        ],
        negotiationVulnerabilities: ['Gold', 'Ancient books'],
        psychologicalBreakingPoint: 'When his fortress falls.',
      },
    };

    const normalized = normalizeEntity('npc', rawNpc);
    assert.ok(normalized.voiceGuide);
    assert.deepEqual(normalized.voiceGuide.speechQuirks, ['Speaks softly']);
    assert.equal(normalized.voiceGuide.sampleDialogue.length, 2);
    assert.equal(normalized.voiceGuide.sampleDialogue[0].context, 'greeting');
    assert.equal(normalized.voiceGuide.sampleDialogue[0].quote, 'Hail traveller.');
    // Clamped fallback to greeting
    assert.equal(normalized.voiceGuide.sampleDialogue[1].context, 'greeting');
    assert.equal(normalized.voiceGuide.psychologicalBreakingPoint, 'When his fortress falls.');
  });

  it('normalizes Persian field keys for voiceGuide and sampleDialogue', () => {
    const rawPersianNpc = {
      نام: 'کاپیتان رولان',
      'راهنمای گفتار': {
        'تکیه‌کلام‌ها': ['با طمأنینه سخن می‌گوید'],
        'دیالوگ‌ها': [
          { context: 'threatened', quote: 'تیغ من خطا نمی‌شناسد.' },
        ],
        'نقاط اثرپذیری': ['سوگند شرافت'],
        'نقطه شکست روانی': 'مرگ سربازانش',
      },
    };

    const normalized = normalizeEntity('npc', rawPersianNpc);
    assert.equal(normalized.name, 'کاپیتان رولان');
    assert.ok(normalized.voiceGuide);
    assert.deepEqual(normalized.voiceGuide.speechQuirks, ['با طمأنینه سخن می‌گوید']);
    assert.equal(normalized.voiceGuide.sampleDialogue[0].quote, 'تیغ من خطا نمی‌شناسد.');
    assert.deepEqual(normalized.voiceGuide.negotiationVulnerabilities, ['سوگند شرافت']);
    assert.equal(normalized.voiceGuide.psychologicalBreakingPoint, 'مرگ سربازانش');
  });

  it('normalizes statCalibration and clamps challenge rating to 1-30', () => {
    const rawNpc = {
      name: 'Elena',
      statCalibration: {
        combatTier: 'boss',
        challengeRating: 35, // out of bounds
        statRatings: { STR: 18, DEX: 14, CON: 16 },
        signatureAbilities: ['Flame Wave', 'Shield Slam'],
        equippedGear: [
          { name: 'Sunblade', type: 'weapon' },
        ],
      },
    };

    const normalized = normalizeEntity('npc', rawNpc);
    assert.ok(normalized.statCalibration);
    assert.equal(normalized.statCalibration.combatTier, 'boss');
    assert.equal(normalized.statCalibration.challengeRating, 30); // clamped to 30
    assert.equal(normalized.statCalibration.statRatings.STR, 18);
    assert.deepEqual(normalized.statCalibration.signatureAbilities, ['Flame Wave', 'Shield Slam']);
    assert.equal(normalized.statCalibration.equippedGear[0].name, 'Sunblade');
    // Vitals default to fully-rested 10/10 health when absent
    assert.deepEqual(normalized.statCalibration.vitals.health, { current: 10, max: 10 });
    assert.deepEqual(normalized.statCalibration.resourcePools, []);
  });

  it('passes cosmic CR and over-cap statRatings through unclamped', () => {
    const rawNpc = {
      name: 'Void Sovereign',
      statCalibration: {
        combatTier: 'mythic',
        challengeRating: 28,
        crBasis: 'commands the outer dark',
        statRatings: { might: 32, arcana: 29, cunning: 24 },
        signatureAbilities: ['Unmake Epoch'],
        equippedGear: [],
      },
    };

    const normalized = normalizeEntity('npc', rawNpc);
    assert.equal(normalized.statCalibration.challengeRating, 28);
    assert.equal(normalized.statCalibration.statRatings.might, 32);
    assert.equal(normalized.statCalibration.statRatings.arcana, 29);
  });

  it('normalizes vitals and resource pools and clamps current into [0, max]', () => {
    const rawNpc = {
      name: 'Gor',
      statCalibration: {
        combatTier: 'elite',
        challengeRating: 9,
        vitals: {
          health: { current: 999, max: 64 },
          stamina: { current: 20, max: 20 },
          mana: { current: 0, max: 0 }, // invalid max floors to 1
        },
        resourcePools: [
          { id: 'rage', name: 'Rage', current: 7, max: 5 }, // overfull clamps
          { name: 'Grit', max: 3 }, // missing current defaults to full
          null,
        ],
      },
    };

    const normalized = normalizeEntity('npc', rawNpc);
    // crBasis defaults to '' when CR is pure combat
    assert.equal(normalized.statCalibration.crBasis, '');
    assert.deepEqual(normalized.statCalibration.vitals.health, { current: 64, max: 64 });
    assert.deepEqual(normalized.statCalibration.vitals.stamina, { current: 20, max: 20 });
    assert.deepEqual(normalized.statCalibration.vitals.mana, { current: 0, max: 1 });
    assert.equal(normalized.statCalibration.resourcePools.length, 2);
    assert.deepEqual(normalized.statCalibration.resourcePools[0], { id: 'rage', name: 'Rage', current: 5, max: 5 });
    assert.deepEqual(normalized.statCalibration.resourcePools[1], { id: 'pool_1', name: 'Grit', current: 3, max: 3 });
  });

  it('resolves nested Persian vitals keys', () => {
    const rawNpc = {
      name: 'گر',
      statCalibration: {
        combatTier: 'veteran',
        'علائم حیاتی': {
          'جان': { 'فعلی': 30, 'حداکثر': 40 },
          'استقامت': { current: 12, max: 12 },
        },
        'مخازن منابع': [
          { 'نام': 'خشم', 'فعلی': 2, 'حداکثر': 4 },
        ],
      },
    };

    const normalized = normalizeEntity('npc', rawNpc);
    assert.deepEqual(normalized.statCalibration.vitals.health, { current: 30, max: 40 });
    assert.deepEqual(normalized.statCalibration.vitals.stamina, { current: 12, max: 12 });
    assert.equal(normalized.statCalibration.resourcePools[0].name, 'خشم');
    assert.equal(normalized.statCalibration.resourcePools[0].current, 2);
  });

  it('normalizes secret revealMethods: kinds, aliases, trimming, and drops junk', () => {
    const rawNpc = {
      name: 'Patient',
      secrets: [
        {
          id: 's1',
          description: 'Implant behind the eye',
          requiredTrustLevel: 60,
          revealMethods: [
            { kind: 'trust', trustThreshold: 60 },
            { kind: 'جراحی', ritual: '  surgery  ', detail: ' sedated ' },
            { kind: 'nonsense', foo: 1 },
            null,
            'junk',
          ],
        },
        null,
      ],
    };
    const normalized = normalizeEntity('npc', rawNpc);
    assert.equal(normalized.secrets.length, 1);
    const methods = normalized.secrets[0].revealMethods;
    assert.equal(methods.length, 3);
    assert.deepEqual(methods[0], { kind: 'trust', trustThreshold: 60 });
    assert.deepEqual(methods[1], { kind: 'ritual', ritual: 'surgery', detail: 'sedated' });
    assert.deepEqual(methods[2], { kind: 'trust' }); // unknown kind falls back
  });

  it('normalizes crBasis and its Persian aliases, coercing non-strings to empty', () => {
    const withBasis = normalizeEntity('npc', {
      name: 'Vizier',
      statCalibration: {
        combatTier: 'civilian',
        challengeRating: 12,
        crBasis: 'controls the court and the watch payroll',
      },
    });
    assert.equal(withBasis.statCalibration.crBasis, 'controls the court and the watch payroll');

    const persian = normalizeEntity('npc', {
      name: 'وزیر',
      statCalibration: {
        combatTier: 'civilian',
        challengeRating: 12,
        'منشأ خطر': 'نفوذ در دربار',
      },
    });
    assert.equal(persian.statCalibration.crBasis, 'نفوذ در دربار');

    const numeric = normalizeEntity('npc', {
      name: 'Barkeep',
      statCalibration: { combatTier: 'veteran', challengeRating: 3, crBasis: 42 },
    });
    assert.equal(numeric.statCalibration.crBasis, '');
  });

  it('allows cleanly setting, editing, and deleting voiceGuide and statCalibration on NPCDossier', () => {
    const npc: NPCDossier = {
      id: 'npc_1',
      name: 'Rolan',
      title: 'Captain',
      currentLocationId: 'loc_citadel',
      personalityTraits: ['Brave'],
      speechStyle: 'Formal',
      goals: ['Protect the realm'],
      secrets: [],
      initialTrust: 10,
    };

    // 1. Create / add voice guide
    const guide: NpcVoiceGuide = {
      npcName: 'Rolan',
      speechQuirks: ['Clears throat'],
      sampleDialogue: [{ context: 'greeting', quote: 'Stand firm.' }],
      negotiationVulnerabilities: ['Family'],
      psychologicalBreakingPoint: 'Defeat',
    };
    const withGuide = { ...npc, voiceGuide: guide };
    assert.ok(withGuide.voiceGuide);
    assert.equal(withGuide.voiceGuide.sampleDialogue.length, 1);

    // 2. Create / add stat calibration
    const stats: NpcStatCalibration = {
      npcId: 'npc_1',
      npcName: 'Rolan',
      combatTier: 'elite',
      challengeRating: 8,
      statRatings: { STR: 16, DEX: 12 },
      signatureAbilities: ['Parry'],
      equippedGear: [{ name: 'Iron Halberd', type: 'weapon' }],
      vitals: { health: { current: 60, max: 60 }, stamina: { current: 20, max: 20 } },
      resourcePools: [{ id: 'grit', name: 'Grit', current: 3, max: 3 }],
    };
    const withBoth = { ...withGuide, statCalibration: stats };
    assert.ok(withBoth.statCalibration);
    assert.equal(withBoth.statCalibration.combatTier, 'elite');

    // 3. Edit / modify sample dialogues
    const updatedGuide: NpcVoiceGuide = {
      ...withBoth.voiceGuide,
      sampleDialogue: [
        ...withBoth.voiceGuide.sampleDialogue,
        { context: 'dying', quote: 'The citadel... must hold...' },
      ],
    };
    const edited = { ...withBoth, voiceGuide: updatedGuide };
    assert.equal(edited.voiceGuide?.sampleDialogue.length, 2);

    // 4. Delete / unset voiceGuide and statCalibration
    const cleared = { ...edited, voiceGuide: undefined, statCalibration: undefined };
    assert.equal(cleared.voiceGuide, undefined);
    assert.equal(cleared.statCalibration, undefined);
    assert.equal(cleared.name, 'Rolan');
  });
});
