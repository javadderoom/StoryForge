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
