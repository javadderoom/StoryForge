import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeChoiceLeadIn,
  stripDuplicateLeadInPrefix,
  combineLeadInAndContinuation,
} from './leadInValidator';
import { PromptAssembler } from './PromptAssembler';
import { generateValidatedScene } from './narrativeTurn';
import { ActionValidator } from '@/lib/engines/validator/ActionValidator';
import type { WorkingContextEnvelope } from '@/lib/types/memory';

describe('leadInValidator & pre-roll lead-in flow', () => {
  it('keeps valid outcome-neutral leadIns in Persian and English', () => {
    const fa = sanitizeChoiceLeadIn(
      'انگشتانت دور قبضهٔ سرد شمشیر قفل می‌شود و یک گام به سمت گزمهٔ دروازه برمی‌داری...',
      'جلو می‌روی و گزمه را تهدید می‌کنی',
      { isPersian: true }
    );
    assert.ok(fa && fa.includes('انگشتانت'));

    const en = sanitizeChoiceLeadIn(
      'Your boots crunch across loose gravel as you lean toward the iron gate, peering through the bars...',
      'Peer closely through the iron gate',
      { isPersian: false }
    );
    assert.ok(en && en.includes('boots crunch'));
  });

  it('drops leadIns that leak outcomes, copy choice verbatim, or resurrect dead NPCs', () => {
    assert.equal(
      sanitizeChoiceLeadIn(
        'با یک ضربه موفق می‌شوی و گزمه شکست خورد و فرار کرد.',
        'حمله به گزمه',
        { isPersian: true }
      ),
      undefined
    );

    assert.equal(
      sanitizeChoiceLeadIn(
        'جلو می‌روی و از نگهبان می‌پرسی',
        'جلو می‌روی و از نگهبان می‌پرسی',
        { isPersian: true }
      ),
      undefined
    );

    assert.equal(
      sanitizeChoiceLeadIn(
        'Radman turns around beside the campfire and narrows his eyes toward you.',
        'Approach the campfire quietly',
        {
          isPersian: false,
          ledger: {
            factionReputations: [],
            npcStatuses: [{ npcId: 'npc_radman', npcName: 'Radman', status: 'dead' }],
            keyItems: [],
            chapterSummaries: [],
            openPlotThreads: [],
          },
        }
      ),
      undefined
    );
  });

  it('strips duplicated leadIn prefix when combining continuation prose', () => {
    const lead = 'انگشتانت دور قبضهٔ سرد شمشیر قفل می‌شود و نفس را حبس می‌کنی.';
    const combined = combineLeadInAndContinuation(
      lead,
      `${lead}\n\nنگهبان نیزه‌اش را بالا می‌آورد و اخم می‌کند.`
    );
    assert.equal(combined, `${lead}\n\nنگهبان نیزه‌اش را بالا می‌آورد و اخم می‌کند.`);
    assert.equal(
      stripDuplicateLeadInPrefix(lead, `${lead} ناگهان صدای قدمی می‌آید.`),
      'ناگهان صدای قدمی می‌آید.'
    );
  });

  it('injects continuation directive into PromptAssembler when openingLeadIn is provided', () => {
    const env: WorkingContextEnvelope = {
      storyTitle: 'Test Tale',
      worldLaws: [],
      currentLocationName: 'Gate',
      currentLocationDescription: 'A stone archway.',
      activeNpcDossiers: [],
      relevantMemories: [],
      playerStatus: { stats: { might: 10 }, resources: {}, equippedItems: [] },
      recentSceneSnippets: ['Rain drums against the gatehouse.'],
      languageDirective: 'en',
      resolvedGameOutcome: {
        actionText: 'Inspect the gate lock',
        openingLeadIn: 'You crouch beside the wet iron lock and press your lantern closer.',
        outcome: 'success',
        consequence: 'You spot a hidden notch.',
      },
    };
    const { userPrompt } = PromptAssembler.buildNarrativePrompt(env);
    assert.ok(userPrompt.includes('OPENING LEAD-IN ALREADY SHOWN TO READER'));
    assert.ok(userPrompt.includes('Wet iron lock'.toLowerCase()));
  });

  it('strips leaky leadIn in ActionValidator.sanitizeChoices while keeping the choice', () => {
    const cleaned = ActionValidator.sanitizeChoices(
      [
        {
          id: 'c1',
          text: 'Inspect the cracked archway stone',
          leadIn: 'You succeed effortlessly and shatter the mystery right away.',
          style: 'inquisitive',
          riskLevel: 'low',
        },
        {
          id: 'c2',
          text: 'Listen at the bolted cellar door',
          leadIn: 'You press one ear against the damp oak planks, shutting out the wind.',
          style: 'cautious',
          riskLevel: 'low',
        },
      ],
      {
        characterName: 'Hero',
        archetypeName: 'Scout',
        currentLocationId: 'loc_1',
        stats: { cunning: 10 },
        resources: { hp: 20 },
        inventory: [],
        equipment: {},
        conditions: [],
        relationships: {},
        discoveredLocationIds: ['loc_1'],
        activeQuestIds: [],
        completedQuestIds: [],
      },
      {
        worldId: 'w1',
        worldName: 'W',
        summary: '',
        themeNotes: '',
        laws: [],
        factions: [],
        locations: [],
        timeline: [],
        npcs: [],
        tradeRoutes: [],
        bestiary: [],
      },
      undefined,
      ['A bolted cellar door sits under a cracked archway.']
    );

    assert.equal(cleaned.length, 2);
    assert.equal(cleaned[0].leadIn, undefined);
    assert.ok(cleaned[1].leadIn?.includes('damp oak planks'));
  });

  it('repairs soft outcome_mismatch in streaming mode via append-only coda without discarding streamed prose', async () => {
    const streamedChunks: string[] = [];
    let callCount = 0;

    const fakeAdapter: any = {
      generateSceneWithRaw: async (_payload: any, opts?: { onTextDelta?: (d: string) => void }) => {
        callCount += 1;
        if (callCount === 1) {
          const initialText = 'نگهبان یک قدم عقب می‌نشیند و دروازه را اندکی می‌گشاید تا عبور کنی.';
          opts?.onTextDelta?.(initialText);
          return {
            response: {
              narrative: initialText,
              choices: [
                { id: 'c1', text: 'وارد محوطه می‌شوی', style: 'tactical', riskLevel: 'low' },
                { id: 'c2', text: 'با نگهبان گفت‌وگو می‌کنی', style: 'diplomatic', riskLevel: 'low' },
              ],
              extractedMemories: [],
              isMock: false,
            },
            raw: null,
          };
        }
        return {
          response: {
            narrative: 'اما نگاه تردیدآمیز گزمه به کیسه‌ات دوخته می‌ماند و در خفا با اشارهٔ دست هم‌قطارش را خبر می‌کند که با سوءظن تعقیبت کند.',
            choices: [],
            extractedMemories: [],
            isMock: false,
          },
          raw: null,
        };
      },
    };

    const outcome = await generateValidatedScene(
      {
        story: {
          title: 'تست',
          language: 'fa',
          worldBible: {
            worldId: 'w',
            worldName: 'W',
            summary: '',
            themeNotes: '',
            laws: [],
            factions: [],
            locations: [{ id: 'loc_1', name: 'دروازه', region: 'دشت', description: 'دروازه سنگی', dangerLevel: 1, connectedLocationIds: [] }],
            timeline: [],
            npcs: [],
            tradeRoutes: [],
            bestiary: [],
          },
          rpgSystem: { stats: [{ id: 'might', name: 'نیرو', baseValue: 10 }] },
        },
        playerState: {
          characterName: 'برزین',
          archetypeName: 'جنگجو',
          currentLocationId: 'loc_1',
          stats: { might: 12 },
          resources: { hp: 20 },
          inventory: [],
          equipment: {},
          conditions: [],
          relationships: {},
          discoveredLocationIds: ['loc_1'],
          activeQuestIds: [],
          completedQuestIds: [],
        },
        resolution: {
          actionDescription: 'Persuade gate guard',
          outcome: 'mixed_success',
          diceRoll: 12,
          diceType: 'd20',
          statModifier: 2,
          environmentalModifier: 0,
          totalScore: 14,
          difficultyClass: 13,
          consequenceSummary: 'دروازه باز شد اما نگهبان مشکوک ماند.',
          stateDiff: {},
        },
        playerActionText: 'نگهبان را متقاعد می‌کنی دروازه را باز کند',
        ledger: {
          factionReputations: [],
          npcStatuses: [],
          keyItems: [],
          chapterSummaries: [],
          openPlotThreads: [],
        },
        minWordCount: 10,
        openingLeadIn: 'یک گام پیش می‌گذاری و طومار مهرشده را زیر نور مشعل بالا می‌گیری.',
        onTextDelta: (d) => streamedChunks.push(d),
      },
      fakeAdapter
    );

    assert.equal(outcome.status, 'ok');
    assert.equal(callCount, 2);
    assert.equal(outcome.proseRepaired, true);
    assert.ok(outcome.aiResponse.narrative.startsWith('یک گام پیش می‌گذاری'));
    assert.ok(outcome.aiResponse.narrative.includes('سوءظن تعقیبت کند'));
    assert.equal(streamedChunks.length, 2);
    assert.ok(streamedChunks[1].includes('سوءظن تعقیبت کند'));
  });
});
