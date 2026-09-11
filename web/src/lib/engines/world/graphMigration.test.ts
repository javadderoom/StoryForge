import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  migrateStoryManifestToUnifiedGraph,
  getBeatsForChapter,
  getOpeningBeats,
  updateUnifiedChapterScenes,
  stripLegacyArcPrefix,
  normalizeBeatChoices,
} from './graphMigration';
import { StoryManifest } from '@/lib/types';
import { StoryBeat } from '@/lib/types/world';

describe('Plan 12 — Unified Beat Graph Migration', () => {
  const baseStory: StoryManifest = {
    id: 'story_mig',
    title: 'The Fractured Realm',
    tagline: 'Fantasy RPG',
    synopsis: 'A kingdom divided.',
    genres: ['fantasy'],
    language: 'en',
    author: 'StoryForge',
    version: '1.0.0',
    published: false,
    coverImageUrl: '',
    initialSceneId: 'scene_prologue',
    initialStoryBeats: [
      {
        sceneId: 'scene_prologue',
        locationId: 'loc_gate',
        narrativeText: 'Standing before the iron gates.',
        choices: [
          // Legacy destinationSceneId
          { id: 'c1', text: 'Enter', destinationSceneId: 'scene_courtyard' } as any,
        ],
      },
    ],
    saga: {
      sagaTitle: 'War of Crowns',
      premise: 'Three factions vie for the high throne.',
      chapters: [
        {
          id: 'ch_1',
          chapterNumber: 1,
          title: 'The Silent Infiltration',
          scopeTier: 'street',
          narrativeGoal: 'Gain entry to the lower district.',
          prerequisiteFlags: [],
          completionSummaryPrompt: '',
          scenes: [
            {
              sceneId: 'scene_courtyard',
              locationId: 'loc_yard',
              narrativeText: 'Guards patrol the misty yard.',
              choices: [
                { id: 'c2', text: 'Sneak past', style: 'agile', riskLevel: 'medium', destinationSceneId: 'scene_vault' } as any,
              ],
            },
            {
              sceneId: 'scene_vault',
              locationId: 'loc_vault',
              narrativeText: 'The vault door stands slightly ajar.',
              choices: [],
            },
          ],
        },
      ],
      ledger: {
        factionReputations: [],
        npcStatuses: [],
        keyItems: [],
        chapterSummaries: [],
        openPlotThreads: [],
      },
    },
    worldBible: {
      worldId: 'w1',
      worldName: 'Aethelgard',
      summary: '',
      themeNotes: '',
      laws: [],
      factions: [],
      locations: [],
      npcs: [],
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
      stats: [],
      resources: [],
      skills: [],
      startingInventory: [],
      archetypes: [],
      backgrounds: [],
    },
  };

  it('merges initialStoryBeats and chapter scenes into a unified collection', () => {
    const migrated = migrateStoryManifestToUnifiedGraph(baseStory);

    // Should have all 3 beats in initialStoryBeats
    assert.equal(migrated.initialStoryBeats.length, 3);
    assert.deepEqual(
      migrated.initialStoryBeats.map((b) => b.sceneId),
      ['scene_prologue', 'scene_courtyard', 'scene_vault']
    );

    // Opening beat has no chapterId
    const prologue = migrated.initialStoryBeats.find((b) => b.sceneId === 'scene_prologue')!;
    assert.equal(prologue.chapterId, undefined);

    // Chapter scenes are tagged with chapterId
    const courtyard = migrated.initialStoryBeats.find((b) => b.sceneId === 'scene_courtyard')!;
    assert.equal(courtyard.chapterId, 'ch_1');

    const vault = migrated.initialStoryBeats.find((b) => b.sceneId === 'scene_vault')!;
    assert.equal(vault.chapterId, 'ch_1');

    // Chapter scenes array is emptied (metadata-only chapter)
    assert.equal(migrated.saga?.chapters[0].scenes.length, 0);
  });

  it('remaps legacy destinationSceneId to targetSceneId', () => {
    const migrated = migrateStoryManifestToUnifiedGraph(baseStory);

    const prologue = migrated.initialStoryBeats.find((b) => b.sceneId === 'scene_prologue')!;
    assert.equal(prologue.choices[0].targetSceneId, 'scene_courtyard');

    const courtyard = migrated.initialStoryBeats.find((b) => b.sceneId === 'scene_courtyard')!;
    assert.equal(courtyard.choices[0].targetSceneId, 'scene_vault');
  });

  it('is strictly idempotent', () => {
    const once = migrateStoryManifestToUnifiedGraph(baseStory);
    const twice = migrateStoryManifestToUnifiedGraph(once);

    assert.equal(twice.initialStoryBeats.length, once.initialStoryBeats.length);
    assert.deepEqual(twice.initialStoryBeats, once.initialStoryBeats);
    assert.equal((twice as any).graphVersion, 2);
  });

  it('getBeatsForChapter and getOpeningBeats extract the proper subsets', () => {
    const migrated = migrateStoryManifestToUnifiedGraph(baseStory);

    const ch1Beats = getBeatsForChapter(migrated, 'ch_1');
    assert.equal(ch1Beats.length, 2);
    assert.equal(ch1Beats[0].sceneId, 'scene_courtyard');
    assert.equal(ch1Beats[1].sceneId, 'scene_vault');

    const opening = getOpeningBeats(migrated);
    assert.equal(opening.length, 1);
    assert.equal(opening[0].sceneId, 'scene_prologue');
  });

  it('updateUnifiedChapterScenes updates only that chapter beats in the unified list', () => {
    const migrated = migrateStoryManifestToUnifiedGraph(baseStory);

    const replacement: StoryBeat[] = [
      {
        sceneId: 'scene_courtyard_v2',
        locationId: 'loc_yard',
        narrativeText: 'Updated courtyard text',
        choices: [],
      },
    ];

    const updated = updateUnifiedChapterScenes(migrated, 'ch_1', replacement);

    const ch1Beats = getBeatsForChapter(updated, 'ch_1');
    assert.equal(ch1Beats.length, 1);
    assert.equal(ch1Beats[0].sceneId, 'scene_courtyard_v2');
    assert.equal(ch1Beats[0].chapterId, 'ch_1');

    // Opening beat is preserved
    const opening = getOpeningBeats(updated);
    assert.equal(opening.length, 1);
    assert.equal(opening[0].sceneId, 'scene_prologue');
  });

  it('stripLegacyArcPrefix removes [arc X] and [پرده X] prefixes cleanly', () => {
    assert.equal(
      stripLegacyArcPrefix('[arc 1] The siege begins with catapult fire.'),
      'The siege begins with catapult fire.'
    );
    assert.equal(
      stripLegacyArcPrefix('[Arc 2] Confronting the council.'),
      'Confronting the council.'
    );
    assert.equal(
      stripLegacyArcPrefix('[پرده ۱] باران خاکستر بر سر شهر می‌بارد.'),
      'باران خاکستر بر سر شهر می‌بارد.'
    );
    assert.equal(
      stripLegacyArcPrefix('[پرده 3] نبرد نهایی در بارو.'),
      'نبرد نهایی در بارو.'
    );
    assert.equal(
      stripLegacyArcPrefix('A normal narrative text without any bracketed arc prefix.'),
      'A normal narrative text without any bracketed arc prefix.'
    );
    assert.equal(stripLegacyArcPrefix(''), '');
  });

  it('normalizeBeatChoices and migrateStoryManifest sanitize [arc 1] prefixes automatically', () => {
    const beatWithArcPrefix: StoryBeat = {
      sceneId: 'sc_arc_test',
      locationId: 'loc_1',
      narrativeText: '[arc 1] Ambush in the foggy alleyway.\n\nBandits appear!',
      choices: [
        { id: 'c1', text: 'Fight back', style: 'aggressive', riskLevel: 'high' } as any,
      ],
    };

    const normalized = normalizeBeatChoices(beatWithArcPrefix);
    assert.equal(normalized.narrativeText, 'Ambush in the foggy alleyway.\n\nBandits appear!');
    assert.equal(normalized.narrativeText.includes('[arc 1]'), false);
  });
});
