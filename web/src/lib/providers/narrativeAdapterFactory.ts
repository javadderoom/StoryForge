import { GeminiAdapter } from './GeminiAdapter';
import type { SceneModelCall, RawSceneData, RawSceneResult } from '../engines/narrative/modelCall';
import { defaultSceneModelCall } from '../engines/narrative/modelCall';
import { extractJsonPayload } from '../ai/geminiClient';
import {
  AIPRIME_ENDPOINT,
  DEFAULT_NARRATOR_TIER_CONFIGS,
  SINOX_ENDPOINT,
  getNarratorTierConfig,
  type NarratorTierConfig,
  type NarratorProvider,
} from './narratorModelRegistry';

export type EngineTier = 'normal' | 'plus' | 'advance';

export const ENGINE_TIER_COSTS: Record<EngineTier, number> = {
  normal: 1,
  plus: 2,
  advance: 5,
};

/** Environment variable holding each provider's API key (never persisted). */
const PROVIDER_API_KEY_ENV: Record<NarratorProvider, string> = {
  gemini: 'GEMINI_API_KEY',
  aiprime: 'AIPRIME_API_KEY',
  sinox: 'SINOX_API_KEY',
};

/** True when the provider's API key is configured in this deployment. */
export function isProviderConfigured(provider: NarratorProvider): boolean {
  const key = process.env[PROVIDER_API_KEY_ENV[provider]];
  return Boolean(key && key.trim().length > 0);
}

/**
 * Creates a SceneModelCall seam routing narrative generation to an
 * OpenAI-compatible provider (AI Prime for the 2x Plus tier by default).
 *
 * The model, its fallback and the endpoint all come from the narrator model
 * registry, so an operator can repoint the tier from the Studio. When the
 * provider's API key is missing the seam falls back to the default cascading
 * queue — the reader always gets a scene.
 */
export function createOpenAiCompatibleModelCall(
  provider: NarratorProvider,
  config: NarratorTierConfig
): SceneModelCall {
  return async (prompt, options = {}): Promise<RawSceneResult | null> => {
    const apiKey = process.env[PROVIDER_API_KEY_ENV[provider]];
    if (!apiKey) {
      console.warn(
        `[narrativeAdapterFactory] ${PROVIDER_API_KEY_ENV[provider]} is not set. Falling back to default cascading queue.`
      );
      return defaultSceneModelCall(prompt, options);
    }

    const endpoint = config.endpoint || (provider === 'sinox' ? SINOX_ENDPOINT : AIPRIME_ENDPOINT);
    const t0 = Date.now();
    const messages = [
      { role: 'system', content: prompt.systemPrompt },
      { role: 'user', content: prompt.userPrompt },
    ];

    const modelsToTry = [config.model, config.fallbackModel].filter(
      (m): m is string => Boolean(m && m.trim().length > 0)
    );

    for (const model of modelsToTry) {
      const payload: Record<string, unknown> = {
        model,
        messages,
        temperature: options.temperature ?? config.temperature ?? 0.75,
        response_format: { type: 'json_object' },
      };
      if (config.reasoningEffort) payload.reasoning_effort = config.reasoningEffort;
      if (typeof config.thinkingBudgetTokens === 'number' && config.thinkingBudgetTokens > 0) {
        payload.thinking = { type: 'enabled', budget_tokens: config.thinkingBudgetTokens };
      }

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(payload),
        });

        const durationMs = Date.now() - t0;
        if (!res.ok) {
          const errorText = await res.text().catch(() => '');
          console.warn(
            `[narrativeAdapterFactory] ${provider} ${model} HTTP ${res.status} in ${durationMs}ms: ${errorText}. Trying next route...`
          );
          continue;
        }

        const json = (await res.json()) as any;
        const rawText = json?.choices?.[0]?.message?.content || '';
        if (!rawText) {
          console.warn(`[narrativeAdapterFactory] ${provider} ${model} returned empty content.`);
          continue;
        }

        const cleaned = extractJsonPayload(rawText);
        const parsed = JSON.parse(cleaned) as RawSceneData;
        return {
          data: parsed,
          rawText,
          modelUsed: `${provider}/${model}`,
        };
      } catch (err) {
        console.warn(`[narrativeAdapterFactory] ${provider} ${model} request error:`, err);
      }
    }

    console.warn(
      `[narrativeAdapterFactory] ${provider} models exhausted. Falling back to default queue...`
    );
    return defaultSceneModelCall(prompt, options);
  };
}

/**
 * Creates the AI Prime seam for the 2x Plus tier.
 * Kept as a named export for callers that want the provider explicitly.
 */
export function createAiPrimePlusModelCall(config?: NarratorTierConfig): SceneModelCall {
  return createOpenAiCompatibleModelCall(
    'aiprime',
    config ?? DEFAULT_NARRATOR_TIER_CONFIGS.plus
  );
}

/**
 * Creates the Sinox seam for the 5x Advance tier (reasoning-budget tuned).
 */
export function createSinoxAdvanceModelCall(config?: NarratorTierConfig): SceneModelCall {
  return createOpenAiCompatibleModelCall(
    'sinox',
    config ?? DEFAULT_NARRATOR_TIER_CONFIGS.advance
  );
}

/**
 * Returns a configured GeminiAdapter for the requested engine tier.
 * - 'normal': Standard 1x cost (1 credit), Gemini cascading queue.
 * - 'plus': 2x cost (2 credits), AI Prime.
 * - 'advance': 5x cost (5 credits), Sinox with a calibrated reasoning budget.
 *
 * The provider/model per tier comes from the narrator model registry (Studio
 * managed), falling back to the code defaults. When the tier routes to a
 * provider with no API key configured, the adapter falls back to the default
 * Gemini cascade so a reader turn is never lost to a missing key.
 */
export async function getNarrativeAdapter(tier?: EngineTier): Promise<GeminiAdapter> {
  const config = await getNarratorTierConfig(tier as EngineTier | undefined);

  if (config.provider === 'aiprime') {
    return new GeminiAdapter(undefined, config.model, {
      modelCall: createOpenAiCompatibleModelCall('aiprime', config),
    });
  }
  if (config.provider === 'sinox') {
    return new GeminiAdapter(undefined, config.model, {
      modelCall: createOpenAiCompatibleModelCall('sinox', config),
    });
  }
  // Gemini (direct): the configured model is preferred inside the cascading
  // queue (so a rate-limited model still cascades to the next one), and the
  // tier's thinking budget is passed as Gemini's native thinkingConfig.
  return new GeminiAdapter(undefined, config.model, {
    preferredModel: config.model,
    thinkingBudgetTokens: config.thinkingBudgetTokens,
  });
}
