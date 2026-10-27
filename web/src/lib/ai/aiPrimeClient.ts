/**
 * aiPrimeClient.ts
 *
 * Client for AI Prime (OpenAI-compatible) endpoint: https://api.aiprime.shop/v1/chat/completions
 * Powers Cartographer in-map entity generation and Studio Oracle/element generation
 * using deepseek-v4.1-flash-1017 with seamless failover to Gemini.
 */

import { generateChat as geminiGenerateChat, generateStructuredJson as geminiGenerateStructuredJson } from './geminiClient';
import type { ChatMessage, GenerateOptions, GenerationResult } from './geminiClient';

export const AIPRIME_ENDPOINT = 'https://api.aiprime.shop/v1/chat/completions';
export const DEFAULT_DEEPSEEK_MODEL = 'deepseek-v4.1-flash-1017';

export function getAiPrimeApiKey(): string | null {
  const key = process.env.AIPRIME_API_KEY;
  if (!key || key.trim().length === 0) return null;
  return key.trim();
}

/**
 * Extracts a JSON object from model response text (handling code fences if needed).
 */
export function extractJsonObject<T = unknown>(text: string): T {
  const trimmed = text.trim();
  // Strip ```json ... ``` code fence if present
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const clean = fenceMatch ? fenceMatch[1].trim() : trimmed;

  try {
    return JSON.parse(clean) as T;
  } catch (err) {
    // Attempt relaxed extraction finding outermost braces { ... }
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const sub = clean.slice(firstBrace, lastBrace + 1);
      return JSON.parse(sub) as T;
    }
    throw new Error(`Failed to parse JSON response from DeepSeek model: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Executes a multi-turn chat using deepseek-v4.1-flash-1017 on AI Prime.
 * Falls back to Gemini if AIPRIME_API_KEY is not configured or if the request fails.
 */
export async function generateDeepSeekChat(
  messages: ChatMessage[],
  systemInstruction?: string,
  options: GenerateOptions = {}
): Promise<GenerationResult<string> | null> {
  const apiKey = getAiPrimeApiKey();
  if (!apiKey) {
    console.warn('[aiPrimeClient] AIPRIME_API_KEY not configured. Falling back to Gemini.');
    return geminiGenerateChat(messages, systemInstruction, options);
  }

  const payloadMessages = [
    ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const model = DEFAULT_DEEPSEEK_MODEL;
  const timeoutMs = options.timeoutMs ?? 45000;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(AIPRIME_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: payloadMessages,
        temperature: options.temperature ?? 0.8,
        // High max_tokens budget so deepseek reasoning_content doesn't truncate output
        max_tokens: options.maxOutputTokens ?? 3500,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(`[aiPrimeClient] DeepSeek chat HTTP ${res.status}: ${errText}. Falling back to Gemini.`);
      return geminiGenerateChat(messages, systemInstruction, options);
    }

    const json = await res.json();
    const reply = json.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      console.warn('[aiPrimeClient] Empty content in DeepSeek response. Falling back to Gemini.');
      return geminiGenerateChat(messages, systemInstruction, options);
    }

    return {
      data: reply,
      rawText: reply,
      modelUsed: `aiprime:${model}`,
    };
  } catch (err) {
    console.warn('[aiPrimeClient] Error calling DeepSeek chat:', err, 'Falling back to Gemini.');
    return geminiGenerateChat(messages, systemInstruction, options);
  }
}

/**
 * Executes a structured JSON generation using deepseek-v4.1-flash-1017 on AI Prime.
 * Falls back to Gemini if AIPRIME_API_KEY is not configured or if parsing fails.
 */
export async function generateDeepSeekStructuredJson<T = any>(
  userPrompt: string,
  systemPrompt?: string,
  options: GenerateOptions = {}
): Promise<GenerationResult<T> | null> {
  const apiKey = getAiPrimeApiKey();
  if (!apiKey) {
    console.warn('[aiPrimeClient] AIPRIME_API_KEY not configured. Falling back to Gemini.');
    return geminiGenerateStructuredJson<T>(userPrompt, systemPrompt, options);
  }

  const sys = (systemPrompt ? `${systemPrompt}\n\n` : '') +
    'CRITICAL: Return ONLY a valid JSON object matching the requested schema. Do NOT enclose in explanatory conversational prose.';

  const payloadMessages = [
    { role: 'system', content: sys },
    { role: 'user', content: userPrompt },
  ];

  const model = DEFAULT_DEEPSEEK_MODEL;
  const timeoutMs = options.timeoutMs ?? 55000;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(AIPRIME_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: payloadMessages,
        temperature: options.temperature ?? 0.7,
        response_format: { type: 'json_object' },
        max_tokens: options.maxOutputTokens ?? 4000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(`[aiPrimeClient] DeepSeek JSON HTTP ${res.status}: ${errText}. Falling back to Gemini.`);
      return geminiGenerateStructuredJson<T>(userPrompt, systemPrompt, options);
    }

    const json = await res.json();
    const rawContent = json.choices?.[0]?.message?.content?.trim();
    if (!rawContent) {
      console.warn('[aiPrimeClient] Empty content in DeepSeek response. Falling back to Gemini.');
      return geminiGenerateStructuredJson<T>(userPrompt, systemPrompt, options);
    }

    const parsed = extractJsonObject<T>(rawContent);
    return {
      data: parsed,
      rawText: rawContent,
      modelUsed: `aiprime:${model}`,
    };
  } catch (err) {
    console.warn('[aiPrimeClient] Error calling DeepSeek structured JSON:', err, 'Falling back to Gemini.');
    return geminiGenerateStructuredJson<T>(userPrompt, systemPrompt, options);
  }
}
