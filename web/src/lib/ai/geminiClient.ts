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
 * Executes an HTTP POST with exponential backoff and jitter for transient network or throttle errors.
 */
async function fetchWithRetry(
  endpoint: string,
  requestBody: unknown,
  maxRetries = 3,
  initialDelayMs = 500
): Promise<Response> {
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      // Transient throttling (429) or backend overload (503)
      if ((res.status === 429 || res.status === 503) && attempt <= maxRetries) {
        const jitter = Math.random() * 200;
        const delay = initialDelayMs * Math.pow(2, attempt - 1) + jitter;
        console.warn(
          `[GeminiClient] Server returned ${res.status} on attempt ${attempt}/${maxRetries}. Retrying in ${Math.round(delay)}ms...`
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      return res;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt <= maxRetries) {
        const jitter = Math.random() * 200;
        const delay = initialDelayMs * Math.pow(2, attempt - 1) + jitter;
        console.warn(
          `[GeminiClient] Network failure on attempt ${attempt}/${maxRetries} (${msg}). Retrying in ${Math.round(delay)}ms...`
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Executes a structured JSON prompt across the cascading model queue with automated retries.
 * Automatically retries transient network errors per model before cascading to the next model in queue.
 */
export async function generateStructuredJson<T = unknown>(
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

      const requestBody: Record<string, unknown> = {
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
        (requestBody.generationConfig as Record<string, unknown>).maxOutputTokens =
          options.maxOutputTokens;
      }

      const res = await fetchWithRetry(endpoint, requestBody, 3, 600);

      if (res.status === 429 || res.status === 503) {
        console.warn(`[GeminiClient] ${model} exhausted retries (${res.status}). Cascading to next model...`);
        continue;
      }

      if (!res.ok) {
        const errorText = await res.text();
        console.warn(`[GeminiClient] ${model} request failed (${res.status}): ${errorText}. Trying next model...`);
        continue;
      }

      const json = await res.json();
      const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;

      if (rawText) {
        // Strip any markdown fences if present
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
      // Cascade to next model in queue
    }
  }

  return null;
}


/**
 * Executes a plain-text prompt across the cascading model queue with proxy support.
 */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Executes a multi-turn plain-text chat across the cascading model queue.
 * Maps the conversation history to Gemini `contents` (user -> user, assistant -> model)
 * while keeping a single system instruction. Used by the studio AI Oracle chat.
 */
export async function generateChat(
  messages: ChatMessage[],
  systemInstruction?: string,
  options: GenerateOptions = {}
): Promise<GenerationResult<string> | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  if (!messages.length) {
    return null;
  }

  const baseQueue = getBaseQueueForTask(options.taskType);
  const modelQueue = options.preferredModel
    ? [options.preferredModel, ...baseQueue.filter((m) => m !== options.preferredModel)]
    : baseQueue;

  for (const model of modelQueue) {
    try {
      const endpoint = getGeminiEndpoint(model);

      const contents = messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      const requestBody: any = {
        contents,
        generationConfig: {
          temperature: options.temperature ?? 0.8,
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

      const res = await fetchWithRetry(endpoint, requestBody, 3, 500);

      if (res.status === 429 || res.status === 503) {
        console.warn(`[GeminiClient] ${model} exhausted retries (${res.status}). Cascading...`);
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

      const requestBody: Record<string, unknown> = {
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
        (requestBody.generationConfig as Record<string, unknown>).maxOutputTokens =
          options.maxOutputTokens;
      }

      const res = await fetchWithRetry(endpoint, requestBody, 3, 500);

      if (res.status === 429 || res.status === 503) {
        console.warn(`[GeminiClient] ${model} exhausted retries (${res.status}). Cascading...`);
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

