import { NextRequest, NextResponse } from 'next/server';
import { requireStudioAdmin, requireStudioWrite } from '@/lib/auth/studioAuth';
import {
  DEFAULT_NARRATOR_TIER_CONFIGS,
  NARRATOR_PROVIDERS,
  NARRATOR_PROVIDER_LABELS,
  NARRATOR_TIERS,
  NARRATOR_TIER_COSTS,
  getNarratorTierConfigs,
  invalidateNarratorTierCache,
  normalizeNarratorTierConfig,
  validateNarratorTierConfig,
  writeNarratorTierRow,
  type NarratorTier,
  type NarratorTierConfig,
} from '@/lib/providers/narratorModelRegistry';
import { isProviderConfigured } from '@/lib/providers/narrativeAdapterFactory';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Shared payload shape for the Studio page. */
function buildPayload(role?: string) {
  return {
    tiers: NARRATOR_TIERS.map((tier) => ({
      tier,
      cost: NARRATOR_TIER_COSTS[tier],
      label: {
        normal: { en: 'Standard', fa: 'استاندارد' },
        plus: { en: 'Plus', fa: 'پلاس' },
        advance: { en: 'Advance', fa: 'پیشرفته' },
      }[tier],
    })),
    providers: NARRATOR_PROVIDERS.map((provider) => ({
      provider,
      label: NARRATOR_PROVIDER_LABELS[provider],
      configured: isProviderConfigured(provider),
    })),
    defaults: DEFAULT_NARRATOR_TIER_CONFIGS,
    role,
    canEdit: role === 'ADMIN',
  };
}

/**
 * GET — the effective routing for every narrator tier.
 *
 * Readable by any Studio role (an AUTHOR needs to see which model serves the
 * reader), but only an ADMIN may change it.
 */
export async function GET(req: NextRequest) {
  const guard = await requireStudioWrite(req);
  if (!guard.ok) return guard.response;

  try {
    const configs = await getNarratorTierConfigs({ force: true });
    return NextResponse.json({
      success: true,
      data: {
        ...buildPayload(guard.user.role),
        configs,
        role: guard.user.role,
        canEdit: guard.user.role === 'ADMIN',
      },
    });
  } catch (error: any) {
    console.error('Narrator model registry read failed:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to read narrator model settings.' },
      { status: 500 }
    );
  }
}

/**
 * PUT — persist the tier routing. ADMIN only.
 *
 * Every tier is validated before anything is written, so a bad payload can
 * never leave the narrator half-configured.
 */
export async function PUT(req: NextRequest) {
  const guard = await requireStudioAdmin(req);
  if (!guard.ok) return guard.response;

  try {
    const body = await req.json();
    const input = body?.tiers ?? body;

    const validated: Record<string, NarratorTierConfig> = {};
    const errors: Record<string, Record<string, string>> = {};

    for (const tier of NARRATOR_TIERS) {
      const raw = input?.[tier];
      if (!raw) {
        errors[tier] = { _: 'missing tier payload' };
        continue;
      }
      const result = validateNarratorTierConfig({ ...raw, tier });
      if (!result.ok) {
        errors[tier] = result.errors;
        continue;
      }
      // Provider-specific knobs are enforced server-side: a client cannot
      // attach an AI Prime endpoint to a Gemini tier.
      validated[tier] = normalizeNarratorTierConfig(result.value);
    }

    if (Object.keys(errors).length > 0) {
      return NextResponse.json(
        { success: false, error: 'Validation failed.', fieldErrors: errors },
        { status: 400 }
      );
    }

    for (const tier of NARRATOR_TIERS) {
      await writeNarratorTierRow(tier, validated[tier], guard.user.id);
    }
    invalidateNarratorTierCache();

    const configs = await getNarratorTierConfigs({ force: true });
    return NextResponse.json({ success: true, data: { ...buildPayload(guard.user.role), configs } });
  } catch (error: any) {
    console.error('Narrator model registry write failed:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to save narrator model settings.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE — reset every tier to the code defaults. ADMIN only.
 */
export async function DELETE(req: NextRequest) {
  const guard = await requireStudioAdmin(req);
  if (!guard.ok) return guard.response;

  try {
    const { getPrisma } = await import('@/lib/db/client');
    const prisma = getPrisma();
    if (prisma) {
      await (prisma as any).narratorModelTier.deleteMany({});
    }
    invalidateNarratorTierCache();
    const configs = await getNarratorTierConfigs({ force: true });
    return NextResponse.json({ success: true, data: { ...buildPayload(guard.user.role), configs } });
  } catch (error: any) {
    console.error('Narrator model registry reset failed:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to reset narrator model settings.' },
      { status: 500 }
    );
  }
}

/**
 * POST — probe a tier's provider with a minimal call.
 *
 * The probe is the only way to know whether a provider/model/key combination
 * actually answers before a reader turn depends on it. It sends a tiny
 * "ping" and reports latency — it costs a fraction of a cent, so the UI asks
 * for confirmation first.
 */
export async function POST(req: NextRequest) {
  const guard = await requireStudioAdmin(req);
  if (!guard.ok) return guard.response;

  try {
    const body = await req.json();
    const tier = body?.tier as NarratorTier;
    if (!tier || !NARRATOR_TIERS.includes(tier)) {
      return NextResponse.json(
        { success: false, error: `Unknown tier "${tier}".` },
        { status: 400 }
      );
    }

    const configs = await getNarratorTierConfigs();
    const config = configs[tier];
    if (!isProviderConfigured(config.provider)) {
      return NextResponse.json(
        {
          success: false,
          error: `No API key configured for provider "${config.provider}" on this deployment.`,
        },
        { status: 400 }
      );
    }

    const startedAt = Date.now();
    const result = await probeTierProvider(config);
    return NextResponse.json({
      success: true,
      data: {
        tier,
        provider: config.provider,
        model: config.model,
        latencyMs: Date.now() - startedAt,
        ...result,
      },
    });
  } catch (error: any) {
    console.error('Narrator model probe failed:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Probe failed.' },
      { status: 500 }
    );
  }
}

/**
 * Minimal liveness call against the tier's provider. Returns the model that
 * answered plus any provider error text.
 */
async function probeTierProvider(
  config: NarratorTierConfig
): Promise<{ ok: boolean; modelUsed?: string; error?: string }> {
  const apiKeyEnv: Record<string, string> = {
    gemini: 'GEMINI_API_KEY',
    aiprime: 'AIPRIME_API_KEY',
    sinox: 'SINOX_API_KEY',
  };
  const apiKey = process.env[apiKeyEnv[config.provider] ?? ''];
  if (!apiKey) return { ok: false, error: 'Provider API key is not configured.' };

  if (config.provider === 'gemini') {
    const { getGeminiEndpoint } = await import('@/lib/ai/geminiClient');
    const { isThinkingSupported } = await import('@/lib/ai/modelCapabilities');
    const endpoint = getGeminiEndpoint(config.model);
    const thinkingBudget =
      config.thinkingBudgetTokens &&
      config.thinkingBudgetTokens > 0 &&
      isThinkingSupported(config.model)
        ? config.thinkingBudgetTokens
        : 0;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'ping' }] }],
        generationConfig: {
          responseMimeType: 'text/plain',
          maxOutputTokens: 64,
          temperature: 0,
          ...(thinkingBudget > 0 ? { thinkingConfig: { thinkingBudget } } : {}),
        },
      }),
      signal: AbortSignal.timeout(30000),
    } as any);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true, modelUsed: config.model };
  }

  const endpoint = config.endpoint ?? '';
  if (!endpoint) return { ok: false, error: 'No endpoint configured for this provider.' };
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 8,
      temperature: 0,
    }),
    signal: AbortSignal.timeout(20000),
  } as any);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
  }
  const json = (await res.json()) as any;
  return { ok: true, modelUsed: json?.model || config.model };
}
