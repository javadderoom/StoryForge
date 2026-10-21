import { z } from 'zod';

/**
 * Narrator model configuration — the pure, client-safe half of the narrator
 * model registry.
 *
 * Everything here is data + validation: no database, no environment, no
 * server-only import. The Studio page imports this module directly (the
 * server-side registry lives in `narratorModelRegistry.ts` and must never be
 * pulled into a browser bundle).
 *
 * The tier -> provider/model mapping decides which model answers a reader turn
 * in each credit tier (normal 1x / plus 2x / advance 5x). Until now that
 * mapping was hardcoded in `narrativeAdapterFactory.ts`; it is now persisted
 * per tier so an operator can repoint a tier at a different provider or model
 * without a code change or redeploy.
 */

export type NarratorTier = 'normal' | 'plus' | 'advance';
export type NarratorProvider = 'gemini' | 'aiprime' | 'sinox';

export const NARRATOR_TIERS: readonly NarratorTier[] = ['normal', 'plus', 'advance'];

export const NARRATOR_PROVIDERS: readonly NarratorProvider[] = ['gemini', 'aiprime', 'sinox'];

export const NARRATOR_PROVIDER_LABELS: Record< NarratorProvider, { en: string; fa: string }> = {
  gemini: { en: 'Google Gemini (direct)', fa: 'جمینی (مستقیم)' },
  aiprime: { en: 'AI Prime (OpenAI-compatible)', fa: 'آی‌پرایم' },
  sinox: { en: 'Sinox (OpenAI-compatible)', fa: 'سینوکس' },
};

/** Credit cost per tier — mirrors `ENGINE_TIER_COSTS` (display only). */
export const NARRATOR_TIER_COSTS: Record<NarratorTier, number> = {
  normal: 1,
  plus: 2,
  advance: 5,
};

export interface NarratorTierConfig {
  tier: NarratorTier;
  provider: NarratorProvider;
  /** Primary model id handed to the provider. */
  model: string;
  /** Optional fallback model id, tried when the primary route fails. */
  fallbackModel?: string;
  /** Optional endpoint override (OpenAI-compatible routes only). */
  endpoint?: string;
  /** Optional sampling temperature override. */
  temperature?: number;
  /**
   * Optional reasoning effort for OpenAI-compatible gateways that accept
   * `reasoning_effort` (AI Prime, Sinox).
   */
  reasoningEffort?: 'low' | 'medium' | 'high';
  /**
   * Optional thinking/reasoning token budget. Mapped per provider:
   * OpenAI-compatible gateways take `thinking.budget_tokens`, Gemini takes its
   * native `thinkingConfig.thinkingBudget`.
   */
  thinkingBudgetTokens?: number;
}

/**
 * Which optional knobs each provider actually supports.
 *
 * - Gemini (direct) answers through the cascading queue: no endpoint, no
 *   fallback chain, and no `reasoning_effort` (that is an OpenAI-ism) — but it
 *   DOES have a native thinking budget.
 * - The OpenAI-compatible gateways (AI Prime, Sinox) take an endpoint
 *   override, a fallback model, `reasoning_effort` and a thinking budget.
 */
export const NARRATOR_PROVIDER_CAPABILITIES: Record<
  NarratorProvider,
  { endpoint: boolean; fallback: boolean; reasoning: boolean; thinking: boolean }
> = {
  gemini: { endpoint: false, fallback: false, reasoning: false, thinking: true },
  aiprime: { endpoint: true, fallback: true, reasoning: true, thinking: true },
  sinox: { endpoint: true, fallback: true, reasoning: true, thinking: true },
};

export const SINOX_ENDPOINT = 'https://sinoxapi.com/v1/chat/completions';
export const AIPRIME_ENDPOINT = 'https://api.aiprime.shop/v1/chat/completions';

/**
 * The code defaults — the exact routing that shipped before the Studio
 * section existed. They are the fallback for every missing/invalid row.
 */
export const DEFAULT_NARRATOR_TIER_CONFIGS: Record<NarratorTier, NarratorTierConfig> = {
  normal: {
    tier: 'normal',
    provider: 'gemini',
    model: 'gemini-3.5-flash-lite',
  },
  plus: {
    tier: 'plus',
    provider: 'aiprime',
    model: 'gemini-3.8-flash',
    fallbackModel: 'gemini-2.5-flash',
    endpoint: AIPRIME_ENDPOINT,
  },
  advance: {
    tier: 'advance',
    provider: 'sinox',
    model: 't-gemini-4-argon',
    endpoint: SINOX_ENDPOINT,
    reasoningEffort: 'low',
    thinkingBudgetTokens: 1024,
  },
};

/** Model ids are provider slugs — keep them conservative and log-friendly. */
const MODEL_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,80}$/;
const ENDPOINT_RE = /^https?:\/\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+$/;

export const NarratorTierConfigSchema = z.object({
  tier: z.enum(['normal', 'plus', 'advance']),
  provider: z.enum(['gemini', 'aiprime', 'sinox']),
  model: z
    .string()
    .trim()
    .min(1, 'model is required')
    .max(81)
    .regex(MODEL_ID_RE, 'model may only contain letters, digits, dot, dash, colon or underscore'),
  fallbackModel: z
    .string()
    .trim()
    .min(1)
    .max(81)
    .regex(MODEL_ID_RE, 'fallback model may only contain letters, digits, dot, dash, colon or underscore')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  endpoint: z
    .string()
    .trim()
    .max(300)
    .regex(ENDPOINT_RE, 'endpoint must be an http(s) URL')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  temperature: z.number().min(0).max(2).optional(),
  reasoningEffort: z.enum(['low', 'medium', 'high']).optional(),
  thinkingBudgetTokens: z.number().int().min(0).max(32768).optional(),
});

/** Validates one tier config. Returns the parsed value or a field-keyed error map. */
export function validateNarratorTierConfig(
  input: unknown
): { ok: true; value: NarratorTierConfig } | { ok: false; errors: Record<string, string> } {
  const parsed = NarratorTierConfigSchema.safeParse(input);
  if (parsed.success) {
    return { ok: true, value: parsed.data as NarratorTierConfig };
  }
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.join('.') || '_';
    if (!errors[key]) errors[key] = issue.message;
  }
  return { ok: false, errors };
}

/**
 * Strips the knobs the tier's provider does not support. A provider switch
 * (e.g. Gemini → AI Prime) must not leave a stale endpoint or an unsupported
 * reasoning mode behind — the request would break or silently do nothing.
 */
export function normalizeNarratorTierConfig(config: NarratorTierConfig): NarratorTierConfig {
  const caps = NARRATOR_PROVIDER_CAPABILITIES[config.provider];
  const out: NarratorTierConfig = { ...config };
  if (!caps.endpoint) out.endpoint = undefined;
  if (!caps.fallback) out.fallbackModel = undefined;
  if (!caps.reasoning) out.reasoningEffort = undefined;
  if (!caps.thinking) out.thinkingBudgetTokens = undefined;
  return out;
}

/**
 * Repairs a persisted row into a usable config. Any invalid field falls back
 * to the code default for that field, and the tier itself falls back to the
 * whole default entry when it cannot be trusted at all.
 */
export function repairNarratorTierConfig(
  raw: Record<string, unknown> | null | undefined
): { config: NarratorTierConfig; repaired: boolean } {
  const fallback = DEFAULT_NARRATOR_TIER_CONFIGS.normal;
  if (!raw) return { config: fallback, repaired: true };
  const tier = NARRATOR_TIERS.includes(raw.tier as NarratorTier)
    ? (raw.tier as NarratorTier)
    : null;
  if (!tier) return { config: fallback, repaired: true };
  const candidate = {
    tier,
    provider: raw.provider,
    model: raw.model,
    fallbackModel: raw.fallbackModel ?? undefined,
    endpoint: raw.endpoint ?? undefined,
    temperature: typeof raw.temperature === 'number' ? raw.temperature : undefined,
    reasoningEffort: raw.reasoningEffort ?? undefined,
    thinkingBudgetTokens:
      typeof raw.thinkingBudgetTokens === 'number' ? raw.thinkingBudgetTokens : undefined,
  };
  const parsed = validateNarratorTierConfig(candidate);
  if (parsed.ok) {
    const normalized = normalizeNarratorTierConfig(parsed.value);
    const repaired =
      normalized.endpoint !== parsed.value.endpoint ||
      normalized.fallbackModel !== parsed.value.fallbackModel ||
      normalized.reasoningEffort !== parsed.value.reasoningEffort ||
      normalized.thinkingBudgetTokens !== parsed.value.thinkingBudgetTokens;
    return { config: normalized, repaired };
  }
  return { config: DEFAULT_NARRATOR_TIER_CONFIGS[tier], repaired: true };
}
