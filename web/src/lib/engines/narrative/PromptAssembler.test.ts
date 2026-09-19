import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PromptAssembler } from './PromptAssembler';
import { WorkingContextEnvelope } from '../../types/memory';

function makeEnvelope(overrides: Partial<WorkingContextEnvelope> = {}): WorkingContextEnvelope {
  return {
    storyTitle: 'Test Tale',
    worldLaws: ['Magic requires a focus.'],
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

describe('PromptAssembler - scene continuity', () => {
  const statCases: Array<Record<string, number>> = [{}, { might: 10 }];
  for (const languageDirective of ['en', 'fa'] as const) {
    for (const stats of statCases) {
      it(`preserves action scope, witnesses, and choice premises (${languageDirective}, ${Object.keys(stats).length} stats)`, () => {
        const outcome = {
          actionText: 'Push through the sentries',
          outcome: 'success' as const,
          consequence: 'A narrow opening appears in their line.',
        };
        const recentScene = 'Armed sentries block the exit beside the merchant.';
        const { systemPrompt, userPrompt } = PromptAssembler.buildNarrativePrompt(makeEnvelope({
          languageDirective,
          playerStatus: { stats, resources: {}, equippedItems: [] },
          resolvedGameOutcome: outcome,
          recentSceneSnippets: [recentScene],
        }));

        assert.ok(systemPrompt.includes('[SCENE CONTINUITY & CHOICE PREMISES]'));
        assert.ok(systemPrompt.includes("Resolve only the player's stated action against its actual target"));
        assert.ok(systemPrompt.includes('Preserve present participants, their positions, and unresolved threats'));
        assert.ok(systemPrompt.includes("account for witnesses' reactions"));
        assert.ok(systemPrompt.includes('must not present an unproven premise as fact'));
        assert.ok(systemPrompt.includes('Do not offer leverage that this scene has already spent'));
        assert.ok(systemPrompt.includes('without changing the authoritative game outcome'));
        assert.ok(userPrompt.includes(outcome.actionText));
        assert.ok(userPrompt.includes(outcome.consequence));
        assert.ok(userPrompt.includes(recentScene));
      });
    }
  }
});

describe('PromptAssembler - expanded world context', () => {
  it('injects the authored system prompt into the narrator persona (EN)', () => {
    const env = makeEnvelope({ authoredSystemPrompt: 'Write like a weary chronicler.' });
    const { systemPrompt } = PromptAssembler.buildNarrativePrompt(env);
    assert.ok(systemPrompt.includes('AUTHOR' + "'" + 'S DIRECTIVE'));
    assert.ok(systemPrompt.includes('Write like a weary chronicler.'));
  });

  it('renders expanded world sections (EN)', () => {
    const env = makeEnvelope({
      worldSummary: 'A dying realm.',
      themeNotes: 'Elegiac.',
      factions: ['The Ashen Order — Lawful. Goals: Suppress heresy'],
      timeline: ['Age of Ash: The Sundering — The old empire fell.'],
      artifacts: ['Ember Blade (legendary) — powers: burning edge; held by npc b'],
      bestiary: ['Gloom Hound (danger 3, beast) — weakness: light'],
      religions: ['Mourn, The Weeping Veil — domain: death. Dogma: Grief is holy.'],
      dramaBonds: ['Aria ↔ Borin (affinity -40)'],
      ontologySummary: 'Relation types: blood debt.',
    });
    const { userPrompt } = PromptAssembler.buildNarrativePrompt(env);
    assert.ok(userPrompt.includes('WORLD SUMMARY'));
    assert.ok(userPrompt.includes('A dying realm.'));
    assert.ok(userPrompt.includes('FACTIONS & POWER BLOCS'));
    assert.ok(userPrompt.includes('The Ashen Order'));
    assert.ok(userPrompt.includes('TIMELINE & HISTORY'));
    assert.ok(userPrompt.includes('ARTIFACTS & RELICS'));
    assert.ok(userPrompt.includes('BESTIARY & CREATURES'));
    assert.ok(userPrompt.includes('RELIGIONS & DEITIES'));
    assert.ok(userPrompt.includes('NPC RELATIONSHIPS'));
    assert.ok(userPrompt.includes('WORLD ONTOLOGY'));
  });

  it('renders NPC vitals lines for calibrated present NPCs (EN + FA)', () => {
    const dossiers = [{
      name: 'Gor',
      trust: -20,
      knownSecrets: [],
      speechStyle: 'Gruff',
      vitalsLine: 'boss CR14 — HP 120/150, Rage 3/5',
    }];
    const en = PromptAssembler.buildNarrativePrompt(makeEnvelope({ activeNpcDossiers: dossiers }));
    assert.ok(en.userPrompt.includes('PRESENT NPCS'));
    assert.ok(en.userPrompt.includes('Vitals: boss CR14 — HP 120/150, Rage 3/5'));
    const fa = PromptAssembler.buildNarrativePrompt(
      makeEnvelope({ languageDirective: 'fa', activeNpcDossiers: dossiers })
    );
    assert.ok(fa.userPrompt.includes('علائم حیاتی: boss CR14 — HP 120/150, Rage 3/5'));
    const plain = PromptAssembler.buildNarrativePrompt(makeEnvelope({
      activeNpcDossiers: [{ name: 'Pip', trust: 5, knownSecrets: [], speechStyle: 'Squeaky' }],
    }));
    assert.ok(!plain.userPrompt.includes('Vitals:'));
  });

  it('omits expanded sections when absent and works in Persian', () => {
    const env = makeEnvelope({ languageDirective: 'fa', authoredSystemPrompt: 'با لحن سوگوار بنویس.' });
    const { userPrompt, systemPrompt, isEnglish } = PromptAssembler.buildNarrativePrompt(env);
    assert.equal(isEnglish, false);
    assert.ok(systemPrompt.includes('با لحن سوگوار بنویس.'));
    assert.ok(!userPrompt.includes('FACTIONS & POWER BLOCS'));
    assert.ok(!userPrompt.includes('WORLD SUMMARY'));
  });

  it('tags present and nearby_resident NPCs with appropriate directives (EN + FA)', () => {
    const dossiers = [
      {
        name: 'Commander Vandad',
        trust: 0,
        knownSecrets: [],
        speechStyle: 'Authoritative',
        presenceStatus: 'nearby_resident' as const,
      },
      {
        name: 'Gate Sentry',
        trust: 0,
        knownSecrets: [],
        speechStyle: 'Gruff',
        presenceStatus: 'present' as const,
      },
    ];

    const en = PromptAssembler.buildNarrativePrompt(makeEnvelope({ activeNpcDossiers: dossiers }));
    assert.ok(en.userPrompt.includes('Commander Vandad [STATIONED AT LOCATION — NOT currently in this immediate scene]'));
    assert.ok(en.userPrompt.includes('Gate Sentry [PRESENT IN SCENE]'));
    assert.ok(en.userPrompt.includes('DIRECTIVE ON NPC PRESENCE'));
    assert.ok(en.systemPrompt.includes('TARGET FIDELITY'));
    assert.ok(en.systemPrompt.includes('PHYSICAL ENVIRONMENT CONTINUITY'));

    const fa = PromptAssembler.buildNarrativePrompt(
      makeEnvelope({ languageDirective: 'fa', activeNpcDossiers: dossiers })
    );
    assert.ok(fa.userPrompt.includes('Commander Vandad [مستقر در این پایگاه/مکان — هنوز در صحنه حاضر نیست]'));
    assert.ok(fa.userPrompt.includes('Gate Sentry [حاضر در صحنه]'));
    assert.ok(fa.userPrompt.includes('دستور حضور شخصیت‌ها'));
    assert.ok(fa.systemPrompt.includes('وفاداری به هدف اقدام (Target Fidelity)'));
    assert.ok(fa.systemPrompt.includes('پیوستگی محیطی'));
  });

  it('renders equipped item interactions catalogue and item fidelity directives in prompts (EN + FA)', () => {
    const catalogEn = '[EQUIPPED GEAR & ARTIFACT INTERACTION CATALOGUE]\n• Wooden Buckler: Kinetic physical protection';
    const catalogFa = '[کاتالوگ تعاملات و کارکرد تجهیزات همراه / EQUIPPED GEAR & ARTIFACT INTERACTION CATALOGUE]\n• سپر چوبی: پدافند فیزیکی فعال';

    const en = PromptAssembler.buildNarrativePrompt(
      makeEnvelope({
        languageDirective: 'en',
        playerStatus: {
          stats: { might: 12 },
          resources: { hp: 30 },
          equippedItems: ['Wooden Buckler'],
          itemInteractionsCatalog: catalogEn,
        },
      })
    );
    assert.ok(en.userPrompt.includes(catalogEn));
    assert.ok(en.systemPrompt.includes('ACTIVE ITEM & ARTIFACT INTEGRATION (ITEM FIDELITY)'));

    const fa = PromptAssembler.buildNarrativePrompt(
      makeEnvelope({
        languageDirective: 'fa',
        playerStatus: {
          stats: { might: 12 },
          resources: { hp: 30 },
          equippedItems: ['سپر چوبی'],
          itemInteractionsCatalog: catalogFa,
        },
      })
    );
    assert.ok(fa.userPrompt.includes(catalogFa));
    assert.ok(fa.systemPrompt.includes('به‌کارگیری فعال تجهیزات و یادگارها (ITEM FIDELITY)'));
  });
});
