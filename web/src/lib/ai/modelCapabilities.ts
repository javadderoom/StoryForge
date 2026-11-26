/**
 * Pure model-capability helpers.
 *
 * Kept in their own module (no node APIs, no server imports) so both the
 * server-side Gemini client and the Studio UI can share one rule set.
 */

/**
 * Determines whether a model supports Gemini's thinking configuration.
 *
 * Lite models (e.g. gemini-3.5-flash-lite, gemini-3.1-flash-lite) and Gemma
 * models do not have thinking capabilities and will fail with HTTP 400 if
 * thinkingConfig is supplied.
 */
export function isThinkingSupported(model: string): boolean {
  const m = (model || '').toLowerCase();
  if (m.includes('lite') || m.startsWith('gemma')) {
    return false;
  }
  return true;
}

/**
 * Gemini 4 family models (`gemini-4-hydrogen`, `gemini-4-argon`, etc.) use
 * `thinkingLevel` (`LOW` | `MEDIUM` | `HIGH` | `XHIGH`) and reject `MINIMAL`
 * with HTTP 400 (and ignore `thinkingBudget: 0`).
 */
export function isGemini4Model(model: string): boolean {
  return /^gemini-4(?:[.-]|$)/i.test((model || '').trim());
}

export interface GeminiThinkingConfig {
  thinkingBudget?: number;
  thinkingLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
}

/**
 * Maps StoryForge's numeric tier thinking budget onto the active Gemini
 * model's native `thinkingConfig` shape.
 */
export function buildGeminiThinkingConfig(
  model: string,
  thinkingBudgetTokens?: number
): GeminiThinkingConfig | undefined {
  if (!isThinkingSupported(model)) {
    return undefined;
  }
  if (isGemini4Model(model)) {
    const budget = typeof thinkingBudgetTokens === 'number' ? thinkingBudgetTokens : 0;
    if (budget > 4096) return { thinkingLevel: 'HIGH' };
    if (budget > 1024) return { thinkingLevel: 'MEDIUM' };
    return { thinkingLevel: 'LOW' };
  }
  return {
    thinkingBudget:
      typeof thinkingBudgetTokens === 'number' && thinkingBudgetTokens > 0
        ? thinkingBudgetTokens
        : 0,
  };
}
