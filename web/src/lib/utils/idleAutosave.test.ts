import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createIdleAutosave } from './idleAutosave';

/** A controllable clock + timer queue so the idle window can be tested. */
function createHarness() {
  let clock = 0;
  let seq = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const saves: string[] = [];
  const errors: unknown[] = [];

  const controller = createIdleAutosave<string>({
    idleMs: 5000,
    maxWaitMs: 60000,
    save: async (value) => {
      saves.push(value);
    },
    onError: (err) => {
      errors.push(err);
    },
    now: () => clock,
    setTimeoutFn: (fn, ms) => {
      seq += 1;
      timers.set(seq, { at: clock + ms, fn });
      return seq;
    },
    clearTimeoutFn: (handle) => {
      timers.delete(handle as number);
    },
  });

  /** Advances the clock and fires every timer that comes due. */
  async function advance(ms: number) {
    clock += ms;
    const due = [...timers.entries()]
      .filter(([, t]) => t.at <= clock)
      .sort((a, b) => a[1].at - b[1].at);
    for (const [id, timer] of due) {
      timers.delete(id);
      timer.fn();
      // Let the async save settle.
      await Promise.resolve();
      await Promise.resolve();
    }
  }

  return { controller, saves, errors, advance, clock: () => clock };
}

describe('idle autosave', () => {
  it('does not save while changes keep arriving', async () => {
    const h = createHarness();
    h.controller.schedule('a');
    await h.advance(2000);
    h.controller.schedule('b');
    await h.advance(2000);
    h.controller.schedule('c');
    assert.deepEqual(h.saves, [], 'no save before the idle window elapses');
  });

  it('saves once the author pauses, with the latest value', async () => {
    const h = createHarness();
    h.controller.schedule('a');
    await h.advance(2000);
    h.controller.schedule('b');
    await h.advance(5000);
    assert.deepEqual(h.saves, ['b'], 'one save, carrying the newest value');
  });

  it('saves nothing when no change was ever scheduled', async () => {
    const h = createHarness();
    await h.advance(120000);
    assert.deepEqual(h.saves, []);
    assert.equal(h.controller.isPending(), false);
  });

  it('persists a continuous editing session once the max wait is reached', async () => {
    const h = createHarness();
    // Keep a change arriving every 4s — the idle window never elapses.
    for (let i = 0; i < 16; i += 1) {
      h.controller.schedule(`edit-${i}`);
      await h.advance(4000);
    }
    assert.ok(h.saves.length >= 1, 'the max-wait cap forced a save');
  });

  it('flushes immediately when asked', async () => {
    const h = createHarness();
    h.controller.schedule('a');
    await h.controller.flush();
    assert.deepEqual(h.saves, ['a']);
    assert.equal(h.controller.isPending(), false);
  });

  it('cancel drops the pending save', async () => {
    const h = createHarness();
    h.controller.schedule('a');
    h.controller.cancel();
    await h.advance(10000);
    assert.deepEqual(h.saves, []);
  });

  it('reports a failed save without throwing', async () => {
    let clock = 0;
    const errors: unknown[] = [];
    const controller = createIdleAutosave<string>({
      idleMs: 10,
      maxWaitMs: 100,
      save: async () => {
        throw new Error('network down');
      },
      onError: (err) => errors.push(err),
      now: () => clock,
      setTimeoutFn: (fn, ms) => setTimeout(fn, ms),
      clearTimeoutFn: (handle) => clearTimeout(handle as any),
    });
    controller.schedule('a');
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.equal(errors.length, 1);
    assert.ok(errors[0] instanceof Error);
  });

  it('queues a change that lands during an in-flight save', async () => {
    const saves: string[] = [];
    const gate: { release: () => void } = { release: () => {} };
    const controller = createIdleAutosave<string>({
      idleMs: 5,
      maxWaitMs: 1000,
      save: async (value) => {
        saves.push(value);
        if (value === 'first') {
          await new Promise<void>((resolve) => {
            gate.release = resolve;
          });
        }
      },
      now: () => Date.now(),
      setTimeoutFn: (fn, ms) => setTimeout(fn, ms),
      clearTimeoutFn: (handle) => clearTimeout(handle as any),
    });

    controller.schedule('first');
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(controller.isSaving(), true);

    // A change lands while the first save is still in flight.
    controller.schedule('second');
    gate.release();
    await new Promise((resolve) => setTimeout(resolve, 30));

    assert.deepEqual(saves, ['first', 'second'], 'the late change is saved by the next window');
  });
});
