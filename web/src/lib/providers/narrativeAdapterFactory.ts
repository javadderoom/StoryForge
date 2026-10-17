import { GeminiAdapter } from './GeminiAdapter';
import type { SceneModelCall, RawSceneData, RawSceneResult } from '../engines/narrative/modelCall';
import { defaultSceneModelCall } from '../engines/narrative/modelCall';
import { extractJsonPayload } from '../ai/geminiClient';

export type EngineTier = 'normal' | 'advance';

export const ENGINE_TIER_COSTS: Record<EngineTier, number> = {
  normal: 1,
  advance: 5,
};

const SINOX_ENDPOINT = 'https://sinoxapi.com/v1/chat/completions';
const SINOX_ADVANCE_MODEL = 't-gemini-4-argon';

/**
 * Creates a SceneModelCall seam routing narrative generation to Sinox t-gemini-4-argon
 * with lowered reasoning effort / thinking budget for speed.
 * Falls back to defaultSceneModelCall if Sinox API key is missing or fails.
 */
export function createSinoxAdvanceModelCall(): SceneModelCall {
  return async (prompt, options = {}): Promise<RawSceneResult | null> => {
    const apiKey = process.env.SINOX_API_KEY;
    if (!apiKey) {
      console.warn('[narrativeAdapterFactory] SINOX_API_KEY is not set. Falling back to default cascading queue.');
      return defaultSceneModelCall(prompt, options);
    }

    const t0 = Date.now();
    const messages = [
      { role: 'system', content: prompt.systemPrompt },
      { role: 'user', content: prompt.userPrompt },
    ];

    const payload = {
      model: SINOX_ADVANCE_MODEL,
      messages,
      temperature: options.temperature ?? 0.75,
      response_format: { type: 'json_object' },
      reasoning_effort: 'low',
      thinking: { type: 'enabled', budget_tokens: 512 },
    };

    try {
      const res = await fetch(SINOX_ENDPOINT, {
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
          `[narrativeAdapterFactory] Sinox Advance API HTTP ${res.status} in ${durationMs}ms: ${errorText}. Falling back to default queue...`
        );
        return defaultSceneModelCall(prompt, options);
      }

      const json = (await res.json()) as any;
      const rawText = json?.choices?.[0]?.message?.content || '';
      if (!rawText) {
        console.warn('[narrativeAdapterFactory] Sinox returned empty content. Falling back to default queue...');
        return defaultSceneModelCall(prompt, options);
      }

      const cleaned = extractJsonPayload(rawText);
      const parsed = JSON.parse(cleaned) as RawSceneData;
      return {
        data: parsed,
        rawText,
        modelUsed: `sinox/${SINOX_ADVANCE_MODEL}`,
      };
    } catch (err) {
      console.warn('[narrativeAdapterFactory] Sinox Advance generation error, falling back to default queue:', err);
      return defaultSceneModelCall(prompt, options);
    }
  };
}

/**
 * Returns a configured GeminiAdapter for the requested engine tier.
 * - 'normal': Standard 1x cost, uses gemini-3.5-flash-lite cascading queue.
 * - 'advance': 5x cost, uses t-gemini-4-argon with fast reasoning effort.
 */
export function getNarrativeAdapter(tier?: EngineTier): GeminiAdapter {
  if (tier === 'advance') {
    return new GeminiAdapter(undefined, SINOX_ADVANCE_MODEL, {
      modelCall: createSinoxAdvanceModelCall(),
    });
  }
  return new GeminiAdapter(undefined, 'gemini-3.5-flash-lite');
}
