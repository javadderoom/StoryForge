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

  it('omits expanded sections when absent and works in Persian', () => {
    const env = makeEnvelope({ languageDirective: 'fa', authoredSystemPrompt: 'با لحن سوگوار بنویس.' });
    const { userPrompt, systemPrompt, isEnglish } = PromptAssembler.buildNarrativePrompt(env);
    assert.equal(isEnglish, false);
    assert.ok(systemPrompt.includes('با لحن سوگوار بنویس.'));
    assert.ok(!userPrompt.includes('FACTIONS & POWER BLOCS'));
    assert.ok(!userPrompt.includes('WORLD SUMMARY'));
  });
});
