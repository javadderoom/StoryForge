import { z } from 'zod';

/**
 * Narrator model registry — Studio-managed routing for the AI narrator's
 * engine tiers.
 *
 * The tier -> provider/model mapping decides which model answers a reader turn
 * in each credit tier (normal 1x / plus 2x / advance 5x). Until now that
 * mapping was hardcoded in `narrativeAdapterFactory.ts`; it is now persisted
 * per tier so an operator can repoint a tier at a different provider or model
 * without a code change or redeploy.
 *
 * Rules that keep this safe:
 *  - A missing/invalid row falls back to the code default. The narrator must
 *    never fail to generate because a settings row is absent or malformed.
 *  - Rows are read through a short-lived cache: a reader turn must not pay a
 *    database round-trip, but a change must still land quickly.
 *  - Secrets never live here. API keys stay in the environment; this registry
 *    only decides *which* model to ask.
 */

export type NarratorTier = 'normal' | 'plus' | 'advance';
export type NarratorProvider = 'gemini' | 'aiprime' | 'sinox';

export const NARRATOR_TIERS: readonly NarratorTier[] = ['normal', 'plus', 'advance'];

export const NARRATOR_PROVIDERS: readonly NarratorProvider[] = ['gemini', 'aiprime', 'sinox'];

export const NARRATOR_PROVIDER_LABELS: Record<NarratorProvider, { en: string; fa: string }> = {
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
  /** Optional reasoning effort for thinking-capable providers. */
  reasoningEffort?: 'low' | 'medium' | 'high';
  /** Optional thinking/reasoning token budget. */
  thinkingBudgetTokens?: number;
}

/** Where the effective config came from — surfaced in the Studio UI. */
export type NarratorConfigSource = 'database' | 'default';

export interface ResolvedNarratorTierConfig extends NarratorTierConfig {
  source: NarratorConfigSource;
  /** True when the row was found but had to be repaired (bad value → default). */
  repaired: boolean;
}

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
 * Which optional knobs each provider actually supports.
 *
 * The direct Gemini path answers through the cascading queue (no endpoint, no
 * fallback chain, no reasoning knobs). The OpenAI-compatible providers accept
 * an endpoint override and a fallback model; only Sinox understands the
 * reasoning/thinking knobs.
 */
export const NARRATOR_PROVIDER_CAPABILITIES: Record<
  NarratorProvider,
  { endpoint: boolean; fallback: boolean; reasoning: boolean; thinking: boolean }
> = {
  gemini: { endpoint: false, fallback: false, reasoning: false, thinking: false },
  aiprime: { endpoint: true, fallback: true, reasoning: false, thinking: false },
  sinox: { endpoint: true, fallback: true, reasoning: true, thinking: true },
};

/**
 * Strips the knobs the tier's provider does not support. A provider switch
 * (e.g. Gemini → AI Prime) must not leave a stale endpoint or a thinking
 * budget behind — the request would break or silently do nothing.
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

// ---------------------------------------------------------------------------
// Persistence (optional — a deployment without these rows keeps the defaults)
// ---------------------------------------------------------------------------

interface CachedRegistry {
  at: number;
  configs: Record<NarratorTier, ResolvedNarratorTierConfig>;
}

/** Cache TTL: a reader turn must not wait on the database, but a change must land fast. */
export const NARRATOR_CONFIG_CACHE_TTL_MS = 30_000;

let cache: CachedRegistry | null = null;

export function invalidateNarratorTierCache(): void {
  cache = null;
}

interface NarratorTierRow {
  tier: string;
  provider: string;
  model: string;
  fallbackModel: string | null;
  endpoint: string | null;
  temperature: number | null;
  reasoningEffort: string | null;
  thinkingBudgetTokens: number | null;
}

/**
 * Reads the persisted tier rows. Returns null when the database is unavailable
 * (or the table does not exist yet), which keeps the narrator on defaults.
 */
export async function readNarratorTierRows(): Promise<NarratorTierRow[] | null> {
  try {
    const { getPrisma } = await import('@/lib/db/client');
    const prisma = getPrisma();
    if (!prisma) return null;
    const rows = await (prisma as any).narratorModelTier.findMany();
    return Array.isArray(rows) ? (rows as NarratorTierRow[]) : null;
  } catch (err) {
    console.warn('[narratorModelRegistry] could not read tier rows, using defaults:', err);
    return null;
  }
}

export async function writeNarratorTierRow(
  tier: NarratorTier,
  config: NarratorTierConfig,
  updatedBy?: string
): Promise<void> {
  const { getPrisma } = await import('@/lib/db/client');
  const prisma = getPrisma();
  if (!prisma) throw new Error('Database is disabled — cannot persist narrator tier settings.');
  await (prisma as any).narratorModelTier.upsert({
    where: { tier },
    create: {
      tier,
      provider: config.provider,
      model: config.model,
      fallbackModel: config.fallbackModel ?? null,
      endpoint: config.endpoint ?? null,
      temperature: config.temperature ?? null,
      reasoningEffort: config.reasoningEffort ?? null,
      thinkingBudgetTokens: config.thinkingBudgetTokens ?? null,
      updatedBy: updatedBy ?? null,
    },
    update: {
      provider: config.provider,
      model: config.model,
      fallbackModel: config.fallbackModel ?? null,
      endpoint: config.endpoint ?? null,
      temperature: config.temperature ?? null,
      reasoningEffort: config.reasoningEffort ?? null,
      thinkingBudgetTokens: config.thinkingBudgetTokens ?? null,
      updatedBy: updatedBy ?? null,
    },
  });
}

/**
 * The effective config for every tier: persisted row when present and valid,
 * code default otherwise. Cached for a short window.
 */
export async function getNarratorTierConfigs(
  options?: { force?: boolean }
): Promise<Record<NarratorTier, ResolvedNarratorTierConfig>> {
  const now = Date.now();
  if (!options?.force && cache && now - cache.at < NARRATOR_CONFIG_CACHE_TTL_MS) {
    return cache.configs;
  }

  const rows = await readNarratorTierRows();
  const byTier = new Map<NarratorTier, NarratorTierRow>();
  for (const row of rows ?? []) {
    if (NARRATOR_TIERS.includes(row.tier as NarratorTier)) {
      byTier.set(row.tier as NarratorTier, row);
    }
  }

  const configs = {} as Record<NarratorTier, ResolvedNarratorTierConfig>;
  for (const tier of NARRATOR_TIERS) {
    const row = byTier.get(tier);
    if (!row) {
      configs[tier] = { ...DEFAULT_NARRATOR_TIER_CONFIGS[tier], source: 'default', repaired: false };
      continue;
    }
    const { config, repaired } = repairNarratorTierConfig(row as unknown as Record<string, unknown>);
    configs[tier] = { ...config, source: 'database', repaired };
  }

  cache = { at: now, configs };
  return configs;
}

/** Effective config for one tier. */
export async function getNarratorTierConfig(
  tier: NarratorTier | undefined,
  options?: { force?: boolean }
): Promise<ResolvedNarratorTierConfig> {
  const configs = await getNarratorTierConfigs(options);
  const key: NarratorTier = tier && NARRATOR_TIERS.includes(tier) ? tier : 'normal';
  return configs[key];
}
