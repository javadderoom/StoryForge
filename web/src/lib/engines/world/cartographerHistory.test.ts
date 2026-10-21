import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CARTOGRAPHER_HISTORY_LIMIT,
  createCartographerHistory,
  mergeCartographerSnapshot,
  peekRedoLabel,
  peekUndoLabel,
  pushCartographerHistory,
  redoCartographerHistory,
  undoCartographerHistory,
  type CartographerSnapshot,
} from './cartographerHistory';

function snap(tag: string): CartographerSnapshot {
  return {
    locations: [{ id: `loc_${tag}`, name: tag }] as CartographerSnapshot['locations'],
    tradeRoutes: [],
    npcStations: [],
    mapData: undefined,
  };
}

describe('cartographer undo/redo history', () => {
  it('starts empty and reports nothing to undo or redo', () => {
    const h = createCartographerHistory();
    assert.equal(h.past.length, 0);
    assert.equal(h.future.length, 0);
    assert.equal(peekUndoLabel(h), null);
    assert.equal(peekRedoLabel(h), null);
    assert.equal(undoCartographerHistory(h, snap('now')), null);
    assert.equal(redoCartographerHistory(h), null);
  });

  it('undo restores the state from before the action', () => {
    const pre = snap('pre');
    let h = createCartographerHistory();
    h = pushCartographerHistory(h, 'Add terrain', pre);
    const result = undoCartographerHistory(h, snap('after'));
    assert.ok(result);
    assert.equal(result.label, 'Add terrain');
    assert.deepEqual(result.restored, pre);
    assert.equal(result.history.past.length, 0);
    assert.equal(result.history.future.length, 1);
  });

  it('redo puts the undone action back', () => {
    const pre = snap('pre');
    const after = snap('after');
    let h = pushCartographerHistory(createCartographerHistory(), 'Add terrain', pre);
    h = undoCartographerHistory(h, after)!.history;
    const redo = redoCartographerHistory(h);
    assert.ok(redo);
    assert.equal(redo.label, 'Add terrain');
    assert.deepEqual(redo.restored, after);
    assert.equal(redo.history.future.length, 0);
    assert.equal(redo.history.past.length, 1);
  });

  it('undo/redo cycles back to the exact same state', () => {
    const s0 = snap('s0');
    const s1 = snap('s1');
    const s2 = snap('s2');
    let h = createCartographerHistory();
    h = pushCartographerHistory(h, 'A', s0);
    h = pushCartographerHistory(h, 'B', s1);

    const undo1 = undoCartographerHistory(h, s2)!;
    assert.deepEqual(undo1.restored, s1);
    const undo2 = undoCartographerHistory(undo1.history, s1)!;
    assert.deepEqual(undo2.restored, s0);

    const redo1 = redoCartographerHistory(undo2.history)!;
    assert.deepEqual(redo1.restored, s1);
    const redo2 = redoCartographerHistory(redo1.history)!;
    assert.deepEqual(redo2.restored, s2);
    assert.equal(redo2.history.future.length, 0);
  });

  it('a new action clears the redo stack', () => {
    const s0 = snap('s0');
    const s1 = snap('s1');
    let h = pushCartographerHistory(createCartographerHistory(), 'A', s0);
    h = undoCartographerHistory(h, s1)!.history;
    assert.equal(h.future.length, 1);
    h = pushCartographerHistory(h, 'C', s1);
    assert.equal(h.future.length, 0, 'the undone action can no longer be redone');
    assert.equal(peekRedoLabel(h), null);
  });

  it('bounds the stack so a long session cannot grow without limit', () => {
    let h = createCartographerHistory();
    for (let i = 0; i < CARTOGRAPHER_HISTORY_LIMIT + 25; i += 1) {
      h = pushCartographerHistory(h, `Action ${i}`, snap(`s${i}`));
    }
    assert.equal(h.past.length, CARTOGRAPHER_HISTORY_LIMIT);
    assert.equal(peekUndoLabel(h), `Action ${CARTOGRAPHER_HISTORY_LIMIT + 24}`);
  });

  it('exposes the labels of the next undo/redo for the UI', () => {
    let h = pushCartographerHistory(createCartographerHistory(), 'Move pin', snap('a'));
    assert.equal(peekUndoLabel(h), 'Move pin');
    assert.equal(peekRedoLabel(h), null);
    h = undoCartographerHistory(h, snap('b'))!.history;
    assert.equal(peekUndoLabel(h), null);
    assert.equal(peekRedoLabel(h), 'Move pin');
  });

  describe('coalescing a burst of the same action', () => {
    it('folds rapid same-label edits into one entry', () => {
      let h = createCartographerHistory();
      h = pushCartographerHistory(h, 'Edit location', snap('s0'), {
        coalesceMs: 800,
        now: 1000,
      });
      h = pushCartographerHistory(h, 'Edit location', snap('s1'), {
        coalesceMs: 800,
        now: 1200,
      });
      h = pushCartographerHistory(h, 'Edit location', snap('s2'), {
        coalesceMs: 800,
        now: 1400,
      });
      assert.equal(h.past.length, 1, 'a typing burst is one undoable action');
      // The earliest pre-state is kept, so one undo reverts the whole burst.
      assert.deepEqual(h.past[0].before, snap('s0'));
    });

    it('starts a new entry once the burst window has passed', () => {
      let h = createCartographerHistory();
      h = pushCartographerHistory(h, 'Edit location', snap('s0'), {
        coalesceMs: 800,
        now: 1000,
      });
      h = pushCartographerHistory(h, 'Edit location', snap('s1'), {
        coalesceMs: 800,
        now: 2000,
      });
      assert.equal(h.past.length, 2);
    });

    it('never coalesces different actions', () => {
      let h = createCartographerHistory();
      h = pushCartographerHistory(h, 'Edit location', snap('s0'), {
        coalesceMs: 800,
        now: 1000,
      });
      h = pushCartographerHistory(h, 'Move pin', snap('s1'), {
        coalesceMs: 800,
        now: 1100,
      });
      assert.equal(h.past.length, 2);
    });

    it('does not coalesce into an entry that has an undone action pending', () => {
      let h = createCartographerHistory();
      h = pushCartographerHistory(h, 'Edit location', snap('s0'), {
        coalesceMs: 800,
        now: 1000,
      });
      h = undoCartographerHistory(h, snap('s1'))!.history;
      h = pushCartographerHistory(h, 'Edit location', snap('s2'), {
        coalesceMs: 800,
        now: 1100,
      });
      assert.equal(h.past.length, 1, 'the new action gets its own entry');
      assert.deepEqual(h.past[0].before, snap('s2'));
    });
  });

  describe('merging a snapshot back into the world', () => {
    const live = {
      id: 'loc_a',
      name: 'Live Name',
      coordinates: { x: 10, y: 10 },
      threatClockDefault: { name: 'Water', maxSegments: 5 },
      specialRules: ['a rule'],
    } as unknown as CartographerSnapshot['locations'][number];

    it('restores the map-owned fields only', () => {
      const before = {
        locations: [
          {
            id: 'loc_a',
            name: 'Original Name',
            coordinates: { x: 100, y: 200 },
          } as unknown as CartographerSnapshot['locations'][number],
        ],
        tradeRoutes: [],
        npcStations: [],
        mapData: undefined,
      };

      const merged = mergeCartographerSnapshot(
        { locations: [live], tradeRoutes: [], npcStations: [], mapData: undefined },
        before
      );

      assert.equal(merged.locations[0].name, 'Original Name');
      assert.deepEqual(merged.locations[0].coordinates, { x: 100, y: 200 });
      // A lore field the map never owned survives the undo.
      assert.deepEqual(
        (merged.locations[0] as any).threatClockDefault,
        { name: 'Water', maxSegments: 5 }
      );
      assert.deepEqual((merged.locations[0] as any).specialRules, ['a rule']);
    });

    it('brings back an entity the Cartographer deleted', () => {
      const merged = mergeCartographerSnapshot(
        { locations: [], tradeRoutes: [], npcStations: [], mapData: undefined },
        {
          locations: [live],
          tradeRoutes: [],
          npcStations: [],
          mapData: undefined,
        }
      );
      assert.equal(merged.locations.length, 1);
      assert.equal(merged.locations[0].id, 'loc_a');
    });

    it('drops an entity the Cartographer added', () => {
      const merged = mergeCartographerSnapshot(
        {
          locations: [live],
          tradeRoutes: [],
          npcStations: [],
          mapData: undefined,
        },
        { locations: [], tradeRoutes: [], npcStations: [], mapData: undefined }
      );
      assert.equal(merged.locations.length, 0);
    });
  });
});
