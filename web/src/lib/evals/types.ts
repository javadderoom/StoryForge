import { WorkingContextEnvelope } from '@/lib/types/memory';
import { RawSceneData } from '@/lib/engines/narrative/modelCall';
import { ChoiceOption } from '@/lib/types/gameplay';

/**
 * Plan 14 — Tier 2/3 evaluation types.
 *
 * Scenarios are evaluated against the RAW model payload (`RawSceneData`), never
 * the normalized `ChoiceOption[]`, so assertions measure the agent rather than
 * the deterministic guardrails that would repair its output.
 */

export interface EvalExpectations {
  /** Prose depicts weapons / hostile actors → zero diceless choices allowed. */
  requireNoDiceless?: boolean;
  /** Every checked choice's DC must be within [minDc, maxDc]. */
  minDc?: number;
  maxDc?: number;
  /**
   * Optional base-relative DC bands, used only when `isLowBase` is true.
   * Absolute `minDc`/`maxDc` expectations describe canonical scenarios
   * (for example the base-10 sentry floor); low-base stories use different
   * calibrated bands, so they need an explicit separate contract.
   */
  lowBaseDcBand?: Partial<Record<'low' | 'medium' | 'high', [number, number]>>;
  /** Every checked choice's stat must be one of these ids. */
  allowedStatIds?: string[];
  /** Names that must not act alive in prose (incorporeal/dead/missing). */
  forbiddenAliveNames?: string[];
  /** Resolved outcome for outcome-adherence checks. */
  outcome?: string;
  /** Words that must not appear (e.g. triumphant wording on a failed roll). */
  forbiddenWords?: string[];
  /** Prose length bounds (words). */
  minWords?: number;
  maxWords?: number;
  /** Choice-count bounds. */
  minChoices?: number;
  maxChoices?: number;
  /** FA scenarios: direct speech must be quoted with «...». */
  requirePersianQuotes?: boolean;
  /** Prose must reference the direct consequence / progression of the action. */
  requireConsequenceEcho?: string;
  /** Choices must span at least 2 distinct action styles when >= 2 choices exist. */
  requireDivergentChoices?: boolean;
  /** Prose must contain sensory immersion details (sight, sound, smell, touch). */
  requireSensoryDetail?: boolean;
  /** Treat stock AI filler clichés as hard errors instead of warnings. */
  banCliches?: boolean;
}

export interface EvalScenario {
  id: string;
  title: string;
  /** The invariant this scenario proves. */
  invariant: string;
  language: 'en' | 'fa';
  envelope: WorkingContextEnvelope;
  expectations: EvalExpectations;
}

export interface EvalFinding {
  severity: 'error' | 'warning';
  rule: string;
  detail: string;
}

export interface HeuristicStats {
  choiceCount: number;
  dicelessCount: number;
  wordCount: number;
  checkedDcs: number[];
  /** Choices the normalizer had to repair (bound a missing/unknown stat). */
  rescuedChoices: number;
  sensoryAnchorCount: number;
}

export interface HeuristicReport {
  passed: boolean;
  findings: EvalFinding[];
  stats: HeuristicStats;
}

export interface JudgeScore {
  model: string;
  scores: {
    causeEffect: number;
    feasibility: number;
    divergence: number;
    polish: number;
  };
  notes?: string;
}

export interface EvalResult {
  scenarioId: string;
  title: string;
  invariant: string;
  modelUsed: string | null;
  source: 'cassette' | 'live' | 'missing';
  heuristic: HeuristicReport;
  /** Normalized choices, for display only (never the assertion target). */
  choices: ChoiceOption[];
  narrative: string;
  raw: RawSceneData | null;
  judge?: JudgeScore;
  passed: boolean;
}

export interface EvalRunSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  results: EvalResult[];
}
