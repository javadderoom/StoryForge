import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  StoryChapterSchema,
  SagaManifestSchema,
  WorldStateLedgerSchema,
  EpicSagaSynthesisSchema,
  ScopeTierSchema,
} from './world';

const validScene = {
  sceneId: 'scene_breach',
  locationId: 'loc_iron_gate',
  narrativeText: 'The inciting breach tears through the guild quarter.',
  choices: [
    {
      id: 'choice_1',
      text: 'Hold the line at the gate',
      style: 'defensive',
      riskLevel: 'low',
      targetDC: 10,
      requiredStatId: 'might',
      targetSceneId: 'scene_fallback',
    },
  ],
};

describe('Plan 07 — Saga, Chapter & World State Ledger Schemas', () => {
  it('accepts a valid StoryChapter with scenes and defaults missing fields', () => {
    const result = StoryChapterSchema.safeParse({
      id: 'chapter_1',
      chapterNumber: 1,
      title: 'The Inciting Breach',
      scopeTier: 'street',
      narrativeGoal: 'Infiltrate the Iron Guild and obtain the sealed ledger',
      prerequisiteFlags: [],
      scenes: [validScene],
      completionSummaryPrompt: 'Compress the breach into one milestone rollup.',
    });

    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.scenes.length, 1);
      assert.equal(result.data.scenes[0].choices[0].riskLevel, 'low');
    }
  });

  it('applies defaults for optional chapter fields (scopeTier falls back to street)', () => {
    const result = StoryChapterSchema.safeParse({
      id: 'chapter_2',
      chapterNumber: 2,
      title: 'The Web of Factions',
    });
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.scopeTier, 'street');
      assert.deepEqual(result.data.prerequisiteFlags, []);
      assert.deepEqual(result.data.scenes, []);
    }
  });

  it('rejects an invalid scopeTier value', () => {
    const result = ScopeTierSchema.safeParse('galactic');
    assert.equal(result.success, false);
  });

  it('rejects a chapter numbered below 1', () => {
    const result = StoryChapterSchema.safeParse({
      id: 'chapter_0',
      chapterNumber: 0,
      title: 'Invalid Chapter',
    });
    assert.equal(result.success, false);
  });

  it('accepts a full SagaManifest with 5 escalating chapters and a ledger', () => {
    const tiers = ['street', 'regional', 'regional', 'continental', 'mythic'] as const;
    const saga = {
      sagaTitle: 'The March on the Ash Citadel',
      premise: 'A smuggler uncovers a plot that escalates into open war.',
      chapters: tiers.map((scopeTier, i) => ({
        id: `chapter_${i + 1}`,
        chapterNumber: i + 1,
        title: `Chapter ${i + 1}`,
        scopeTier,
        narrativeGoal: `Goal ${i + 1}`,
        prerequisiteFlags: i > 0 ? [`flag_ch${i}`] : [],
        scenes: [validScene],
        completionSummaryPrompt: `Rollup directive ${i + 1}`,
      })),
      ledger: {
        factionReputations: [
          {
            factionId: 'fac_syndicate',
            factionName: 'The Crimson Syndicate',
            score: 25,
            stance: 'allied',
            note: 'Smuggler pact honored',
          },
          {
            factionId: 'fac_holy_order',
            factionName: 'Holy Order',
            score: -60,
            stance: 'hostile',
          },
        ],
        npcStatuses: [
          { npcId: 'npc_vael', npcName: 'Commander Vael', status: 'dead', note: 'Poisoned in Ch1' },
          { npcId: 'npc_lyra', npcName: 'Lyra', status: 'companion' },
        ],
        keyItems: [
          {
            itemId: 'item_sealed_ledger',
            name: 'Sealed Ledger',
            description: 'Proof of the Inquisition debt trade.',
            acquiredChapterNumber: 1,
            isStoryCritical: true,
          },
        ],
        chapterSummaries: [
          {
            chapterNumber: 1,
            title: 'The Inciting Breach',
            summary:
              'The protagonist poisoned Commander Vael, befriended the Smuggler Guild, and lost the family heirloom.',
            irreversibleChoices: ['vael_poisoned'],
          },
        ],
        openPlotThreads: ['Who sealed the ledger?'],
      },
    };

    const result = SagaManifestSchema.safeParse(saga);
    assert.equal(result.success, true);
  });

  it('fills WorldStateLedger defaults for an empty payload', () => {
    const result = WorldStateLedgerSchema.safeParse({});
    assert.equal(result.success, true);
    if (result.success) {
      assert.deepEqual(result.data.factionReputations, []);
      assert.deepEqual(result.data.npcStatuses, []);
      assert.deepEqual(result.data.keyItems, []);
      assert.deepEqual(result.data.chapterSummaries, []);
      assert.deepEqual(result.data.openPlotThreads, []);
    }
  });

  it('clamps out-of-range reputation scores to the schema bounds (rejection)', () => {
    const result = WorldStateLedgerSchema.safeParse({
      factionReputations: [{ factionId: 'fac_x', score: 250 }],
    });
    assert.equal(result.success, false);
  });

  it('validates an AI epic_saga_synthesis draft payload', () => {
    const draft = {
      sagaTitle: 'Neon Requiem: The Long Rain',
      premise: 'A detective chases a ghost signal up the corporate ladder.',
      chapters: [1, 2, 3, 4, 5].map((n) => ({
        chapterNumber: n,
        title: `Act ${n}`,
        scopeTier: n <= 1 ? 'street' : n <= 3 ? 'regional' : n === 4 ? 'continental' : 'mythic',
        narrativeGoal: `Escalating goal ${n}`,
        prerequisiteFlags: [],
        completionSummaryPrompt: `Compress act ${n}`,
        scenes: [
          {
            sceneId: `sc_${n}_a`,
            title: 'Rain on Neon Glass',
            settingLocationName: 'Sector 4 Alley',
            primaryConflict: 'The informant is tailed by corp wraiths.',
            presentedChoices: [
              {
                style: 'defensive_diplomatic',
                textFa: 'پناه گرفتن در بار',
                textEn: 'Disappear into the rain',
                statCheck: { stat: 'stealth', dc: 12 },
                leadToSceneId: `sc_${n}_b`,
              },
              {
                style: 'tactical_agile',
                textFa: 'فرار از پشت‌بام‌ها',
                textEn: 'Rooftop escape',
              },
              {
                style: 'aggressive_daring',
                textFa: 'رویارویی مستقیم',
                textEn: 'Face the wraiths head-on',
                statCheck: { stat: 'might', dc: 16 },
              },
            ],
          },
        ],
      })),
    };

    const result = EpicSagaSynthesisSchema.safeParse(draft);
    assert.equal(result.success, true);
    if (result.success) {
      // Strict grounding check: early chapters must be low-scope.
      assert.equal(result.data.chapters[0].scopeTier, 'street');
      assert.equal(result.data.chapters[4].scopeTier, 'mythic');
    }
  });

  it('rejects saga drafts with fewer than 3 chapters', () => {
    const result = EpicSagaSynthesisSchema.safeParse({
      sagaTitle: 'Too Short',
      premise: 'Only two chapters is not an epic saga.',
      chapters: [
        {
          chapterNumber: 1,
          title: 'One',
          scopeTier: 'street',
          narrativeGoal: 'g',
          prerequisiteFlags: [],
          completionSummaryPrompt: '',
          scenes: [
            {
              sceneId: 'sc_1',
              title: 't',
              settingLocationName: 'l',
              primaryConflict: 'c',
              presentedChoices: [{ style: 'tactical_agile', textFa: 'ف', textEn: 'e' }],
            },
          ],
        },
        {
          chapterNumber: 2,
          title: 'Two',
          scopeTier: 'mythic',
          narrativeGoal: 'g',
          prerequisiteFlags: [],
          completionSummaryPrompt: '',
          scenes: [
            {
              sceneId: 'sc_2',
              title: 't',
              settingLocationName: 'l',
              primaryConflict: 'c',
              presentedChoices: [{ style: 'aggressive_daring', textFa: 'ف', textEn: 'e' }],
            },
          ],
        },
      ],
    });
    assert.equal(result.success, false);
  });
});
