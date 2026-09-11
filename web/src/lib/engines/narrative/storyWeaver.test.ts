import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWeavePrompt,
  coerceWeave,
  auditWeaveQuality,
  StoryWeaveDraft,
} from './storyWeaver';
import { StoryBeat } from '@/lib/types/world';
import { StoryManifest } from '@/lib/types';

describe('StoryWeaver Engine — Plan 12 Phase 2', () => {
  const mockStory: StoryManifest = {
    id: 'story_test',
    title: 'Shadows of the Spire',
    tagline: 'Grimdark mystery',
    synopsis: 'A lone investigator uncovers heresy in the sunken arches.',
    genres: ['dark-fantasy'],
    language: 'en',
    author: 'Author',
    version: '1.0.0',
    published: false,
    coverImageUrl: '',
    initialSceneId: 'scene_seed_1',
    initialStoryBeats: [],
    worldBible: {
      worldId: 'w1',
      worldName: 'Aethelgard',
      summary: '',
      themeNotes: 'Grimdark, gothic',
      laws: [],
      factions: [{ id: 'fac_1', name: 'The Silent Clergy', description: '', alignment: 'Lawful', publicGoals: '', secretAgendas: '', territoryIds: [], alliedFactionIds: [], rivalFactionIds: [] }],
      locations: [
        { id: 'loc_citadel', name: 'Obsidian Citadel', description: '', region: 'Citadel', dangerLevel: 2, connectedLocationIds: [], atmosphere: 'Gloomy, damp stone' },
        { id: 'loc_crypt', name: 'Sunken Crypts', description: '', region: 'Underground', dangerLevel: 4, connectedLocationIds: [], atmosphere: 'Ancient tombs, claustrophobic' },
      ],
      npcs: [{
        id: 'npc_elena',
        name: 'Inquisitor Elena',
        title: 'High Inquisitor',
        role: 'Inquisitor',
        factionId: 'fac_1',
        currentLocationId: 'loc_citadel',
        personalityTraits: ['Stern', 'Devout'],
        speechStyle: 'Cold, calculated questions',
        goals: ['Uncover heretics in the spire'],
        initialTrust: 20,
        secrets: [],
      }],
      timeline: [],
      artifacts: [],
      bestiary: [],
      religions: [],
      dramaBonds: [],
    },
    rpgSystem: {
      hasCombat: true,
      diceType: 'd20',
      inventoryCapacity: 10,
      stats: [
        { id: 'might', name: 'Might', description: '', baseValue: 10 },
        { id: 'arcana', name: 'Arcana', description: '', baseValue: 10 },
      ],
      resources: [],
      skills: [],
      startingInventory: [],
      archetypes: [],
      backgrounds: [],
    },
  };

  const anchor1: StoryBeat = {
    sceneId: 'scene_anchor_dock',
    locationId: 'loc_citadel',
    narrativeText: 'You arrive at the mist-shrouded docks of the Obsidian Citadel. Inquisitor Elena waits beneath an iron lantern.',
    choices: [
      { id: 'c1', text: 'Greet Elena formally', style: 'defensive', riskLevel: 'low' },
    ],
  };

  const anchor2: StoryBeat = {
    sceneId: 'scene_anchor_vault',
    locationId: 'loc_crypt',
    narrativeText: 'Deep inside the Sunken Crypts, the black altar hums with forbidden ritual power.',
    choices: [
      { id: 'c2', text: 'Smash the altar', style: 'aggressive', riskLevel: 'high' },
    ],
  };

  it('buildWeavePrompt formats prompt with anchors, locations, and RPG stats', () => {
    const { promptText, schemaInstruction } = buildWeavePrompt({
      story: mockStory,
      anchors: [anchor1, anchor2],
      scope: 'act',
      actGoal: 'Infiltrate the lower crypts and secure the relic',
      chapterNumber: 1,
      rpgStatIds: ['might', 'arcana'],
      isPersian: false,
    });

    assert.match(promptText, /Obsidian Citadel/);
    assert.match(promptText, /Inquisitor Elena/);
    assert.match(promptText, /scene_anchor_dock/);
    assert.match(promptText, /scene_anchor_vault/);
    assert.match(promptText, /might, arcana/);
    assert.match(schemaInstruction, /leadToRef/);
  });

  it('coerceWeave preserves anchor text verbatim and assigns server-side bridge IDs', () => {
    const draft: StoryWeaveDraft = {
      sequence: [
        {
          order: 1,
          kind: 'anchor',
          anchorSceneId: 'scene_anchor_dock',
          title: 'Dock Arrival',
          choices: [
            {
              textEn: 'Follow Elena into the catacombs',
              style: 'tactical_agile',
              leadToRef: 'new:catacombs_bridge',
            },
          ],
        },
        {
          order: 2,
          kind: 'bridge',
          slug: 'catacombs_bridge',
          title: 'The Winding Stair',
          settingLocationName: 'Obsidian Citadel',
          narrativeText: 'The descent is treacherous. Elena warns you of subterranean patrols.',
          carryoverSummary: 'Escaping notice of dock wardens.',
          choices: [
            {
              textEn: 'Descend quietly',
              style: 'defensive_diplomatic',
              leadToRef: 'anchor:scene_anchor_vault',
            },
          ],
        },
        {
          order: 3,
          kind: 'anchor',
          anchorSceneId: 'scene_anchor_vault',
          title: 'The Black Altar',
          choices: [
            {
              textEn: 'Seize the relic',
              style: 'aggressive_daring',
              statCheck: { stat: 'might', dc: 14 },
              leadToRef: 'new:climax_escape',
            },
          ],
        },
        {
          order: 4,
          kind: 'expansion',
          slug: 'climax_escape',
          title: 'Flight through the Aqueduct',
          settingLocationName: 'Sunken Crypts',
          narrativeText: 'The cavern trembles as subterranean waters breach the walls.',
          choices: [
            {
              textEn: 'Dive into the rushing current',
              style: 'tactical_agile',
              statCheck: { stat: 'might', dc: 15 },
            },
          ],
        },
      ],
    };

    const coerced = coerceWeave(draft, [anchor1, anchor2], mockStory.worldBible.locations);

    assert.equal(coerced.length, 4);

    // Anchor 1 preserved verbatim
    assert.equal(coerced[0].sceneId, 'scene_anchor_dock');
    assert.equal(coerced[0].narrativeText, anchor1.narrativeText);
    assert.equal(coerced[0].locationId, 'loc_citadel');

    // Bridge 2 assigned server-side ID starting with scene_catacombs_bridge_
    assert.match(coerced[1].sceneId, /^scene_catacombs_bridge_/);
    assert.equal(coerced[0].choices[0].targetSceneId, coerced[1].sceneId);

    // Bridge 2 links to Anchor 3
    assert.equal(coerced[1].choices[0].targetSceneId, 'scene_anchor_vault');

    // Anchor 3 preserved verbatim
    assert.equal(coerced[2].sceneId, 'scene_anchor_vault');
    assert.equal(coerced[2].narrativeText, anchor2.narrativeText);
    assert.equal(coerced[2].locationId, 'loc_crypt');

    // Expansion 4 resolved from Anchor 3
    assert.match(coerced[3].sceneId, /^scene_climax_escape_/);
    assert.equal(coerced[2].choices[0].targetSceneId, coerced[3].sceneId);
  });

  it('auditWeaveQuality flags omitted or mutated anchors and dangling edges', () => {
    // Missing anchor2 and broken target
    const flawedBeats = [
      {
        sceneId: 'scene_anchor_dock',
        locationId: 'loc_citadel',
        narrativeText: 'Wrong text (mutated!)', // Mutated
        choices: [
          { id: 'c1', text: 'Explore', style: 'agile' as const, riskLevel: 'low' as const, targetSceneId: 'scene_non_existent' }, // Dangling
          { id: 'c2', text: 'Explore', style: 'agile' as const, riskLevel: 'low' as const }, // Duplicate text
        ],
        kind: 'anchor' as const,
        order: 1,
        title: 'Dock',
      },
    ];

    const audit = auditWeaveQuality({
      weavedBeats: flawedBeats,
      expectedAnchors: [anchor1, anchor2],
      rpgStatIds: ['might', 'arcana'],
    });

    assert.ok(audit.score < 70);
    assert.ok(audit.findings.some((f) => f.category === 'anchor_missing'));
    assert.ok(audit.findings.some((f) => f.category === 'anchor_mutated'));
    assert.ok(audit.findings.some((f) => f.category === 'dangling_edge'));
    assert.ok(audit.findings.some((f) => f.category === 'choice_diversity'));
  });

  it('auditWeaveQuality gives high score to compliant weave', () => {
    const compliantBeats = [
      {
        sceneId: 'scene_anchor_dock',
        locationId: 'loc_citadel',
        narrativeText: anchor1.narrativeText,
        choices: [
          { id: 'c1', text: 'Step forward', style: 'defensive' as const, riskLevel: 'low' as const, targetSceneId: 'scene_b2' },
          { id: 'c2', text: 'Observe from shadows', style: 'agile' as const, riskLevel: 'medium' as const, targetSceneId: 'scene_b2' },
        ],
        kind: 'anchor' as const,
        order: 1,
        title: 'Dock Arrival',
      },
      {
        sceneId: 'scene_b2',
        locationId: 'loc_citadel',
        narrativeText: 'The cold winds blow through the ancient streets. The way ahead is fraught with unknown sentries and hidden passages.',
        choices: [
          { id: 'c3', text: 'Dash across the courtyard', style: 'aggressive' as const, riskLevel: 'high' as const },
        ],
        kind: 'bridge' as const,
        order: 2,
        title: 'Courtyard Passage',
      },
    ];

    const audit = auditWeaveQuality({
      weavedBeats: compliantBeats,
      expectedAnchors: [anchor1],
      rpgStatIds: ['might', 'arcana'],
    });

    assert.ok(audit.score >= 90);
    assert.equal(audit.findings.length, 0);
  });
});
