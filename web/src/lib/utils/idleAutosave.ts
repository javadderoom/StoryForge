/**
 * Idle autosave — batch author edits and persist them once the author pauses.
 *
 * The Studio used to fire a full-manifest network request for EVERY change:
 * typing one character in the inspector, nudging one pin on the map, or
 * toggling one layer each produced a request carrying the whole story
 * manifest. That is a request storm (and a race) for no benefit — the author
 * only ever wants their work safely on the server.
 *
 * The rule this module implements:
 *
 *   **Save when there have been no changes for N milliseconds.**
 *
 * Every new change resets the idle timer; when the author pauses, the latest
 * value is saved once. Two safety valves:
 *
 *  - `maxWaitMs`: a continuous editing session still persists — after this
 *    long the pending value is saved even if changes keep arriving, so work is
 *    never stranded in memory.
 *  - saves never overlap: a change that lands while a save is in flight is
 *    queued and saved by the next idle window.
 *
 * The controller is framework-free and takes injectable timers so the
 * behaviour is unit-testable without a browser or real time.
 */

export interface IdleAutosaveOptions<T> {
  /** Save after this much inactivity. */
  idleMs: number;
  /** Never wait longer than this while changes keep arriving. */
  maxWaitMs: number;
  /** Performs the actual save. Rejections are surfaced through `onError`. */
  save: (value: T) => Promise<void> | void;
  /** Called when a save fails. The caller decides how to surface it. */
  onError?: (error: unknown) => void;
  /** Injectable clock (tests). */
  now?: () => number;
  /** Injectable timer (tests). */
  setTimeoutFn?: (fn: () => void, ms: number) => unknown;
  /** Injectable timer clear (tests). */
  clearTimeoutFn?: (handle: unknown) => void;
}

export interface IdleAutosaveController<T> {
  /** Records a new value and restarts the idle timer. */
  schedule: (value: T) => void;
  /** Saves the pending value immediately (explicit Save / leaving the page). */
  flush: () => Promise<void>;
  /** Drops a pending save without saving it. */
  cancel: () => void;
  /** True when a value is waiting to be saved. */
  isPending: () => boolean;
  /** True while a save is in flight. */
  isSaving: () => boolean;
}

export function createIdleAutosave<T>(options: IdleAutosaveOptions<T>): IdleAutosaveController<T> {
  const now = options.now ?? (() => Date.now());
  const setT = options.setTimeoutFn ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearT = options.clearTimeoutFn ?? ((handle: unknown) => clearTimeout(handle as any));

  let pending: { value: T } | null = null;
  let timer: unknown = null;
  /** When the current batch of changes started (for the max-wait cap). */
  let batchStartedAt = 0;
  let saving = false;
  /** A change arrived while a save was in flight. */
  let queued = false;
  /** An explicit flush was requested while a save was in flight. */
  let flushQueued = false;

  function clearTimer(): void {
    if (timer !== null) {
      clearT(timer);
      timer = null;
    }
  }

  function startTimer(): void {
    clearTimer();
    const elapsed = now() - batchStartedAt;
    const remainingMax = Math.max(0, options.maxWaitMs - elapsed);
    const delay = Math.min(options.idleMs, remainingMax);
    timer = setT(() => {
      timer = null;
      void runSave();
    }, delay);
  }

  async function runSave(): Promise<void> {
    if (!pending) return;
    const value = pending.value;
    pending = null;
    batchStartedAt = 0;
    clearTimer();
    saving = true;
    try {
      await options.save(value);
    } catch (err) {
      options.onError?.(err);
    } finally {
      saving = false;
      if (pending) {
        // A change landed during the save: persist it in the next window.
        if (flushQueued) {
          flushQueued = false;
          void runSave();
        } else {
          startTimer();
        }
      }
    }
  }

  return {
    schedule(value: T) {
      pending = { value };
      if (saving) {
        queued = true;
        return;
      }
      if (!batchStartedAt) batchStartedAt = now();
      startTimer();
    },

    async flush() {
      clearTimer();
      if (!pending) {
        // Nothing queued; an in-flight save will pick up late changes itself.
        return;
      }
      if (saving) {
        flushQueued = true;
        return;
      }
      await runSave();
    },

    cancel() {
      clearTimer();
      pending = null;
      batchStartedAt = 0;
    },

    isPending: () => pending !== null,
    isSaving: () => saving,
  };
}

/** Default idle window: the author paused for five seconds. */
export const STUDIO_AUTOSAVE_IDLE_MS = 5_000;

/** Default cap: a continuous session still persists after a minute. */
export const STUDIO_AUTOSAVE_MAX_WAIT_MS = 60_000;
