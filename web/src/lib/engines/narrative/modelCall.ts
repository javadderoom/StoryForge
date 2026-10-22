import { generateStructuredJson } from '@/lib/ai/geminiClient';
import { GenerationPromptPayload } from './PromptAssembler';

/**
 * Plan 14 — the RAW (pre-normalization) model payload. Unlike the normalized
 * `ChoiceOption[]` returned by `generateScene`, this preserves exactly what the
 * model produced so evaluation harnesses can measure the agent itself rather
 * than the deterministic guardrails that would repair its output.
 */
export interface RawSceneData {
  narrative?: unknown;
  choices?: unknown;
  extractedMemories?: unknown;
  [key: string]: unknown;
}

export interface RawSceneResult {
  data: RawSceneData;
  /** Verbatim model text, retained for judge/adversarial inspection. */
  rawText: string;
  modelUsed: string;
}

export interface SceneModelOptions {
  temperature?: number;
  preferredModel?: string;
  /**
   * Thinking (reasoning) token budget for the models that support it. Gemini
   * takes its native `thinkingConfig.thinkingBudget`; the OpenAI-compatible
   * gateways take `thinking.budget_tokens`.
   */
  thinkingBudgetTokens?: number;
  /**
   * Optional callback for real-time narrative streaming. When supplied, the
   * underlying model call streams tokens and invokes this with decoded narrative
   * text deltas as they are generated.
   */
  onTextDelta?: (delta: string) => void;
}

/**
 * The single injectable seam through which scene generation flows. Production
 * uses `defaultSceneModelCall` (the multi-model cascading queue); evaluation
 * harnesses substitute a replay/record/live implementation.
 */
export type SceneModelCall = (
  prompt: GenerationPromptPayload,
  options?: SceneModelOptions
) => Promise<RawSceneResult | null>;

/**
 * Production model call: wraps the existing cascading Gemini queue with the
 * exact options the adapter has always used (`taskType: 'scene'`, temp 0.75).
 */
export async function defaultSceneModelCall(
  prompt: GenerationPromptPayload,
  options: SceneModelOptions = {}
): Promise<RawSceneResult | null> {
  const result = await generateStructuredJson<RawSceneData>(
    prompt.userPrompt,
    prompt.systemPrompt,
    {
      taskType: 'scene',
      temperature: options.temperature ?? 0.75,
      ...(options.preferredModel ? { preferredModel: options.preferredModel as never } : {}),
      ...(options.thinkingBudgetTokens
        ? { thinkingBudgetTokens: options.thinkingBudgetTokens }
        : {}),
    }
  );
  if (!result) return null;
  return { data: result.data, rawText: result.rawText, modelUsed: result.modelUsed };
}
