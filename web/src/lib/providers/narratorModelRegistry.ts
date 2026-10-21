import {
  DEFAULT_NARRATOR_TIER_CONFIGS,
  NARRATOR_TIERS,
  normalizeNarratorTierConfig,
  repairNarratorTierConfig,
  validateNarratorTierConfig,
  type NarratorTier,
  type NarratorTierConfig,
} from './narratorModelConfig';

/**
 * Narrator model registry — the server half of the Studio-managed narrator
 * tier routing (the pure configuration lives in `narratorModelConfig.ts`, which
 * is safe to import from a browser bundle).
 *
 * Rules that keep this safe:
 *  - A missing/invalid row falls back to the code default. The narrator must
 *    never fail to generate because a settings row is absent or malformed.
 *  - Rows are read through a short-lived cache: a reader turn must not pay a
 *    database round-trip, but a change must still land quickly.
 *  - Secrets never live here. API keys stay in the environment; this registry
 *    only decides *which* model to ask.
 */

export * from './narratorModelConfig';

export type NarratorConfigSource = 'database' | 'default';

export interface ResolvedNarratorTierConfig extends NarratorTierConfig {
  source: NarratorConfigSource;
  /** True when the row was found but had to be repaired (bad value → default). */
  repaired: boolean;
}

/** Cache TTL: a reader turn must not wait on the database, but a change must land fast. */
export const NARRATOR_CONFIG_CACHE_TTL_MS = 30_000;

let cache: { at: number; configs: Record<NarratorTier, ResolvedNarratorTierConfig> } | null = null;

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
  const normalized = normalizeNarratorTierConfig(config);
  await (prisma as any).narratorModelTier.upsert({
    where: { tier },
    create: {
      tier,
      provider: normalized.provider,
      model: normalized.model,
      fallbackModel: normalized.fallbackModel ?? null,
      endpoint: normalized.endpoint ?? null,
      temperature: normalized.temperature ?? null,
      reasoningEffort: normalized.reasoningEffort ?? null,
      thinkingBudgetTokens: normalized.thinkingBudgetTokens ?? null,
      updatedBy: updatedBy ?? null,
    },
    update: {
      provider: normalized.provider,
      model: normalized.model,
      fallbackModel: normalized.fallbackModel ?? null,
      endpoint: normalized.endpoint ?? null,
      temperature: normalized.temperature ?? null,
      reasoningEffort: normalized.reasoningEffort ?? null,
      thinkingBudgetTokens: normalized.thinkingBudgetTokens ?? null,
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
