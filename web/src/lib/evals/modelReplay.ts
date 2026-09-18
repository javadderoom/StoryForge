import { RawSceneData, RawSceneResult, SceneModelCall } from '@/lib/engines/narrative/modelCall';

/**
 * Plan 14 — deterministic record/replay for the model seam.
 *
 * Replay makes the golden scenarios run free and identically in CI, with no API
 * key and no credit spend. Live recording is opt-in (`EVAL_LIVE=1`).
 */

/** Replay a recorded cassette deterministically. */
export function replaySceneModelCall(cassette: RawSceneData, modelUsed = 'cassette'): SceneModelCall {
  return async () => ({
    data: cassette,
    rawText: JSON.stringify(cassette),
    modelUsed,
  });
}

/** A seam that always yields nothing — used to detect a missing cassette. */
export function missingSceneModelCall(): SceneModelCall {
  return async () => null;
}

/** Wrap a live model call so its raw output can be captured into a cassette. */
export function recordSceneModelCall(
  inner: SceneModelCall,
  sink: (result: RawSceneResult) => void
): SceneModelCall {
  return async (prompt, options) => {
    const result = await inner(prompt, options);
    if (result) sink(result);
    return result;
  };
}
