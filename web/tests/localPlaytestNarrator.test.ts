import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  isLocalPlaytestEnabled,
  isLocalPlaytestRequest,
  parsePromptContext,
  synthesizeLocalPlaytestScene,
  createLocalPlaytestAdapter,
  createLocalPlaytestModelCall,
} from '../src/lib/providers/localPlaytestNarrator';
import { PromptAssembler } from '../src/lib/engines/narrative/PromptAssembler';
import { validateProse } from '../src/lib/engines/narrative/ProseValidator';
import { generateValidatedScene } from '../src/lib/engines/narrative/narrativeTurn';
import { SubQAdapter } from '../src/lib/providers/SubQAdapter';
import type { WorkingContextEnvelope } from '../src/lib/types/memory';

function withEnv(vars: Record<string, string | undefined>, fn: () => Promise<void> | void) {
  const prev: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) {
    prev[k] = process.env[k];
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k];
  }
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const k of Object.keys(prev)) {
        if (prev[k] === undefined) delete process.env[k];
        else process.env[k] = prev[k];
      }
    });
}

function makeEnvelope(overrides: Partial<WorkingContextEnvelope> = {}): WorkingContextEnvelope {
  return {
    storyTitle: 'طلا و لجن',
    languageDirective: 'fa',
    worldLaws: [],
    currentLocationName: 'چاه سنگ',
    currentLocationDescription: 'منزلگاه کوهستانی کاروان نمک در حاشیه بادیه هیرام.',
    activeNpcDossiers: [
      {
        name: 'کاروان‌سالار رادمان',
        trust: 1,
        knownSecrets: [],
        speechStyle: 'قاطع و باتجربه',
        presenceStatus: 'present',
      },
      {
        name: 'کدخدای پنهان',
        trust: 0,
        knownSecrets: [],
        speechStyle: 'آرام',
        presenceStatus: 'nearby_resident',
      },
    ],
    relevantMemories: [],
    playerStatus: {
      characterName: 'برزین',
      archetypeName: 'تیغ‌زن هیرام',
      stats: { might: 4, agility: 3, cunning: 2, charisma: 2 },
      resources: { hp: 20, stamina: 10 },
      conditions: [],
      equippedItems: ['شمشیر کوتاه'],
    },
    statsConfig: [
      { id: 'might', name: 'نیرو', baseValue: 2 },
      { id: 'agility', name: 'چابکی', baseValue: 2 },
      { id: 'cunning', name: 'زیرکی', baseValue: 2 },
      { id: 'charisma', name: 'کاریزما', baseValue: 2 },
    ],
    universalBaseValue: 2,
    recentSceneSnippets: ['کاروان در آستانه حرکت آماده می‌شود.'],
    resolvedGameOutcome: {
      actionText: 'بازرسی گردنه پیش‌رو',
      outcome: 'success',
      consequence: 'مسیر امن‌تر شناسایی شد.',
    },
    activeEncounter: {
      id: 'enc_sand_viper',
      title: 'کمین افعی‌های ریگ‌سرخ',
      narrativeText: 'افعی‌های شن‌زی میان تخته‌سنگ‌ها خزیده‌اند و راه کاروان را می‌بندند.',
      creatureName: 'افعی ریگ‌سرخ',
      recommendedStat: 'agility',
      recommendedDC: 10,
    },
    ...overrides,
  };
}

describe('localPlaytestNarrator', () => {
  it('strictly refuses to activate when NODE_ENV=production', async () => {
    await withEnv({ NODE_ENV: 'production', STORYFORGE_LOCAL_PLAYTEST: 'true' }, () => {
      assert.equal(isLocalPlaytestEnabled(true), false);
      assert.equal(
        isLocalPlaytestRequest(
          { headers: { get: () => 'true' } },
          { localPlaytest: true }
        ),
        false
      );
    });
  });

  it('activates cleanly in non-production via env or request flag', async () => {
    await withEnv({ NODE_ENV: 'development', STORYFORGE_LOCAL_PLAYTEST: undefined }, () => {
      assert.equal(isLocalPlaytestEnabled(false), false);
      assert.equal(isLocalPlaytestEnabled(true), true);
      assert.equal(
        isLocalPlaytestRequest(
          { headers: { get: (k) => (k === 'x-storyforge-local-playtest' ? 'true' : null) } },
          {}
        ),
        true
      );
    });
  });

  it('synthesizes Persian & English prose passing validateProse (>=70 words) across outcomes without leaking nearby residents', async () => {
    const outcomes = ['success', 'mixed_success', 'failure', 'critical_failure'] as const;

    for (const lang of ['fa', 'en'] as const) {
      for (const outcome of outcomes) {
        const envelope = makeEnvelope({
          languageDirective: lang,
          storyTitle: lang === 'en' ? 'Ashes of Zarvan' : 'طلا و لجن',
          currentLocationName: lang === 'en' ? 'Stone Well' : 'چاه سنگ',
          resolvedGameOutcome: {
            actionText: lang === 'en' ? 'scout the narrow ridge' : 'بازرسی گردنه باریک',
            outcome,
            consequence: lang === 'en' ? 'the situation shifts decisively' : 'موقعیت به‌شکل محسوسی تغییر کرد',
            costLine: outcome === 'mixed_success'
              ? (lang === 'en' ? 'bruised shoulder and exhaustion' : 'خراش بازو و خستگی نفس‌گیر')
              : undefined,
            failureMode: outcome === 'failure' || outcome === 'critical_failure' ? 'complication' : undefined,
            failureDirective: outcome === 'failure' || outcome === 'critical_failure'
              ? (lang === 'en' ? 'dust blinds the flank and footing slips' : 'گردوخاک دید را بست و تکیه‌گاه سست شد')
              : undefined,
          },
        });

        const payload = PromptAssembler.buildNarrativePrompt(envelope);
        const scene = synthesizeLocalPlaytestScene(payload, 1);

        const wordCount = (scene.narrative || '').trim().split(/\s+/).filter(Boolean).length;
        assert.ok(wordCount >= 70, `${lang}/${outcome} expected >= 70 words, got ${wordCount}`);
        assert.ok((scene.choices || []).length >= 3);

        // Ensure nearby_resident NPC never appears in choices
        for (const c of scene.choices || []) {
          assert.ok(!c.text.includes('کدخدای پنهان'), 'nearby_resident leaked into choice text');
        }

        const validation = validateProse(scene.narrative || '', {
          language: lang,
          minWordCount: 70,
          resolution: {
            outcome,
            consequenceSummary: '',
          } as any,
        });
        assert.equal(
          validation.findings.filter((f) => f.severity === 'error').length,
          0,
          `${lang}/${outcome} failed validateProse: ${JSON.stringify(validation.findings)}`
        );
      }
    }
  });

  it('parses encounter, travel, and nearby vs present NPC boundaries accurately', () => {
    const payload = PromptAssembler.buildNarrativePrompt(
      makeEnvelope({
        travel: {
          mode: 'caravan',
          originName: 'چاه سنگ',
          destinationName: 'زرین‌پل',
          currentStopName: 'رباط سرخ',
          nextStopName: 'بادپناه',
          routeName: 'شاهراه نمک',
          caravanNpcNames: ['کاروان‌سالار رادمان'],
          turnsRemaining: 2,
          totalTurns: 4,
          dayOnRoad: 2,
          calendarDays: 4,
          arriving: false,
          isElliptical: false,
        },
      })
    );
    const parsed = parsePromptContext(payload);
    assert.equal(parsed.isEnglish, false);
    assert.equal(parsed.encounter?.title, 'کمین افعی‌های ریگ‌سرخ');
    assert.equal(parsed.encounter?.recommendedStat, 'agility');
    assert.equal(parsed.encounter?.recommendedDC, 10);
    assert.equal(parsed.travel?.currentStopName, 'رباط سرخ');
    assert.equal(parsed.travel?.nextStopName, 'بادپناه');
    assert.ok(parsed.nearbyResidentNames.includes('کدخدای پنهان'));
  });

  it('reads custom script scenes from file/array and streams deltas cleanly through generateValidatedScene', async () => {
    const tmpFile = path.join(os.tmpdir(), `sf-local-script-${Date.now()}.json`);
    const customNarrative = Array.from({ length: 12 })
      .map(() => 'باد کویری بر فراز برج‌های کهنه زوزه می‌کشد و نور مشعل‌ها بر سنگ‌های ترک‌خورده می‌لرزد.')
      .join(' ');
    fs.writeFileSync(
      tmpFile,
      JSON.stringify({
        scenes: [
          {
            narrative: customNarrative,
            choices: [
              { id: 'c1', text: 'با احتیاط به سمت برج دیده‌بانی حرکت کن', style: 'stealthy', riskLevel: 'low', requiredStatId: 'agility', targetDC: 9 },
              { id: 'c2', text: 'با کاروان‌سالار رادمان درباره نشانه گفت‌وگو کن', style: 'diplomatic', riskLevel: 'low' },
            ],
            extractedMemories: [{ category: 'story', importance: 6, summary: 'نشانه برج بررسی شد.' }],
          },
        ],
      }),
      'utf8'
    );

    try {
      const adapter = await createLocalPlaytestAdapter({ scriptPath: tmpFile });
      const streamedDeltas: string[] = [];
      const storyStub: any = {
        id: 'story_test',
        title: 'طلا و لجن',
        language: 'fa',
        rpgSystem: {
          stats: [
            { id: 'might', name: 'نیرو', baseValue: 2 },
            { id: 'agility', name: 'چابکی', baseValue: 2 },
          ],
          resources: [{ id: 'hp', name: 'جان', defaultMax: 20 }],
        },
        worldBible: {
          laws: [],
          locations: [{ id: 'loc_1', name: 'چاه سنگ', description: 'منزلگاه' }],
          npcs: [{ id: 'npc_radman', name: 'کاروان‌سالار رادمان', currentLocationId: 'loc_1', description: '', goals: ['همراهی کاروان'] }],
          bestiary: [],
          artifacts: [],
          factions: [],
          religions: [],
        },
      };

      const originalFetch = globalThis.fetch;
      let fetchCalls = 0;
      globalThis.fetch = (async () => {
        fetchCalls += 1;
        throw new Error('Must not make network calls');
      }) as typeof fetch;

      try {
        const result = await generateValidatedScene(
          {
            story: storyStub,
            playerState: {
              characterName: 'برزین',
              stats: { might: 3, agility: 3 },
              resources: { hp: 20 },
              inventory: [],
              equipment: {},
              currentLocationId: 'loc_1',
              discoveredLocationIds: ['loc_1'],
              relationships: {},
              activeQuestIds: [],
              completedQuestIds: [],
            },
            resolution: {
              actionText: 'نگاه به برج',
              outcome: 'success',
              consequenceSummary: 'برج بررسی شد',
              stateDiff: {},
            } as any,
            playerActionText: 'نگاه به برج',
            ledger: { npcStatuses: [], factionReputations: [], keyItems: [], openPlotThreads: [] } as any,
            minWordCount: 70,
            forceHeuristicMomentum: true,
            onTextDelta: (delta) => streamedDeltas.push(delta),
          },
          adapter,
          undefined,
          new SubQAdapter('')
        );

        assert.equal(fetchCalls, 0);
        assert.equal(result.status, 'ok');
        assert.ok(result.aiResponse.narrative.includes('باد کویری'));
        assert.ok(streamedDeltas.length > 0);
      } finally {
        globalThis.fetch = originalFetch;
      }

      // Second call beyond script exhaustion falls back to contextual synthesizer seamlessly
      const modelCall = createLocalPlaytestModelCall({ scriptPath: tmpFile });
      const p = PromptAssembler.buildNarrativePrompt(makeEnvelope());
      const first = await modelCall(p);
      const second = await modelCall(p);
      assert.equal(first?.modelUsed, 'antigravity-local');
      assert.equal(second?.modelUsed, 'antigravity-local');
      assert.ok(String(second?.data.narrative || '').includes('بازرسی گردنه پیش‌رو'));
    } finally {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    }
  });
});
