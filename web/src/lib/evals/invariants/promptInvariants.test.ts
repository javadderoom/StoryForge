import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PromptAssembler } from '@/lib/engines/narrative/PromptAssembler';
import { formatAbilitiesForContext } from '@/lib/engines/narrative/worldContext';
import { WorkingContextEnvelope } from '@/lib/types/memory';

function makeEnvelope(overrides: Partial<WorkingContextEnvelope> = {}): WorkingContextEnvelope {
  return {
    storyTitle: 'Invariant Tale',
    worldLaws: ['Magic is forbidden upon penalty of death.'],
    currentLocationName: 'The Hold',
    currentLocationDescription: 'A cold fortress.',
    activeNpcDossiers: [],
    relevantMemories: [],
    playerStatus: { stats: {}, resources: {}, equippedItems: [] },
    recentSceneSnippets: [],
    languageDirective: 'en',
    ...overrides,
  };
}

describe('Tier 1 — PromptAssembler invariants (EN)', () => {
  it('injects protagonist capabilities, abilities, gear, laws, and threat clocks', () => {
    const { systemPrompt, userPrompt } = PromptAssembler.buildNarrativePrompt(
      makeEnvelope({
        worldLaws: ['Magic is forbidden upon penalty of death.'],
        activeClocks: ['Castle Alarm: 4/4 — CRISIS TRIGGERED (crisis: the gates seal)'],
        playerStatus: {
          stats: { might: 14, agility: 12 },
          resources: { health: 30 },
          equippedItems: ['Spear of Dawn'],
          characterName: 'Arash',
          archetypeName: 'Iron Vanguard',
          abilities: ['Shield Wall'],
        },
      })
    );
    const all = `${systemPrompt}\n${userPrompt}`;
    assert.ok(all.includes('[PROTAGONIST STATUS & CAPABILITIES]'));
    assert.ok(all.includes('Known Abilities / Spells: Shield Wall'));
    assert.ok(all.includes('Equipped / Carried Gear: Spear of Dawn'));
    assert.ok(all.includes('[ACTIVE WORLD LAWS]'));
    assert.ok(all.includes('Magic is forbidden upon penalty of death.'));
    assert.ok(all.includes('[ACTIVE THREAT CLOCKS]'));
    assert.ok(all.includes('Castle Alarm: 4/4 — CRISIS TRIGGERED'));
  });

  it('always emits scene-continuity and knowledge-boundary guardrails', () => {
    const { systemPrompt } = PromptAssembler.buildNarrativePrompt(makeEnvelope());
    assert.ok(systemPrompt.includes('[SCENE CONTINUITY & CHOICE PREMISES]'));
    assert.ok(systemPrompt.includes('Do not offer leverage that this scene has already spent'));
    assert.ok(systemPrompt.includes('KNOWLEDGE BOUNDARY'));
  });

  it('passes RPG stat ids through for downstream choice validation', () => {
    const { playerStatIds } = PromptAssembler.buildNarrativePrompt(
      makeEnvelope({
        playerStatus: { stats: { might: 14, cunning: 11 }, resources: {}, equippedItems: [] },
      })
    );
    assert.deepEqual(playerStatIds, { might: 14, cunning: 11 });
  });
});

describe('Tier 1 — PromptAssembler invariants (FA parity)', () => {
  it('injects the same invariants in Persian', () => {
    const { systemPrompt, userPrompt } = PromptAssembler.buildNarrativePrompt(
      makeEnvelope({
        languageDirective: 'fa',
        worldLaws: ['جادو ممنوع است و کیفر آن مرگ است.'],
        activeClocks: ['زنگ خطر قلعه: ۴/۴'],
        playerStatus: {
          stats: { might: 14 },
          resources: { health: 30 },
          equippedItems: ['نیزهٔ سپیده‌دم'],
          characterName: 'آرش',
          abilities: ['سپر دیوار'],
        },
      })
    );
    const all = `${systemPrompt}\n${userPrompt}`;
    assert.ok(all.includes('[وضعیت و توانمندی‌های قهرمان داستان / PROTAGONIST STATUS]'));
    assert.ok(all.includes('توانایی‌ها و جادوهای فعال: سپر دیوار'));
    assert.ok(all.includes('[قوانین و محدودیت‌های جهان / ACTIVE WORLD LAWS]'));
    assert.ok(all.includes('جادو ممنوع است و کیفر آن مرگ است.'));
    assert.ok(all.includes('[ساعت‌های تهدید فعال / ACTIVE THREAT CLOCKS]'));
    assert.ok(systemPrompt.includes('[SCENE CONTINUITY & CHOICE PREMISES]'));
  });
});

describe('Tier 1 — DC calibration invariants', () => {
  it('uses the low-base band when universalBaseValue < 8', () => {
    const { systemPrompt } = PromptAssembler.buildNarrativePrompt(
      makeEnvelope({
        universalBaseValue: 5,
        playerStatus: { stats: { might: 5 }, resources: {}, equippedItems: [] },
      })
    );
    assert.ok(systemPrompt.includes('scale dynamically with risk and character progression'));
    assert.ok(systemPrompt.includes('late saga/heroic challenges scale up to 15-18'));
  });

  it('uses the standard heroic band when universalBaseValue >= 8', () => {
    const { systemPrompt } = PromptAssembler.buildNarrativePrompt(
      makeEnvelope({
        universalBaseValue: 10,
        playerStatus: { stats: { might: 14 }, resources: {}, equippedItems: [] },
      })
    );
    assert.ok(systemPrompt.includes('High risk: 14-16'));
  });
});

describe('Tier 1 — Power System Invariants', () => {
  it('injects protagonist power school rankings in English and Persian', () => {
    const activePowerRanks = [
      {
        schoolId: 'school_pyro',
        schoolName: 'Zarvanite Pyromancy',
        rank: 2,
        rankName: 'Flame-Weaver',
        rankTitle: 'Flame-Bearer',
        capabilities: 'Summons flame blades, immune to minor burns.',
        scope: 'heroic',
      },
    ];

    // English
    const en = PromptAssembler.buildNarrativePrompt(
      makeEnvelope({
        languageDirective: 'en',
        activePowerRanks,
      })
    );
    assert.ok(en.userPrompt.includes('[POWER SCHOOL RANKINGS & MASTERY]'));
    assert.ok(en.userPrompt.includes('Zarvanite Pyromancy: Rank 2 - Flame-Weaver (Flame-Bearer)'));
    assert.ok(en.userPrompt.includes('Summons flame blades'));

    // Persian
    const fa = PromptAssembler.buildNarrativePrompt(
      makeEnvelope({
        languageDirective: 'fa',
        activePowerRanks: [
          {
            schoolId: 'school_pyro',
            schoolName: 'جادوی آتش زروانی',
            rank: 2,
            rankName: 'آتش‌افروز',
            rankTitle: 'آذرخش‌بان',
            capabilities: 'احضار تیغه‌های آتشین و مصونیت در برابر سوختگی‌های سطحی',
            scope: 'heroic',
          },
        ],
      })
    );
    assert.ok(fa.userPrompt.includes('[مکاتب قدرت و درجات تسلط / POWER SYSTEM RANKINGS]'));
    assert.ok(fa.userPrompt.includes('جادوی آتش زروانی: مرتبه 2 - آتش‌افروز (آذرخش‌بان)'));
  });

  it('renders NPC power affiliations in present NPCs block', () => {
    const en = PromptAssembler.buildNarrativePrompt(
      makeEnvelope({
        languageDirective: 'en',
        activeNpcDossiers: [
          {
            name: 'Radman',
            trust: 10,
            knownSecrets: [],
            speechStyle: 'Gruff',
            powerAffiliationLine: 'Hiram Sandblade: Rank 2 (Wind-Slicer)',
          },
        ],
      })
    );
    assert.ok(en.userPrompt.includes('Power: [Hiram Sandblade: Rank 2 (Wind-Slicer)]'));
  });
});

describe('Tier 1 — Character Ability Invariants & Resolution', () => {
  it('resolves raw ability IDs into rich descriptors with names, types, and effects', () => {
    const story = {
      language: 'fa',
      rpgSystem: {
        abilities: [
          {
            id: 'ab_wall',
            name: 'دیوار بارانداز',
            type: 'passive_skill',
            description: 'دفاع با سپر در برابر پرتابه‌ها.',
            effectSummary: '+3 به درجه سختی دفاع',
          },
          {
            id: 'ab_spell',
            name: 'شعله سرخ',
            type: 'active_spell',
            description: 'پرتاب آتش به سوی دشمن.',
          },
        ],
      },
    };

    const formatted = formatAbilitiesForContext(
      { abilities: ['ab_wall', 'ab_spell', 'unregistered_ability'] },
      story
    );

    assert.equal(formatted.length, 3);
    assert.ok(formatted[0].includes('«دیوار بارانداز»'));
    assert.ok(formatted[0].includes('[مهارت غیرفعال]'));
    assert.ok(formatted[0].includes('+3 به درجه سختی دفاع'));
    assert.ok(formatted[1].includes('«شعله سرخ»'));
    assert.ok(formatted[1].includes('[ورد / جادوی فعال]'));
    assert.equal(formatted[2], 'unregistered_ability');
  });

  it('renders multi-ability list and ability choice directives in English and Persian prompts', () => {
    const en = PromptAssembler.buildNarrativePrompt(
      makeEnvelope({
        languageDirective: 'en',
        playerStatus: {
          stats: { might: 12 },
          resources: { health: 25 },
          equippedItems: ['Iron Shield'],
          abilities: [
            '"Quay Wall" — [Passive Skill] — Arrow defense bonus',
            '"Flame Jet" — [Active Spell] — Casts fire stream',
          ],
        },
      })
    );

    assert.ok(en.systemPrompt.includes('ACTIVE ABILITY & SPELL INTEGRATION (ABILITY FIDELITY)'));
    assert.ok(en.systemPrompt.includes('ABILITY & SPELL AWARENESS'));
    assert.ok(en.userPrompt.includes('• Known Abilities / Spells:'));
    assert.ok(en.userPrompt.includes('• "Quay Wall" — [Passive Skill] — Arrow defense bonus'));
    assert.ok(en.userPrompt.includes('• "Flame Jet" — [Active Spell] — Casts fire stream'));

    const fa = PromptAssembler.buildNarrativePrompt(
      makeEnvelope({
        languageDirective: 'fa',
        playerStatus: {
          stats: { might: 12 },
          resources: { health: 25 },
          equippedItems: ['سپر آهنی'],
          abilities: [
            '«دیوار بارانداز» — [مهارت غیرفعال] — افزایش دفاع',
            '«کاروان» — [خصلت و ویژگی ذاتی] — جهت‌یابی',
          ],
        },
      })
    );

    assert.ok(fa.systemPrompt.includes('به‌کارگیری فعال توانایی‌ها، مهارت‌ها و جادوها (ABILITY & SPELL FIDELITY)'));
    assert.ok(fa.systemPrompt.includes('وفاداری به توانایی‌ها و جادوها (Ability & Spell Awareness)'));
    assert.ok(fa.userPrompt.includes('• توانایی‌ها و جادوهای فعال:'));
    assert.ok(fa.userPrompt.includes('• «دیوار بارانداز» — [مهارت غیرفعال] — افزایش دفاع'));
    assert.ok(fa.userPrompt.includes('• «کاروان» — [خصلت و ویژگی ذاتی] — جهت‌یابی'));
  });
});

