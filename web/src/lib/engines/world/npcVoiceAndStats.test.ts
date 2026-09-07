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

  it('normalizes statCalibration and clamps challenge rating to 1-20', () => {
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
    assert.equal(normalized.statCalibration.challengeRating, 20); // clamped to 20
    assert.equal(normalized.statCalibration.statRatings.STR, 18);
    assert.deepEqual(normalized.statCalibration.signatureAbilities, ['Flame Wave', 'Shield Slam']);
    assert.equal(normalized.statCalibration.equippedGear[0].name, 'Sunblade');
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
