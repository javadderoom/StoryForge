import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isPlaceholderBeat,
  evictPlaceholderBeats,
  resolveSceneChoiceEdges,
} from './sceneResolution';
import { StoryBeat } from '@/lib/types/world';

describe('sceneResolution — Plan 12 Phase 1 edge key & placeholder engine', () => {
  it('correctly identifies placeholder seed beats', () => {
    const faPlaceholder: StoryBeat = {
      sceneId: 'scene_seed_1',
      locationId: '',
      narrativeText: 'نقطه شروع داستان. اینجا روایت آغاز می‌شود...',
      choices: [],
    };
    const enPlaceholder: StoryBeat = {
      sceneId: 'scene_seed_2',
      locationId: '',
      narrativeText: 'The story begins here. Write the opening narrative...',
      choices: [],
    };
    const realBeat: StoryBeat = {
      sceneId: 'scene_real_1',
      locationId: 'loc_market',
      narrativeText: 'The market was crowded with whispering spies.',
      choices: [
        {
          id: 'c1',
          text: 'Listen closely',
          style: 'inquisitive',
          riskLevel: 'low',
        },
      ],
    };

    assert.equal(isPlaceholderBeat(faPlaceholder), true);
    assert.equal(isPlaceholderBeat(enPlaceholder), true);
    assert.equal(isPlaceholderBeat(realBeat), false);
  });

  it('evicts placeholder beats when real authored beats exist', () => {
    const placeholder: StoryBeat = {
      sceneId: 'scene_placeholder',
      locationId: '',
      narrativeText: 'نقطه شروع داستان. اینجا روایت آغاز می‌شود...',
      choices: [],
    };
    const realBeat1: StoryBeat = {
      sceneId: 'scene_1',
      locationId: 'loc_1',
      narrativeText: 'Scene 1',
      choices: [{ id: 'c1', text: 'Go to 2', style: 'defensive', riskLevel: 'low' }],
    };
    const realBeat2: StoryBeat = {
      sceneId: 'scene_2',
      locationId: 'loc_2',
      narrativeText: 'Scene 2',
      choices: [],
    };

    const evicted = evictPlaceholderBeats([placeholder, realBeat1, realBeat2]);
    assert.equal(evicted.length, 2);
    assert.equal(evicted[0].sceneId, 'scene_1');
    assert.equal(evicted[1].sceneId, 'scene_2');
  });

  it('keeps the single placeholder if no real beats exist yet', () => {
    const placeholder: StoryBeat = {
      sceneId: 'scene_placeholder',
      locationId: '',
      narrativeText: 'The story begins here. Write the opening narrative...',
      choices: [],
    };

    const result = evictPlaceholderBeats([placeholder]);
    assert.equal(result.length, 1);
    assert.equal(result[0].sceneId, 'scene_placeholder');
  });

  it('resolves exact choice targets and strips legacy keys', () => {
    const beats: StoryBeat[] = [
      {
        sceneId: 'scene_intro',
        locationId: 'loc_1',
        narrativeText: 'Intro scene',
        choices: [
          {
            id: 'c1',
            text: 'Enter the crypt',
            style: 'aggressive',
            riskLevel: 'high',
            targetSceneId: 'scene_crypt',
          },
          {
            id: 'c2',
            text: 'Flee to village',
            style: 'agile',
            riskLevel: 'medium',
            destinationSceneId: 'scene_village',
          } as any,
        ],
      },
      {
        sceneId: 'scene_crypt',
        locationId: 'loc_crypt',
        narrativeText: 'The cold crypt',
        choices: [],
      },
      {
        sceneId: 'scene_village',
        locationId: 'loc_village',
        narrativeText: 'The safe village',
        choices: [],
      },
    ];

    const { resolvedBeats, unresolvedCount } = resolveSceneChoiceEdges(beats);
    assert.equal(unresolvedCount, 0);
    assert.equal(resolvedBeats[0].choices[0].targetSceneId, 'scene_crypt');
    assert.equal(resolvedBeats[0].choices[1].targetSceneId, 'scene_village');
    assert.equal((resolvedBeats[0].choices[1] as any).destinationSceneId, undefined);
  });

  it('resolves scene targets via title/narrative slug matching', () => {
    const beats: StoryBeat[] = [
      {
        sceneId: 'scene_gate',
        locationId: 'loc_1',
        narrativeText: 'At the fortress gate',
        choices: [
          {
            id: 'c1',
            text: 'Climb the Watchtower',
            style: 'agile',
            riskLevel: 'medium',
            leadToSceneId: 'Watchtower Lookout',
          } as any,
        ],
      },
      {
        sceneId: 'scene_watchtower_09a',
        locationId: 'loc_watchtower',
        narrativeText: 'Watchtower Lookout\n\nWind howls violently over the battlements.',
        choices: [],
      },
    ];

    const { resolvedBeats, unresolvedCount } = resolveSceneChoiceEdges(beats);
    assert.equal(unresolvedCount, 0);
    assert.equal(resolvedBeats[0].choices[0].targetSceneId, 'scene_watchtower_09a');
    assert.equal((resolvedBeats[0].choices[0] as any).leadToSceneId, undefined);
  });

  it('clears hallucinated IDs and warns rather than persisting broken links', () => {
    const beats: StoryBeat[] = [
      {
        sceneId: 'scene_lost',
        locationId: 'loc_1',
        narrativeText: 'Lost in the mist',
        choices: [
          {
            id: 'c1',
            text: 'Follow hallucinated ghost',
            style: 'defensive',
            riskLevel: 'low',
            targetSceneId: 'scene_phantom_dimension_999',
          },
        ],
      },
    ];

    const { resolvedBeats, unresolvedCount, warnings } = resolveSceneChoiceEdges(beats);
    assert.equal(unresolvedCount, 1);
    assert.equal(resolvedBeats[0].choices[0].targetSceneId, undefined);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /scene_phantom_dimension_999/);
  });
});
