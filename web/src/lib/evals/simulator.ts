import { ActionStyle, ChoiceOption, DiceOutcome } from '@/lib/types/gameplay';
import { WorkingContextEnvelope } from '@/lib/types/memory';
import { PromptAssembler } from '@/lib/engines/narrative/PromptAssembler';
import { RawSceneData, SceneModelCall } from '@/lib/engines/narrative/modelCall';
import { GeminiAdapter } from '@/lib/providers/GeminiAdapter';
import { evaluateRawScene } from './evaluator';
import { EvalFinding } from './types';

/**
 * Plan 14 — Tier 4: autonomous multi-turn playtest simulator (headless).
 *
 * Drives N consecutive turns with a persona policy, resolving each turn
 * deterministically, then audits the *trajectory* (HP, threat clocks, memory
 * accumulation, prose loops). Runs free in CI with a synthetic-but-valid model;
 * `--live` swaps in the real model.
 */

export type PersonaId = 'brute' | 'shadow' | 'diplomat' | 'boundary';

export interface Persona {
  id: PersonaId;
  label: string;
  preferredStyles: ActionStyle[];
  preferredStats: string[];
  /** Picks the riskiest / highest-DC option regardless of style. */
  risky?: boolean;
}

export const PERSONAS: Record<PersonaId, Persona> = {
  brute: { id: 'brute', label: 'The Brute', preferredStyles: ['aggressive', 'tactical'], preferredStats: ['might'] },
  shadow: { id: 'shadow', label: 'The Shadow', preferredStyles: ['stealthy', 'agile'], preferredStats: ['agility', 'cunning'] },
  diplomat: { id: 'diplomat', label: 'The Diplomat', preferredStyles: ['diplomatic', 'inquisitive'], preferredStats: ['charisma', 'cunning'] },
  boundary: { id: 'boundary', label: 'The Boundary-Pusher', preferredStyles: [], preferredStats: [], risky: true },
};

/** Mulberry32 — tiny deterministic PRNG so simulations are reproducible. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Persona-driven choice selection. */
export function pickChoice(persona: Persona, choices: ChoiceOption[]): ChoiceOption | undefined {
  if (!choices.length) return undefined;
  if (persona.risky) {
    return [...choices].sort((a, b) => (b.targetDC ?? 0) - (a.targetDC ?? 0))[0];
  }
  const score = (c: ChoiceOption) => {
    let s = 0;
    if (persona.preferredStyles.includes(c.style)) s += 3;
    if (c.requiredStatId && persona.preferredStats.includes(c.requiredStatId)) s += 3;
    if (c.requiredStatId) s += 1;
    return s;
  };
  return [...choices].sort((a, b) => score(b) - score(a))[0];
}

const SIM_STATS = ['might', 'agility', 'cunning', 'charisma'];

/**
 * Deterministic synthetic model that always returns schema-valid, guardrail-clean
 * output. It exercises the trajectory/engine audit without network or credits.
 */
export function syntheticSimModel(): SceneModelCall {
  let call = 0;
  return async () => {
    call += 1;
    const turn = call;
    const data: RawSceneData = {
      narrative:
        `Turn ${turn}: the corridor narrows and cold air moves against your skin. ` +
        `A sentry shifts his weight at the far arch, spear angled toward the floor, watching you without speaking. ` +
        `Somewhere behind the walls a chain is drawn taut and released.`,
      choices: [
        { id: `t${turn}_a`, text: 'Draw your sword and close the distance', style: 'aggressive', riskLevel: 'high', requiredStatId: 'might', targetDC: 14, risk: 'high' },
        { id: `t${turn}_b`, text: 'Slip along the shadowed wall', style: 'stealthy', riskLevel: 'medium', requiredStatId: 'agility', targetDC: 12 },
        { id: `t${turn}_c`, text: 'Ask the sentry who holds the gate', style: 'diplomatic', riskLevel: 'medium', requiredStatId: 'charisma', targetDC: 12 },
      ],
      extractedMemories: [
        { category: 'story', importance: 5 + (turn % 3), summary: `Turn ${turn}: reached the narrow corridor past the arch.` },
      ],
    };
    return { data, rawText: JSON.stringify(data), modelUsed: 'sim-synthetic' };
  };
}

export interface SimTurn {
  turn: number;
  actionText: string;
  outcome: string;
  diceRoll: number;
  hp: number;
  clockSegments: number;
  proseWords: number;
  findings: EvalFinding[];
}

export interface SimReport {
  persona: PersonaId;
  seed: number;
  turns: SimTurn[];
  findings: EvalFinding[];
  passed: boolean;
}

export interface SimOptions {
  persona: PersonaId;
  turns: number;
  seed?: number;
  /** Defaults to the deterministic synthetic model. */
  modelCall?: SceneModelCall;
  maxHp?: number;
}

function classify(roll: number, dc: number): DiceOutcome {
  if (roll === 20) return 'critical_success';
  if (roll === 1) return 'critical_failure';
  if (roll >= dc) return 'success';
  if (roll >= dc - 3) return 'mixed_success';
  return 'failure';
}

/**
 * Runs `turns` consecutive turns with the given persona and audits the run for
 * trajectory invariants. Never throws on a rule violation — violations are
 * reported as findings so the CLI can render them.
 */
export async function runSimulation(options: SimOptions): Promise<SimReport> {
  const persona = PERSONAS[options.persona];
  const seed = options.seed ?? 1337;
  const rng = makeRng(seed);
  const modelCall = options.modelCall ?? syntheticSimModel();

  const findings: EvalFinding[] = [];
  const turns: SimTurn[] = [];

  let hp = options.maxHp ?? 30;
  let clock = {
    id: 'clock_gate',
    name: 'Castle Alarm',
    currentSegments: 0,
    maxSegments: 4,
    crisisDescription: 'the gates seal and the watch pours out',
  };
  let choices: ChoiceOption[] = [];
  let defeated = false;
  const seenProse = new Set<string>();
  const seenMemories = new Set<string>();

  for (let turn = 1; turn <= options.turns; turn++) {
    const choice = pickChoice(persona, choices) ?? {
      id: `fallback_${turn}`,
      text: 'Press deeper into the dark',
      style: 'tactical' as ActionStyle,
      riskLevel: 'medium' as const,
      requiredStatId: 'cunning',
      targetDC: 12,
    };

    const roll = 1 + Math.floor(rng() * 20);
    const dc = choice.targetDC ?? 12;
    const outcome = classify(roll, dc);

    // Deterministic vitals + clock trajectory.
    const dmg = outcome === 'critical_failure' ? 3 : outcome === 'failure' ? 2 : outcome === 'mixed_success' ? 1 : 0;
    hp = Math.max(0, hp - dmg);

    if (outcome === 'critical_failure' || outcome === 'failure') {
      clock = { ...clock, currentSegments: clock.currentSegments + 1 };
      if (clock.currentSegments >= clock.maxSegments) {
        clock = { ...clock, currentSegments: 0 }; // crisis fired, clock stands down
      }
    }

    const envelope: WorkingContextEnvelope = {
      storyTitle: 'Simulation Run',
      worldLaws: ['The gates seal at the alarm.'],
      currentLocationName: 'Narrow Corridor',
      currentLocationDescription: 'A cold passage beneath the keep.',
      activeNpcDossiers: [{ name: 'Sentry', trust: -5, knownSecrets: [], speechStyle: 'Silent, watchful.' }],
      relevantMemories: [],
      playerStatus: {
        stats: { might: 12, agility: 12, cunning: 12, charisma: 12 },
        resources: { health: hp },
        equippedItems: ['Short sword'],
      },
      recentSceneSnippets: turns.length ? [turns[turns.length - 1].actionText] : [],
      languageDirective: 'en',
      universalBaseValue: 10,
      activeClocks: [`${clock.name}: ${clock.currentSegments}/${clock.maxSegments}`],
      resolvedGameOutcome: {
        actionText: choice.text,
        outcome,
        consequence: `The attempt resolves as ${outcome}.`,
      },
    };

    const prompt = PromptAssembler.buildNarrativePrompt(envelope);
    const adapter = new GeminiAdapter(undefined, `sim-${turn}`, { modelCall });
    const { response, raw } = await adapter.generateSceneWithRaw(prompt);

    if (!raw) {
      findings.push({ severity: 'error', rule: 'sim.no_output', detail: `Turn ${turn} produced no model output.` });
      break;
    }

    const turnReport = evaluateRawScene(raw.data, {
      expectations: { minChoices: 2, maxChoices: 4, requireNoDiceless: true, minWords: 5 },
      validStatIds: SIM_STATS,
      isEnglish: true,
    });

    // Prose-loop detection.
    const proseKey = response.narrative.trim();
    if (seenProse.has(proseKey)) {
      findings.push({ severity: 'error', rule: 'sim.prose_loop', detail: `Turn ${turn} repeated prose verbatim (cyclical trap).` });
    }
    seenProse.add(proseKey);

    // Memory-flooding detection.
    const mems = Array.isArray(raw.data.extractedMemories)
      ? (raw.data.extractedMemories as Array<Record<string, unknown>>)
      : [];
    for (const m of mems) {
      const summary = String(m?.summary ?? '').trim();
      if (!summary) continue;
      if (seenMemories.has(summary)) {
        findings.push({ severity: 'error', rule: 'sim.memory_duplicate', detail: `Turn ${turn} re-inserted an identical memory: "${summary}"` });
      }
      seenMemories.add(summary);
    }

    for (const f of turnReport.findings) {
      if (f.severity === 'error') {
        findings.push({ ...f, rule: `sim.${f.rule}`, detail: `Turn ${turn}: ${f.detail}` });
      }
    }

    turns.push({
      turn,
      actionText: choice.text,
      outcome,
      diceRoll: roll,
      hp,
      clockSegments: clock.currentSegments,
      proseWords: turnReport.stats.wordCount,
      findings: turnReport.findings,
    });

    choices = response.choices;

    if (hp === 0) {
      defeated = true;
      findings.push({ severity: 'warning', rule: 'sim.defeat', detail: `Player reached 0 HP on turn ${turn}; simulation halted.` });
      break;
    }
  }

  // Cross-turn trajectory audit.
  if (turns.some((t) => t.hp < 0)) {
    findings.push({ severity: 'error', rule: 'sim.negative_hp', detail: 'HP went negative without a defeat event.' });
  }
  if (hp === 0 && !defeated) {
    findings.push({ severity: 'error', rule: 'sim.silent_death', detail: 'Player at 0 HP without a defeat flag.' });
  }
  if (turns.length < options.turns && !defeated) {
    findings.push({ severity: 'warning', rule: 'sim.short_run', detail: `Simulation stopped after ${turns.length}/${options.turns} turns.` });
  }

  return {
    persona: persona.id,
    seed,
    turns,
    findings,
    passed: !findings.some((f) => f.severity === 'error'),
  };
}

