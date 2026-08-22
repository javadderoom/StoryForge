/**
 * Gemini AI Client & Multi-Model Failover Manager
 * Supports Cloudflare Worker proxy via GEMINI_PROXY_URL and automated cascading queue across available models.
 */

// Frontier heavy model queue for World Generation (prioritizing Gemini 3.7 Flash)
export const WORLD_GENERATION_QUEUE = [
  'gemini-3.7-flash',
  'gemini-3-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemma-4-31b',
  'gemma-4-26b',
] as const;

// High-capacity fast queue for Scene & Story Turn generation (prioritizing 500 RPD flash-lite)
export const SCENE_GENERATION_QUEUE = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.7-flash',
  'gemini-3-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemma-4-31b',
  'gemma-4-26b',
] as const;

export const MODEL_CASCADE_QUEUE = SCENE_GENERATION_QUEUE;

export type SupportedModel = (typeof WORLD_GENERATION_QUEUE)[number];

export interface GenerateOptions {
  temperature?: number;
  maxOutputTokens?: number;
  preferredModel?: SupportedModel;
  taskType?: 'world' | 'scene' | 'default';
}

export interface GenerationResult<T = any> {
  data: T;
  rawText: string;
  modelUsed: string;
}

/**
 * Builds the appropriate API endpoint URL, injecting the Cloudflare proxy if configured.
 */
export function getGeminiEndpoint(modelName: string): string {
  const apiKey = process.env.GEMINI_API_KEY || '';
  const proxyUrl = process.env.GEMINI_PROXY_URL;

  if (proxyUrl) {
    const cleanProxy = proxyUrl.replace(/\/$/, '');
    return `${cleanProxy}/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  }

  return `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
}

function getBaseQueueForTask(taskType?: 'world' | 'scene' | 'default'): readonly string[] {
  if (taskType === 'world') {
    return WORLD_GENERATION_QUEUE;
  }
  return SCENE_GENERATION_QUEUE;
}

/**
 * Executes a structured JSON prompt across the cascading model queue.
 * Automatically fails over to the next model upon hitting 429 (quota/rate limit) or 503 errors.
 */
export async function generateStructuredJson<T = any>(
  prompt: string,
  systemInstruction?: string,
  options: GenerateOptions = {}
): Promise<GenerationResult<T> | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const baseQueue = getBaseQueueForTask(options.taskType);
  const modelQueue = options.preferredModel
    ? [options.preferredModel, ...baseQueue.filter((m) => m !== options.preferredModel)]
    : baseQueue;

  for (const model of modelQueue) {
    try {
      const endpoint = getGeminiEndpoint(model);

      const requestBody: any = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: options.temperature ?? 0.7,
        },
      };

      if (systemInstruction) {
        requestBody.systemInstruction = {
          parts: [{ text: systemInstruction }],
        };
      }

      if (options.maxOutputTokens) {
        requestBody.generationConfig.maxOutputTokens = options.maxOutputTokens;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      // 429 (Resource Exhausted) or 503 (Overloaded) -> Cascade to next model in queue
      if (res.status === 429 || res.status === 503) {
        console.warn(`[GeminiClient] ${model} throttled (${res.status}). Cascading to next model in queue...`);
        continue;
      }

      if (!res.ok) {
        const errorText = await res.text();
        console.warn(`[GeminiClient] ${model} request failed with ${res.status}: ${errorText}. Trying next...`);
        continue;
      }

      const json = await res.json();
      const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;

      if (rawText) {
        // Strip code block markers if returned by model
        const cleaned = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
        const parsed = JSON.parse(cleaned);
        return {
          data: parsed as T,
          rawText,
          modelUsed: model,
        };
      }
    } catch (err) {
      console.warn(`[GeminiClient] Failover triggered for model ${model}:`, err);
      // Continue to next model in queue
    }
  }

  return null;
}

/**
 * Executes a plain-text prompt across the cascading model queue with proxy support.
 */
export async function generateText(
  prompt: string,
  systemInstruction?: string,
  options: GenerateOptions = {}
): Promise<GenerationResult<string> | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const baseQueue = getBaseQueueForTask(options.taskType);
  const modelQueue = options.preferredModel
    ? [options.preferredModel, ...baseQueue.filter((m) => m !== options.preferredModel)]
    : baseQueue;

  for (const model of modelQueue) {
    try {
      const endpoint = getGeminiEndpoint(model);

      const requestBody: any = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: options.temperature ?? 0.7,
        },
      };

      if (systemInstruction) {
        requestBody.systemInstruction = {
          parts: [{ text: systemInstruction }],
        };
      }

      if (options.maxOutputTokens) {
        requestBody.generationConfig.maxOutputTokens = options.maxOutputTokens;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (res.status === 429 || res.status === 503) {
        console.warn(`[GeminiClient] ${model} throttled (${res.status}). Cascading...`);
        continue;
      }

      if (!res.ok) {
        continue;
      }

      const json = await res.json();
      const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;

      if (rawText) {
        return {
          data: rawText,
          rawText,
          modelUsed: model,
        };
      }
    } catch (err) {
      console.warn(`[GeminiClient] Failover triggered for model ${model}:`, err);
    }
  }

  return null;
}
