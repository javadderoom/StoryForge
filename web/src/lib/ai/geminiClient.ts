/**
 * Gemini AI Client & Multi-Model Failover Manager
 * Supports Cloudflare Worker proxy via GEMINI_PROXY_URL and automated cascading queue across available models.
 */

// Frontier heavy model queue for World Generation (prioritizing 3.7/3.6 Flash, 3.5/3.1 Flash-Lite, 2.5 Flash/Lite, and Gemma-4-IT)
export const WORLD_GENERATION_QUEUE = [
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemma-4-31b-it',
  'gemma-4-26b-a4b-it',
] as const;

// High-capacity fast queue for Scene & Story Turn generation (prioritizing 500 RPD Flash-Lite models)
export const SCENE_GENERATION_QUEUE = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemma-4-31b-it',
  'gemma-4-26b-a4b-it',
] as const;




export const MODEL_CASCADE_QUEUE = SCENE_GENERATION_QUEUE;

export type SupportedModel = (typeof WORLD_GENERATION_QUEUE)[number];


export interface GenerateOptions {
  temperature?: number;
  maxOutputTokens?: number;
  preferredModel?: SupportedModel;
  taskType?: 'world' | 'scene' | 'default';
  timeoutMs?: number;
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
  const envModel = process.env.GEMINI_MODEL?.trim();
  const queue = taskType === 'world' ? WORLD_GENERATION_QUEUE : SCENE_GENERATION_QUEUE;
  if (envModel) {
    return [envModel, ...queue.filter((m) => m !== envModel)];
  }
  return queue;
}


function extractCandidateText(json: any): string | null {
  const parts: any[] = json?.candidates?.[0]?.content?.parts || [];
  if (!parts.length) return null;
  // Find non-thought content part, or fallback to the last part
  const textPart = parts.find((p) => !p.thought && typeof p.text === 'string' && p.text.trim().length > 0) || parts[parts.length - 1];
  return textPart?.text || null;
}

/**
 * Executes a structured JSON prompt across the cascading model queue.
 * If a model returns an error (rate-limit, quota, or network), it immediately cascades to the next model.
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

  const timeoutMs = options.timeoutMs ?? (options.taskType === 'world' ? 45000 : 25000);

  for (const model of modelQueue) {
    console.log(`[GeminiClient] Attempting model: ${model} (${options.taskType || 'default'}, timeout: ${timeoutMs}ms)...`);

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

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        console.warn(`[GeminiClient] ${model} failed (${res.status}): ${errorText}. Immediately trying next model in queue...`);
        continue;
      }

      const json = await res.json();
      const rawText = extractCandidateText(json);

      if (rawText) {
        // Strip any markdown fences if present
        const cleaned = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
        const parsed = JSON.parse(cleaned);
        console.log(`[GeminiClient] Successfully generated response using model: ${model}`);
        return {
          data: parsed as T,
          rawText,
          modelUsed: model,
        };
      }
    } catch (err) {
      console.warn(`[GeminiClient] ${model} timed out or threw error. Immediately trying next model:`, err);
      // Cascade to next model in queue immediately
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

  const timeoutMs = options.timeoutMs ?? 30000;

  for (const model of modelQueue) {
    console.log(`[GeminiClient] Attempting chat with model: ${model}...`);

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

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        console.warn(`[GeminiClient] ${model} chat failed (${res.status}): ${errorText}. Trying next model...`);
        continue;
      }

      const json = await res.json();
      const rawText = extractCandidateText(json);

      if (rawText) {
        console.log(`[GeminiClient] Chat response succeeded using model: ${model}`);
        return {
          data: rawText,
          rawText,
          modelUsed: model,
        };
      }
    } catch (err) {
      console.warn(`[GeminiClient] ${model} chat timed out or threw error. Trying next model:`, err);
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

  const timeoutMs = options.timeoutMs ?? 30000;

  for (const model of modelQueue) {
    console.log(`[GeminiClient] Attempting text with model: ${model}...`);

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

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        console.warn(`[GeminiClient] ${model} text failed (${res.status}): ${errorText}. Trying next model...`);
        continue;
      }

      const json = await res.json();
      const rawText = extractCandidateText(json);

      if (rawText) {
        console.log(`[GeminiClient] Text generation succeeded using model: ${model}`);
        return {
          data: rawText,
          rawText,
          modelUsed: model,
        };
      }
    } catch (err) {
      console.warn(`[GeminiClient] ${model} text timed out or threw error. Trying next model:`, err);
    }
  }

  return null;
}




