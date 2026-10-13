import { SubQAdapter, SubQDecisionRequest } from '@/lib/providers/SubQAdapter';
import type { CheckResolution } from '@/lib/types/gameplay';

export type StallingType = 'none' | 'repetitive_standoff' | 'ignored_success' | 'choice_recycling';

export interface MomentumEvaluationInput {
  storyTitle: string;
  language?: string;
  priorScenes: string[];
  priorActions: string[];
  playerActionText: string;
  resolution: CheckResolution;
  candidateNarrative: string;
  candidateChoices: Array<{ id?: string; text: string; style?: string }>;
}

export interface MomentumEvaluationResult {
  ok: boolean;
  stallingType: StallingType;
  storyProgressed: boolean;
  confidence?: number;
  reason?: string;
  repairInstruction?: string;
  notes?: string;
  latencyMs?: number;
  skipped?: boolean;
}

export function extractSubQNoul(rawAnswer: any, fallback = true): boolean {
  if (rawAnswer === undefined || rawAnswer === null) return fallback;
  if (typeof rawAnswer === 'boolean') return rawAnswer;
  if (typeof rawAnswer?.noul === 'boolean') return rawAnswer.noul;
  if (typeof rawAnswer?.answer === 'boolean') return rawAnswer.answer;
  if (typeof rawAnswer?.value === 'boolean') return rawAnswer.value;
  if (typeof rawAnswer?.noul?.answer === 'boolean') return rawAnswer.noul.answer;
  if (typeof rawAnswer?.answer === 'string') {
    const s = rawAnswer.answer.trim().toLowerCase();
    if (s === 'true' || s === 'yes') return true;
    if (s === 'false' || s === 'no') return false;
  }
  return fallback;
}

export function extractSubQChoice(rawAnswer: any, fallback: StallingType = 'none'): StallingType {
  if (rawAnswer === undefined || rawAnswer === null) return fallback;
  let str: string | undefined;

  if (typeof rawAnswer === 'string') {
    str = rawAnswer;
  } else if (typeof rawAnswer?.choice === 'string') {
    str = rawAnswer.choice;
  } else if (typeof rawAnswer?.value === 'string') {
    str = rawAnswer.value;
  } else if (typeof rawAnswer?.index === 'number') {
    const categories: StallingType[] = [
      'none',
      'repetitive_standoff',
      'ignored_success',
      'choice_recycling',
    ];
    return categories[rawAnswer.index] ?? fallback;
  }

  if (!str) return fallback;
  const normalized = str.trim().toLowerCase();
  if (normalized.includes('ignored_success') || normalized.includes('ignored')) {
    return 'ignored_success';
  }
  if (normalized.includes('choice_recycling') || normalized.includes('recycling')) {
    return 'choice_recycling';
  }
  if (normalized.includes('repetitive_standoff') || normalized.includes('standoff') || normalized.includes('repetitive')) {
    return 'repetitive_standoff';
  }
  if (normalized.includes('none')) {
    return 'none';
  }
  return fallback;
}

export function buildSubQMomentumRequest(
  input: MomentumEvaluationInput,
  modelId = 'subq-snap-preview'
): SubQDecisionRequest {
  const state = [
    `[STORY] ${input.storyTitle}`,
    `[LANGUAGE] ${input.language ?? 'en'}`,
    `[CURRENT TURN RESOLVED OUTCOME] ${input.resolution.outcome}`,
    `[CURRENT TURN PLAYER ACTION] ${input.playerActionText}`,
    input.resolution.consequenceSummary
      ? `[MECHANICAL CONSEQUENCE] ${input.resolution.consequenceSummary}`
      : '',
    '',
    `[RECENTLY COMPLETED ACTIONS IN PRIOR TURNS]`,
    input.priorActions && input.priorActions.length > 0
      ? input.priorActions.map((a, i) => `${i + 1}. ${a}`).join('\n')
      : '(none - first turn)',
    '',
    `[PRIOR SCENE CONTEXT / STANDOFF]`,
    input.priorScenes && input.priorScenes.length > 0
      ? input.priorScenes.slice(-2).join('\n---\n')
      : '(none - opening)',
    '',
    `[NEW CANDIDATE SCENE PROSE UNDER EVALUATION]`,
    input.candidateNarrative,
    '',
    `[NEW CHOICES OFFERED TO PLAYER]`,
    (input.candidateChoices || []).map((c, i) => `${i + 1}. ${c.text}`).join('\n'),
  ]
    .filter(Boolean)
    .join('\n');

  return {
    model: modelId,
    state,
    questions: {
      story_progressed: {
        type: 'noul',
        instructions:
          "Did the new candidate scene prose advance the physical plot or resolve the bottleneck forward? Answer FALSE if the narrative keeps the characters frozen in the exact same standoff, obstacle, or conversational loop from previous turns without progressing.",
      },
      stalling_type: {
        type: 'choice',
        instructions:
          'Categorize whether this new turn demonstrates forward momentum or stalls in repetition.',
        criteria: [
          'none: The scene advances naturally into a new situation, location, or emerging consequence.',
          'repetitive_standoff: The scene repeats the exact same guard confrontation, dialogue deadlock, or gate obstacle from prior turns.',
          'ignored_success: The player scored a success or dramatic victory, but the prose continues acting as if the action had no physical effect and the barrier remains unpassed.',
          'choice_recycling: The newly offered choices re-attempt or re-offer actions already completed in prior turns.',
        ],
      },
    },
  };
}

export function buildMomentumRepairInstruction(
  stallingType: StallingType,
  outcome: string,
  language = 'en'
): string {
  const isFa = language === 'fa' || language === 'persian';

  if (isFa) {
    switch (stallingType) {
      case 'ignored_success':
        return `پیروزی یا موفقیت قاطع بازیکن (${outcome}) در عبور از مانع در متن صحنه متوقف مانده است! فوراً داستان را به جلو ببر: گذر کامل قهرمان و کاروان از معبر/دهانه و ورود به فضای جدید (مانند بازارچه، گذرگاه یا پیامد بعدی) را تصویر کن و در بن‌بست نگهبانان توقف نکن.`;
      case 'choice_recycling':
        return `گزینه‌های ارائه‌شده تکرار تصمیماتی هستند که در نوبت‌های قبل حل و فصل شده‌اند. گزینه‌های پیش‌رو باید کاملاً تازه، روبه‌جلو و متناسب با چالش جدید پس از عبور از مانع باشند.`;
      case 'repetitive_standoff':
      default:
        return `صحنه در همان بن‌بست یا گفتگوی تکراری نوبت قبل درجا می‌زند. پیشروی فیزیکی و تغییر موقعیت شخصیت‌ها را با توجه به نتیجه عمل (${outcome}) محقق کن.`;
    }
  }

  switch (stallingType) {
    case 'ignored_success':
      return `The player's decisive outcome (${outcome}) was ignored in the narrative! Immediately advance the plot: describe the protagonist successfully passing through the barrier/gate into the new environment. Do not linger in the resolved standoff.`;
    case 'choice_recycling':
      return `The offered choices repeat actions already completed in prior turns. Provide 3 completely fresh tactical choices relevant to the newly emerged situation.`;
    case 'repetitive_standoff':
    default:
      return `The scene is frozen in a repetitive stalemate from prior turns. Advance the physical coordinates and transition the characters into the next dramatic beat or emerging consequence (${outcome}).`;
  }
}

/**
 * Lightweight heuristic check when SubQ Snap is offline or unconfigured.
 * Detects obvious choice recycling and deadlock loops.
 */
export function evaluateMomentumHeuristics(
  input: MomentumEvaluationInput
): MomentumEvaluationResult {
  const candidateTexts = (input.candidateChoices || []).map((c) => (c.text || '').toLowerCase().trim());
  const priorActions = (input.priorActions || []).map((a) => a.toLowerCase().trim());

  const tokenize = (s: string) => new Set(s.split(/[\s،,.:;!؟?]+/).filter((w) => w.length > 1));

  // Check choice recycling: if any candidate choice overlaps >= 60% with any completed action
  for (const choice of candidateTexts) {
    if (choice.length < 6) continue;
    const choiceWords = tokenize(choice);
    if (choiceWords.size === 0) continue;

    for (const prior of priorActions) {
      if (prior.length < 6) continue;
      const priorWords = tokenize(prior);
      if (priorWords.size === 0) continue;

      const intersection = [...choiceWords].filter((w) => priorWords.has(w));
      const union = new Set([...choiceWords, ...priorWords]);
      const jaccard = intersection.length / union.size;
      const overlapCoefficient = intersection.length / Math.min(choiceWords.size, priorWords.size);

      if (jaccard >= 0.55 || overlapCoefficient >= 0.7) {
        return {
          ok: false,
          stallingType: 'choice_recycling',
          storyProgressed: false,
          confidence: 0.85,
          repairInstruction: buildMomentumRepairInstruction('choice_recycling', input.resolution.outcome, input.language),
          notes: `Heuristic: choice "${choice.slice(0, 30)}..." overlaps heavily with completed action "${prior.slice(0, 30)}..."`,
          skipped: false,
        };
      }
    }
  }

  return {
    ok: true,
    stallingType: 'none',
    storyProgressed: true,
    skipped: true,
  };
}

/**
 * Evaluates scene momentum using SubQ Snap decision model,
 * with automatic fallback to heuristics if SubQ is unconfigured.
 */
export async function evaluateNarrativeMomentum(
  input: MomentumEvaluationInput,
  adapter?: SubQAdapter,
  options?: { timeoutMs?: number; modelId?: string }
): Promise<MomentumEvaluationResult> {
  const client = adapter ?? new SubQAdapter();

  // If SubQ is not configured (e.g. local dev without API key), run heuristic fallback
  if (!client.isConfigured()) {
    return evaluateMomentumHeuristics(input);
  }

  const modelId = options?.modelId ?? 'subq-snap-preview';
  const request = buildSubQMomentumRequest(input, modelId);
  const response = await client.evaluate(request, { timeoutMs: options?.timeoutMs ?? 5000 });

  if (!response.success) {
    console.warn(`[MomentumGuardrail] SubQ Snap evaluation warning: ${response.error}`);
    return evaluateMomentumHeuristics(input);
  }

  const ans = response.answers;
  const storyProgressed = extractSubQNoul(ans.story_progressed, true);
  const stallingType = extractSubQChoice(ans.stalling_type, 'none');

  const isStalled = !storyProgressed || stallingType !== 'none';

  if (!isStalled) {
    return {
      ok: true,
      stallingType: 'none',
      storyProgressed: true,
      latencyMs: response.latencyMs,
      notes: `Evaluated via SubQ Snap (${response.latencyMs ?? 0}ms)`,
    };
  }

  const resolvedStallingType = stallingType !== 'none' ? stallingType : 'repetitive_standoff';
  const repairInstruction = buildMomentumRepairInstruction(
    resolvedStallingType,
    input.resolution.outcome,
    input.language
  );

  return {
    ok: false,
    stallingType: resolvedStallingType,
    storyProgressed: false,
    repairInstruction,
    latencyMs: response.latencyMs,
    notes: `Stalling detected via SubQ Snap (${resolvedStallingType}, ${response.latencyMs ?? 0}ms)`,
  };
}
