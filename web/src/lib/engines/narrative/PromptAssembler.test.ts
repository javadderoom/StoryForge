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

  it('renders active trade routes and caravan presence directives (EN + FA)', () => {
    const dossiers = [
      {
        name: 'Master Tariq',
        trust: 10,
        knownSecrets: [],
        speechStyle: 'Cautious merchant',
        presenceStatus: 'nearby_resident' as const,
        caravanAffiliation: 'Caravan Master of "The Silk Road"',
      },
      {
        name: 'Zara',
        trust: 5,
        knownSecrets: [],
        speechStyle: 'Alert escort',
        presenceStatus: 'present' as const,
        caravanAffiliation: 'Traveling with Caravan "The Silk Road"',
      },
    ];

    const en = PromptAssembler.buildNarrativePrompt(
      makeEnvelope({
        tradeRoutes: ['"The Silk Road" (Danger 2, ACTIVE, led by Caravan Master Tariq): Susa -> Rayy | Transports: Silk, Iron.'],
        activeNpcDossiers: dossiers,
      })
    );
    assert.ok(en.userPrompt.includes('COMMERCIAL ARTERIES & ACTIVE TRADE ROUTES'));
    assert.ok(en.userPrompt.includes('"The Silk Road"'));
    assert.ok(en.userPrompt.includes('Master Tariq [WITH ACTIVE CARAVAN: Caravan Master of "The Silk Road"] [STATIONED AT LOCATION'));
    assert.ok(en.userPrompt.includes('Zara [WITH ACTIVE CARAVAN: Traveling with Caravan "The Silk Road"] [PRESENT IN SCENE]'));
    assert.ok(en.userPrompt.includes('CARAVAN & TRAVELING ENTITY PRESENCE'));

    const fa = PromptAssembler.buildNarrativePrompt(
      makeEnvelope({
        languageDirective: 'fa',
        tradeRoutes: ['«شاهراه ابریشم» (خطر ۲، فعال، به رهبری کاروان‌سالار طارق): شوش -> ری | حامل: ابریشم، آهن.'],
        activeNpcDossiers: [
          {
            name: 'طارق',
            trust: 10,
            knownSecrets: [],
            speechStyle: 'محتاط',
            presenceStatus: 'nearby_resident' as const,
            caravanAffiliation: 'کاروان‌سالار کاروان «شاهراه ابریشم»',
          },
        ],
      })
    );
    assert.ok(fa.userPrompt.includes('شاهراه‌ها و کاروان‌های تجاری فعال'));
    assert.ok(fa.userPrompt.includes('طارق [همراه کاروان تجاری: کاروان‌سالار کاروان «شاهراه ابریشم»] [مستقر در این پایگاه/مکان'));
    assert.ok(fa.userPrompt.includes('دستور حضور کاروان‌ها و شخصیت‌های مسافر'));
  });

  it('renders NPC appearance and literary portrait directives (EN + FA)', () => {
    const dossiers = [
      {
        name: 'Borzou',
        trust: 5,
        knownSecrets: [],
        speechStyle: 'Booming voice',
        presenceStatus: 'present' as const,
        appearance: 'قامت: بلند و چهارشانه • سیما: آفتاب‌سوخته • پوشش: ردای پشمین',
      },
    ];

    const en = PromptAssembler.buildNarrativePrompt(
      makeEnvelope({ activeNpcDossiers: dossiers, languageDirective: 'en' })
    );
    assert.ok(en.userPrompt.includes('Appearance & Attire: قامت: بلند و چهارشانه'));
    assert.ok(en.userPrompt.includes('LITERARY CHARACTER PORTRAIT DIRECTIVE'));

    const fa = PromptAssembler.buildNarrativePrompt(
      makeEnvelope({ activeNpcDossiers: dossiers, languageDirective: 'fa', storyTitle: 'داستان افسانه' })
    );
    assert.ok(fa.userPrompt.includes('سیما، اندام و پوشش: قامت: بلند و چهارشانه'));
    assert.ok(fa.userPrompt.includes('دستور شاهکار ادبی برای توصیف سیمای شخصیت‌ها'));
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

describe('PromptAssembler - mixed_success cost directive', () => {
  it('renders cost line and partial-victory directive (EN)', () => {
    const { userPrompt } = PromptAssembler.buildNarrativePrompt(makeEnvelope({
      resolvedGameOutcome: {
        actionText: 'Force the gate',
        outcome: 'mixed_success',
        consequence: 'The gate gives way.',
        costLine: 'Certain cost this turn: health -5, stamina -10.',
      },
    }));
    assert.ok(userPrompt.includes('MIXED_SUCCESS'));
    assert.ok(userPrompt.includes('Certain cost this turn: health -5, stamina -10.'));
    assert.ok(userPrompt.includes('MIXED SUCCESS'));
    assert.ok(userPrompt.includes('FORBIDDEN'));
    assert.ok(userPrompt.includes('CAUSAL COST RULE'));
    assert.ok(userPrompt.includes('NEVER invent a new attacker'));
    assert.ok(userPrompt.includes('never a wound from nowhere'));
  });

  it('renders cost line and directive in Persian (FA)', () => {
    const { userPrompt } = PromptAssembler.buildNarrativePrompt(makeEnvelope({
      languageDirective: 'fa',
      resolvedGameOutcome: {
        actionText: 'گشودن دروازه',
        outcome: 'mixed_success',
        consequence: 'دروازه گشوده می‌شود.',
        costLine: 'هزینه قطعی این نوبت: health -5.',
      },
    }));
    assert.ok(userPrompt.includes('MIXED_SUCCESS'));
    assert.ok(userPrompt.includes('هزینه قطعی این نوبت'));
    assert.ok(userPrompt.includes('موفقیت نسبی'));
    assert.ok(userPrompt.includes('قاعده علت‌ومعلول هزینه'));
    assert.ok(userPrompt.includes('هرگز برای توجیه هزینه، مهاجم تازه'));
  });

  it('omits the mixed directive for clean success', () => {
    const { userPrompt } = PromptAssembler.buildNarrativePrompt(makeEnvelope({
      resolvedGameOutcome: {
        actionText: 'Push through the sentries',
        outcome: 'success',
        consequence: 'A narrow opening appears.',
      },
    }));
    assert.ok(!userPrompt.includes('MIXED SUCCESS'));
  });
});

describe('PromptAssembler - forward momentum and completed actions guardrail', () => {
  it('renders recent completed actions and anti-recycling directives (EN)', () => {
    const env = makeEnvelope({
      recentCompletedActions: [
        'Shouted at the camel drivers to clear the path',
        'Led the caravan across the narrow bridge',
      ],
    });
    const { systemPrompt, userPrompt } = PromptAssembler.buildNarrativePrompt(env);
    assert.ok(userPrompt.includes('[RECENTLY COMPLETED ACTIONS — FORWARD MOMENTUM & NO RECYCLING]'));
    assert.ok(userPrompt.includes('Shouted at the camel drivers to clear the path'));
    assert.ok(userPrompt.includes('Led the caravan across the narrow bridge'));
    assert.ok(userPrompt.includes('STRICT ANTI-REPETITION DIRECTIVE'));
    assert.ok(systemPrompt.includes('FORWARD MOMENTUM ON OVERCOME OBSTACLES'));
    assert.ok(systemPrompt.includes('BAN REPETITIVE TROPES & STOCK GESTURES'));
    assert.ok(systemPrompt.includes('NATURAL LITERARY ITEM & GEAR REFERENCES'));
    assert.ok(systemPrompt.includes('REALISTIC SENTRY & GARRISON DISCIPLINE'));
  });

  it('renders recent completed actions and anti-recycling directives in Persian (FA)', () => {
    const env = makeEnvelope({
      languageDirective: 'fa',
      recentCompletedActions: [
        'فریاد کشیدن بر سر ساربانان و هدایت شترها با اتکا به مهارت کاروان برای عبور از معبر خالی‌شده',
      ],
    });
    const { systemPrompt, userPrompt } = PromptAssembler.buildNarrativePrompt(env);
    assert.ok(userPrompt.includes('[اقدامات اخیراً انجام‌شده و حل‌شده — لزوم پیشروی داستان و ممنوعیت تکرار / COMPLETED ACTIONS]'));
    assert.ok(userPrompt.includes('فریاد کشیدن بر سر ساربانان'));
    assert.ok(userPrompt.includes('دستور اکید جلوگیری از درجا زدن و تکرار'));
    assert.ok(systemPrompt.includes('پیشروی اجباری پس از عبور از موانع (Forward Momentum on Overcome Obstacles)'));
    assert.ok(systemPrompt.includes('ممنوعیت تکرار حرکات و کلیشه‌های رفتاری (Ban Repetitive Tropes & Stock Gestures)'));
    assert.ok(systemPrompt.includes('زبان طبیعی در اشاره به زره و سازوبرگ (Natural Literary Item References)'));
    assert.ok(systemPrompt.includes('انضباط واقع‌گرایانهٔ سربازان و گزمه‌ها (Realistic Garrison Discipline)'));
  });
});

describe('PromptAssembler - Plan 15 wound beat', () => {
  for (const languageDirective of ['en', 'fa'] as const) {
    it(`injects the emotional beat for an untreated wound (${languageDirective})`, () => {
      const env = makeEnvelope({
        languageDirective,
        playerStatus: { stats: {}, resources: {}, equippedItems: [], conditions: ['wound:arrow'] },
      });
      const { systemPrompt } = PromptAssembler.buildNarrativePrompt(env);
      assert.ok(systemPrompt.includes('CRITICAL EMOTIONAL BEAT'));
      assert.ok(systemPrompt.includes('wound:arrow'));
    });

    it(`stays silent without wound tags (${languageDirective})`, () => {
      const env = makeEnvelope({
        languageDirective,
        playerStatus: { stats: {}, resources: {}, equippedItems: [], conditions: ['هوشیار'] },
      });
      const { systemPrompt } = PromptAssembler.buildNarrativePrompt(env);
      assert.ok(!systemPrompt.includes('CRITICAL EMOTIONAL BEAT'));
    });

    it(`treated wounds suppress the beat (${languageDirective})`, () => {
      const env = makeEnvelope({
        languageDirective,
        playerStatus: { stats: {}, resources: {}, equippedItems: [], conditions: ['wound:arrow (bandaged)'] },
      });
      const { systemPrompt } = PromptAssembler.buildNarrativePrompt(env);
      assert.ok(!systemPrompt.includes('CRITICAL EMOTIONAL BEAT'));
    });
  }
});

describe('PromptAssembler - Plan 15 Bug 1 environmental guidance & bestiary grounding', () => {
  it('injects [ENVIRONMENTAL GUIDANCE] in context block and continuity directive when bestiary is empty (EN)', () => {
    const env = makeEnvelope({
      languageDirective: 'en',
      bestiary: [],
    });
    const { userPrompt, systemPrompt } = PromptAssembler.buildNarrativePrompt(env);

    assert.ok(
      userPrompt.includes('[ENVIRONMENTAL GUIDANCE]: No predatory beasts inhabit this immediate terrain'),
      'User prompt must include environmental guidance when bestiary is empty'
    );
    assert.ok(
      systemPrompt.includes('[ENVIRONMENTAL GUIDANCE]: No predatory beasts inhabit this immediate terrain'),
      'System prompt must include environmental guidance directive when bestiary is empty'
    );
    assert.ok(
      !userPrompt.includes('MUST draw from these canonical creatures'),
      'Must NOT command drawing from canonical creatures when none match'
    );
    assert.ok(
      !systemPrompt.includes('BESTIARY GROUNDING & VISCERAL TRAITS: When introducing wild beasts, predators, or monstrosities, you MUST draw'),
      'Must NOT include MUST-draw continuity directive when bestiary is empty'
    );
  });

  it('injects [راهنمای محیطی / ENVIRONMENTAL GUIDANCE] in Persian when bestiary is empty (FA)', () => {
    const env = makeEnvelope({
      languageDirective: 'fa',
      storyTitle: 'افسانه کویر',
      bestiary: [],
    });
    const { userPrompt, systemPrompt } = PromptAssembler.buildNarrativePrompt(env);

    assert.ok(
      userPrompt.includes('[راهنمای محیطی / ENVIRONMENTAL GUIDANCE]: در این پهنه هیچ درنده‌ای زندگی نمی‌کند'),
      'Persian user prompt must include Persian environmental guidance when bestiary is empty'
    );
    assert.ok(
      systemPrompt.includes('[راهنمای محیطی / ENVIRONMENTAL GUIDANCE]: در این پهنه هیچ درنده‌ای زندگی نمی‌کند'),
      'Persian system prompt must include Persian environmental guidance directive when bestiary is empty'
    );
    assert.ok(
      !userPrompt.includes('حتماً از این موجودات مانیفست'),
      'Must NOT command drawing from canonical creatures in Persian when none match'
    );
  });

  it('injects canonical MUST-draw directive when bestiary contains matching creatures (EN + FA)', () => {
    const enEnv = makeEnvelope({
      languageDirective: 'en',
      bestiary: ['Ash Hound (danger 3, monstrosity) — Description: Dark predator...'],
    });
    const en = PromptAssembler.buildNarrativePrompt(enEnv);
    assert.ok(en.userPrompt.includes('MUST draw from these canonical creatures'));
    assert.ok(en.systemPrompt.includes('BESTIARY GROUNDING & VISCERAL TRAITS'));

    const faEnv = makeEnvelope({
      languageDirective: 'fa',
      storyTitle: 'افسانه کویر',
      bestiary: ['سگ خاکستر (سطح خطر ۳) — توصیف: درندهٔ سیاه...'],
    });
    const fa = PromptAssembler.buildNarrativePrompt(faEnv);
    assert.ok(fa.userPrompt.includes('حتماً از این موجودات مانیفست'));
    assert.ok(fa.systemPrompt.includes('بازنمایی حسی و دقیق موجودات (BESTIARY GROUNDING & VISCERAL TRAITS)'));
  });
});

// ---------------------------------------------------------------------------
// Plan 17 (§4.5): journey prompt snapshots — departure / mid-journey / final
// leg / arrival, with hard arrival discipline.
// ---------------------------------------------------------------------------

describe('PromptAssembler - Plan 17 journey blocks', () => {
  const baseTravel = {
    originName: 'Ashen Gate',
    destinationName: 'Salt Mine',
    routeName: 'Salt Road',
    currentStopName: 'Ashen Gate',
    nextStopName: 'Brine Harbor',
    turnsRemaining: 4,
    totalTurns: 5,
    dayOnRoad: 1,
    mode: 'caravan' as const,
    caravanNpcNames: ['Farid the Caravan Master'],
    roadNote: 'Danger 3 • status ACTIVE • raided by Ashfang Raiders',
  };

  it('renders the departure block with discipline + choice material (EN)', () => {
    const { userPrompt } = PromptAssembler.buildNarrativePrompt(
      makeEnvelope({ languageDirective: 'en', travel: baseTravel })
    );
    assert.ok(userPrompt.includes('[JOURNEY EN ROUTE'));
    assert.ok(userPrompt.includes('DEPARTURE: the journey begins this turn'));
    assert.ok(userPrompt.includes('from "Ashen Gate" to "Salt Mine"'));
    assert.ok(userPrompt.includes('via the "Salt Road"'));
    assert.ok(userPrompt.includes('ARRIVAL DISCIPLINE'));
    assert.ok(userPrompt.includes('inside "Salt Mine"'));
    assert.ok(userPrompt.includes('Farid the Caravan Master'));
    assert.ok(userPrompt.includes('Ashfang Raiders'));
    assert.ok(userPrompt.includes('CHOICE MATERIAL for the road'));
    assert.ok(!userPrompt.includes('[JOURNEY ARRIVED'));
  });

  it('renders the mid-journey block (FA) without the departure or final-leg lines', () => {
    const { userPrompt } = PromptAssembler.buildNarrativePrompt(
      makeEnvelope({
        languageDirective: 'fa',
        storyTitle: 'افسانه نمک',
        travel: {
          ...baseTravel,
          currentStopName: 'Brine Harbor',
          nextStopName: 'Way Station',
          turnsRemaining: 2,
          dayOnRoad: 3,
        },
      })
    );
    assert.ok(userPrompt.includes('سفر در راه'));
    assert.ok(userPrompt.includes('قهرمان در راه است: از «Ashen Gate» به «Salt Mine»'));
    assert.ok(!userPrompt.includes('نوبت دیگر راه مانده'));
    assert.ok(userPrompt.includes('ایستگاه بعدی: «Way Station»'));
    assert.ok(userPrompt.includes('انضباط ورود'));
    assert.ok(userPrompt.includes('همسفران راه: Farid the Caravan Master'));
    assert.ok(!userPrompt.includes('آغاز سفر'));
    assert.ok(!userPrompt.includes('• پایان راه:'));
  });

  it('renders the final-leg block with permission to end inside the gates (EN)', () => {
    const { userPrompt } = PromptAssembler.buildNarrativePrompt(
      makeEnvelope({
        languageDirective: 'en',
        travel: {
          ...baseTravel,
          currentStopName: 'Way Station',
          turnsRemaining: 1,
          dayOnRoad: 5,
          arriving: true,
        },
      })
    );
    assert.ok(userPrompt.includes('FINAL LEG'));
    assert.ok(userPrompt.includes('the destination appears on the horizon'));
    assert.ok(userPrompt.includes('end the scene inside them'));
    assert.ok(!userPrompt.includes('ARRIVAL DISCIPLINE'));
  });

  it('renders the arrival block when the journey entered the destination this turn', () => {
    const { userPrompt } = PromptAssembler.buildNarrativePrompt(
      makeEnvelope({
        languageDirective: 'en',
        travelArrival: { destinationName: 'Salt Mine' },
      })
    );
    assert.ok(userPrompt.includes('[JOURNEY ARRIVED'));
    assert.ok(userPrompt.includes('has entered "Salt Mine"'));
    assert.ok(userPrompt.includes('new grounded setting'));
    assert.ok(!userPrompt.includes('[JOURNEY EN ROUTE'));
  });

  it('renders the arrival block in Persian when the story is Persian', () => {
    const { userPrompt } = PromptAssembler.buildNarrativePrompt(
      makeEnvelope({
        languageDirective: 'fa',
        storyTitle: 'افسانه نمک',
        travelArrival: { destinationName: 'معدن نمک' },
      })
    );
    assert.ok(userPrompt.includes('رسیدن به مقصد'));
    assert.ok(userPrompt.includes('قهرمان به «معدن نمک» درآمده است'));
  });

  it('renders the cinematic ellipsis block with time-passage montage and arrival threshold (EN)', () => {
    const { userPrompt } = PromptAssembler.buildNarrativePrompt(
      makeEnvelope({
        languageDirective: 'en',
        travel: {
          ...baseTravel,
          isElliptical: true,
          distanceKm: 360,
          calendarDays: 14,
        },
      })
    );
    assert.ok(userPrompt.includes('[JOURNEY ELLIPSIS — TIME & DISTANCE MONTAGE]'));
    assert.ok(userPrompt.includes('360 km'));
    assert.ok(userPrompt.includes('14 days'));
    assert.ok(userPrompt.includes('COMPRESS PASSAGE OF TIME'));
    assert.ok(userPrompt.includes('NO TRIVIAL STALLS'));
    assert.ok(userPrompt.includes('ARRIVAL AT OUTSKIRTS / GATES'));
    assert.ok(!userPrompt.includes('[JOURNEY EN ROUTE'));
  });

  it('renders the cinematic ellipsis block in Persian with distance and duration (FA)', () => {
    const { userPrompt } = PromptAssembler.buildNarrativePrompt(
      makeEnvelope({
        languageDirective: 'fa',
        travel: {
          ...baseTravel,
          isElliptical: true,
          distanceKm: 500,
          calendarDays: 30,
        },
      })
    );
    assert.ok(userPrompt.includes('[گذر زمان و خلاصهٔ سفر / JOURNEY ELLIPSIS]'));
    assert.ok(userPrompt.includes('500 کیلومتر'));
    assert.ok(userPrompt.includes('30 روز'));
    assert.ok(userPrompt.includes('فشردن زمان و مسافت'));
    assert.ok(userPrompt.includes('منع درنگ‌های پیش‌پاافتاده'));
    assert.ok(userPrompt.includes('فرود در آستانهٔ مقصد'));
    assert.ok(!userPrompt.includes('[سفر در راه / JOURNEY EN ROUTE]'));
  });

  it('renders the arrival block with duration and distance in EN and FA', () => {
    const en = PromptAssembler.buildNarrativePrompt(
      makeEnvelope({
        languageDirective: 'en',
        travelArrival: { destinationName: 'Salt Mine', calendarDays: 14, distanceKm: 360 },
      })
    );
    assert.ok(en.userPrompt.includes('after 14 days (360 km) on the road'));

    const fa = PromptAssembler.buildNarrativePrompt(
      makeEnvelope({
        languageDirective: 'fa',
        travelArrival: { destinationName: 'معدن نمک', calendarDays: 30, distanceKm: 500 },
      })
    );
    assert.ok(fa.userPrompt.includes('پس از 30 روز (500 کیلومتر) راه'));
  });

  it('omits every journey block for grounded turns', () => {
    const { userPrompt } = PromptAssembler.buildNarrativePrompt(makeEnvelope({}));
    assert.ok(!userPrompt.includes('[JOURNEY EN ROUTE'));
    assert.ok(!userPrompt.includes('[JOURNEY ARRIVED'));
  });
});

describe('PromptAssembler - Plan 18 Fail Forward contract', () => {
  it('renders the binding failure block and system contract (EN)', () => {
    const { systemPrompt, userPrompt } = PromptAssembler.buildNarrativePrompt(
      makeEnvelope({
        resolvedGameOutcome: {
          actionText: 'Search the archive for the missing ledger',
          outcome: 'failure',
          consequence: 'The attempt fails, but reveals a fresh clue.',
          failureMode: 'reveal',
          failureSecondaryMode: 'complication',
          failureDirective:
            'The intent FAILS, but the attempt exposes a new fact. At least two of the offered choices must pursue a genuinely different approach.',
          stuckAllowed: false,
        },
      })
    );
    assert.ok(systemPrompt.includes('[FAILURE FORWARD CONTRACT — MANDATORY]'));
    assert.ok(systemPrompt.includes('Failure denies the INTENT, never the story.'));
    assert.ok(userPrompt.includes('[FAILURE FORWARD — PRE-RESOLVED MODE]'));
    assert.ok(userPrompt.includes('REVEAL + COMPLICATION (secondary)'));
    assert.ok(userPrompt.includes('Binding directive: The intent FAILS'));
    assert.ok(userPrompt.includes('Stuck permitted: NO'));
    assert.ok(userPrompt.includes('at least two choices must pursue a new approach'));
  });

  it('renders the Persian failure block and contract (FA)', () => {
    const { systemPrompt, userPrompt } = PromptAssembler.buildNarrativePrompt(
      makeEnvelope({
        languageDirective: 'fa',
        storyTitle: 'افسانه نمک',
        resolvedGameOutcome: {
          actionText: 'جستجوی بایگانی برای دفترچهٔ گم‌شده',
          outcome: 'critical_failure',
          consequence: 'تلاش شکست خورد و خطر پیش رفت.',
          failureMode: 'escalation',
          failureSecondaryMode: 'cost',
          failureDirective:
            'قصد بازیکن شکست می‌خورد و خطر پیش می‌رود. دست‌کم دو گزینه باید رویکردی واقعاً متفاوت را دنبال کنند.',
          stuckAllowed: false,
        },
      })
    );
    assert.ok(systemPrompt.includes('[قرارداد شکستِ پیش‌برنده — اجباری]'));
    assert.ok(systemPrompt.includes('شکست، «قصد» را رد می‌کند، نه داستان را.'));
    assert.ok(userPrompt.includes('[شکستِ پیش‌برنده — حالت محاسباتی]'));
    assert.ok(userPrompt.includes('ESCALATION + COST (ثانویه)'));
    assert.ok(userPrompt.includes('توقف کامل مجاز است: نه'));
    assert.ok(userPrompt.includes('دست‌کم دو گزینه'));
  });

  it('renders an authorized hard stop with its reason, requirement, and engine movement', () => {
    const { userPrompt } = PromptAssembler.buildNarrativePrompt(
      makeEnvelope({
        resolvedGameOutcome: {
          actionText: 'Force the sealed gate',
          outcome: 'failure',
          consequence: 'The gate will not yield to brute force.',
          failureMode: 'hard_stop',
          failureDirective: 'This method cannot work here. Reveal the requirement and at least two alternatives.',
          stuckAllowed: true,
          stuckReason: 'Repeating the same approach has exhausted its possibilities.',
          failureRequirementHint: 'The bronze seal is required.',
          locationChanged: true,
        },
      })
    );
    assert.ok(userPrompt.includes('Stuck permitted: YES'));
    assert.ok(userPrompt.includes('Repeating the same approach has exhausted its possibilities.'));
    assert.ok(userPrompt.includes('Requirement to reveal: The bronze seal is required.'));
    assert.ok(userPrompt.includes('ENGINE MOVEMENT'));
    assert.ok(userPrompt.includes('Do NOT narrate them still stuck at the old threshold.'));
  });

  it('omits the failure block for clean success', () => {
    const { userPrompt } = PromptAssembler.buildNarrativePrompt(
      makeEnvelope({
        resolvedGameOutcome: {
          actionText: 'Open the gate',
          outcome: 'success',
          consequence: 'The gate opens.',
        },
      })
    );
    assert.ok(!userPrompt.includes('[FAILURE FORWARD — PRE-RESOLVED MODE]'));
  });
});


