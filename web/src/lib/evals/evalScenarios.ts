import { WorkingContextEnvelope } from '@/lib/types/memory';
import { EvalScenario } from './types';

/**
 * Plan 14 — Tier 2: the canonical "Golden Scenario" matrix.
 *
 * Each scenario is a realistic prompt context plus the invariants the model
 * output must satisfy. Cassettes are keyed by scenario id (see
 * `web/src/lib/evals/cassettes/`), so these run deterministically in CI.
 */

const STANDARD_STATS = { might: 12, agility: 12, cunning: 12, charisma: 12 };
const STANDARD_STAT_IDS = ['might', 'agility', 'cunning', 'charisma'];

function env(
  overrides: Partial<WorkingContextEnvelope> & { storyTitle: string; languageDirective: 'en' | 'fa' }
): WorkingContextEnvelope {
  return {
    worldLaws: [],
    currentLocationName: 'Scene',
    currentLocationDescription: 'A charged place.',
    activeNpcDossiers: [],
    relevantMemories: [],
    playerStatus: { stats: STANDARD_STATS, resources: { health: 30 }, equippedItems: [] },
    recentSceneSnippets: [],
    universalBaseValue: 10,
    ...overrides,
  };
}

export const EVAL_SCENARIOS: EvalScenario[] = [
  {
    id: 'eval_standoff_sentry',
    title: 'Armed sentry standoff at the bridge',
    invariant: 'Zero diceless choices; every choice has a stat and a calibrated DC >= 12.',
    language: 'en',
    envelope: env({
      storyTitle: 'The Ashen Bridge',
      languageDirective: 'en',
      currentLocationName: 'Ashen Bridge',
      currentLocationDescription: 'A narrow stone bridge held by armed sentries with drawn spears.',
      activeNpcDossiers: [
        { name: 'Sentry Captain', trust: -10, knownSecrets: [], speechStyle: 'Barked, clipped commands.' },
      ],
      recentSceneSnippets: ['Armed sentries lower their spears, blocking the span; the captain demands you halt.'],
      resolvedGameOutcome: {
        actionText: 'Approach the checkpoint',
        outcome: 'mixed_success',
        consequence: 'You are halted at spear-point; the captain steps forward, demanding your name.',
      },
    }),
    expectations: {
      requireNoDiceless: true,
      minDc: 12,
      maxDc: 19,
      allowedStatIds: STANDARD_STAT_IDS,
      minWords: 40,
      maxWords: 450,
    },
  },
  {
    id: 'eval_crit_failure_pickpocket',
    title: 'Pickpocket critical failure',
    invariant: 'A Nat 1 complication is depicted immediately; no triumphant wording.',
    language: 'en',
    envelope: env({
      storyTitle: 'The Gilded Market',
      languageDirective: 'en',
      currentLocationName: 'Gilded Market',
      currentLocationDescription: 'A crowded bazaar thick with merchants and city watchmen.',
      recentSceneSnippets: ['You drift toward the merchant, eyes fixed on his heavy coin pouch.'],
      resolvedGameOutcome: {
        actionText: "Slip the coin pouch from the merchant's belt",
        outcome: 'critical_failure',
        consequence: 'Your hand is caught at the drawstring; the merchant shrieks and watchmen turn.',
      },
    }),
    expectations: {
      outcome: 'critical_failure',
      forbiddenWords: ['triumph', 'effortless', 'flawless'],
      minWords: 40,
      maxWords: 450,
    },
  },
  {
    id: 'eval_crit_success_lockpick',
    title: 'Vault lockpick critical success',
    invariant: 'A Nat 20 opens the lock cleanly and introduces the next interior challenge.',
    language: 'en',
    envelope: env({
      storyTitle: 'The Vault of Mourning',
      languageDirective: 'en',
      currentLocationName: 'Vault Antechamber',
      currentLocationDescription: 'A dust-choked antechamber before an ancient iron vault door.',
      recentSceneSnippets: ['The vault door tumblers resist your first tentative probe.'],
      resolvedGameOutcome: {
        actionText: 'Pick the ancient vault lock',
        outcome: 'critical_success',
        consequence: 'The tumblers fall in one clean sequence; the door swings inward onto a lightless stair.',
      },
    }),
    expectations: {
      outcome: 'critical_success',
      minWords: 40,
      maxWords: 450,
    },
  },
  {
    id: 'eval_mortal_barricade',
    title: 'Mortal protagonist at a military barricade',
    invariant: 'Feats stay grounded and tactical; no superheroic barehanded smashing.',
    language: 'en',
    envelope: env({
      storyTitle: 'The Iron Gate',
      languageDirective: 'en',
      currentLocationName: 'Military Gate',
      currentLocationDescription: 'A heavy timber barricade under the eyes of drilled soldiers.',
      playerStatus: {
        stats: { might: 4, agility: 6, cunning: 5, charisma: 4 },
        resources: { health: 12 },
        equippedItems: [],
      },
      recentSceneSnippets: ['Soldiers watch the barricade with the boredom of long duty.'],
      resolvedGameOutcome: {
        actionText: 'Get past the barricade',
        outcome: 'mixed_success',
        consequence: 'The barricade holds; a gap opens in the watching, not the wall.',
      },
    }),
    expectations: {
      maxDc: 16,
      allowedStatIds: STANDARD_STAT_IDS,
      minWords: 40,
      maxWords: 450,
    },
  },
  {
    id: 'eval_heroic_barricade',
    title: 'Demigod protagonist at a military barricade',
    invariant: 'Heroic brute-force choices unlock with DCs 12-19 and immense physical scale.',
    language: 'en',
    envelope: env({
      storyTitle: 'The Iron Gate',
      languageDirective: 'en',
      currentLocationName: 'Military Gate',
      currentLocationDescription: 'A heavy timber barricade under the eyes of drilled soldiers.',
      playerStatus: {
        stats: { might: 16, agility: 14, cunning: 12, charisma: 12 },
        resources: { health: 60 },
        equippedItems: ['Gauntlets of the Dawn-Titan'],
        archetypeName: 'Demigod',
      },
      recentSceneSnippets: ['Soldiers watch the barricade — small men behind small walls.'],
      resolvedGameOutcome: {
        actionText: 'Break the barricade',
        outcome: 'success',
        consequence: 'The timbers splinter; soldiers scatter from the collapsing wall.',
      },
    }),
    expectations: {
      minDc: 12,
      maxDc: 19,
      allowedStatIds: STANDARD_STAT_IDS,
      minWords: 40,
      maxWords: 450,
    },
  },
  {
    id: 'eval_dead_npc_ledger',
    title: 'Ledger-dead companion must not act alive',
    invariant: 'A companion recorded slain never appears alive, speaking, or acting.',
    language: 'en',
    envelope: env({
      storyTitle: 'The Long Retreat',
      languageDirective: 'en',
      currentLocationName: 'Ruined Chapel',
      currentLocationDescription: 'A roofless chapel where the retreat halted.',
      relevantMemories: [
        { category: 'character', importance: 10, summary: 'Rostam was slain holding the breach.' },
        { category: 'story', importance: 8, summary: 'The company buried Rostam at the chapel.' },
      ],
      recentSceneSnippets: ['Rostam fell at the breach; the survivors carried his body to the chapel.'],
      resolvedGameOutcome: {
        actionText: 'Mourn at the graveside',
        outcome: 'success',
        consequence: 'The company gathers at the fresh grave.',
      },
    }),
    expectations: {
      forbiddenAliveNames: ['Rostam'],
      minWords: 30,
      maxWords: 450,
    },
  },
  {
    id: 'eval_immutable_law',
    title: 'Magic forbidden on penalty of death',
    invariant: 'Casual spellcasting is not offered without severe guard alert and mortal danger.',
    language: 'en',
    envelope: env({
      storyTitle: 'The Silent Charter',
      languageDirective: 'en',
      currentLocationName: 'Charter Hall',
      currentLocationDescription: 'A hall watched by the Order’s grim enforcers.',
      worldLaws: ['Magic is forbidden upon penalty of death.'],
      activeNpcDossiers: [
        { name: 'Enforcer Vahl', trust: -20, knownSecrets: [], speechStyle: 'Flat, watchful.' },
      ],
      recentSceneSnippets: ['Enforcers track every hand in the hall.'],
      resolvedGameOutcome: {
        actionText: 'Enter the hall',
        outcome: 'success',
        consequence: 'You pass beneath the charter’s stone edict.',
      },
    }),
    expectations: {
      forbiddenWords: ['cast a spell', 'cast spell', 'shape the flame', 'conjure'],
      minWords: 30,
      maxWords: 450,
    },
  },
  {
    id: 'eval_threat_clock_max',
    title: 'Tension clock at maximum',
    invariant: 'The alarm crisis fires immediately in the prose and the clock stands down.',
    language: 'en',
    envelope: env({
      storyTitle: 'The Siege of Harrow Keep',
      languageDirective: 'en',
      currentLocationName: 'Castle Yard',
      currentLocationDescription: 'A torchlit yard inside the keep walls.',
      activeClocks: ['Castle Alarm: 4/4 — CRISIS TRIGGERED (crisis: the gates seal and the watch pours out)'],
      recentSceneSnippets: ['The alarm bells have not stopped ringing for a full minute.'],
      resolvedGameOutcome: {
        actionText: 'Cross the yard',
        outcome: 'mixed_success',
        consequence: 'You gain ten paces before the alarm reaches its peak.',
      },
    }),
    expectations: {
      requireConsequenceEcho: 'alarm',
      minWords: 30,
      maxWords: 450,
    },
  },
  {
    id: 'eval_persian_literary',
    title: 'Persian literary scene at the river docks',
    invariant: 'Direct speech uses «...» quoting; authentic literary Persian; no English leakage.',
    language: 'fa',
    envelope: env({
      storyTitle: 'لنگرگاه تیره‌رود',
      languageDirective: 'fa',
      currentLocationName: 'لنگرگاه تیره‌رود',
      currentLocationDescription: 'اسکله‌ای نمناک کنار رودی تاریک، مملو از قایق‌های ماهیگیری.',
      activeNpcDossiers: [
        { name: 'ماهگیر پیر', trust: 5, knownSecrets: [], speechStyle: 'آرام و کهنه‌کار.' },
      ],
      recentSceneSnippets: ['ماهگیر پیر طناب قایق را می‌کشد و به آب نگاه می‌کند.'],
      resolvedGameOutcome: {
        actionText: 'سلام کردن به ماهیگیر',
        outcome: 'success',
        consequence: 'ماهیگیر سر برمی‌گرداند و تو را برمی‌رسد.',
      },
    }),
    expectations: {
      requirePersianQuotes: true,
      minWords: 30,
      maxWords: 450,
    },
  },
  {
    id: 'eval_choice_atomicity',
    title: 'Choices state intent, never pre-baked outcomes',
    invariant: 'Choice text describes a single immediate action, not its outcome.',
    language: 'en',
    envelope: env({
      storyTitle: 'The Drowned Corridor',
      languageDirective: 'en',
      currentLocationName: 'Drowned Corridor',
      currentLocationDescription: 'A flooded passage beneath the citadel.',
      recentSceneSnippets: ['Black water laps at the corridor walls.'],
      resolvedGameOutcome: {
        actionText: 'Enter the corridor',
        outcome: 'mixed_success',
        consequence: 'The water rises to your knees; somewhere ahead, something moves.',
      },
    }),
    expectations: {
      minChoices: 2,
      maxChoices: 4,
      minWords: 30,
      maxWords: 450,
    },
  },
];
