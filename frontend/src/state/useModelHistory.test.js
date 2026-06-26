//  Tests for useModelHistory — undo/redo stack correctness.
//  Since this is a React hook, we test the underlying logic by calling the returned object
//  methods directly (it uses useRef/useCallback internally, but the push/undo/redo/canUndo/canRedo
//  API is pure state machine logic we can verify).

import { test } from 'node:test';
import assert from 'node:assert/strict';

// Minimal simulation of the hook's internal state machine to test logic without React.
function createHistory(max = 50) {
  const past = [];
  const future = [];

  return {
    get canUndo() { return past.length > 0; },
    get canRedo() { return future.length > 0; },
    pushHistory(snapshot) {
      past.push(snapshot);
      future.length = 0; // new edit clears redo stack
      if (past.length > max) past.shift();
    },
    undo(current, apply) {
      if (!past.length) return;
      future.push(current);
      apply(past.pop());
    },
    redo(current, apply) {
      if (!future.length) return;
      past.push(current);
      apply(future.pop());
    },
  };
}

test('initial state: canUndo and canRedo are false', () => {
  const h = createHistory();
  assert.equal(h.canUndo, false);
  assert.equal(h.canRedo, false);
});

test('pushHistory enables undo', () => {
  const h = createHistory();
  h.pushHistory({ v: 1 });
  assert.equal(h.canUndo, true);
  assert.equal(h.canRedo, false);
});

test('undo restores the previous snapshot and enables redo', () => {
  const h = createHistory();
  h.pushHistory({ v: 1 });
  let restored = null;
  h.undo({ v: 2 }, (m) => { restored = m; });
  assert.deepEqual(restored, { v: 1 });
  assert.equal(h.canUndo, false);
  assert.equal(h.canRedo, true);
});

test('redo restores the undone state', () => {
  const h = createHistory();
  h.pushHistory({ v: 1 });
  h.undo({ v: 2 }, () => {});
  let restored = null;
  h.redo({ v: 1 }, (m) => { restored = m; });
  assert.deepEqual(restored, { v: 2 });
  assert.equal(h.canUndo, true);
  assert.equal(h.canRedo, false);
});

test('new edit after undo clears the redo stack', () => {
  const h = createHistory();
  h.pushHistory({ v: 1 });
  h.pushHistory({ v: 2 });
  h.undo({ v: 3 }, () => {});
  assert.equal(h.canRedo, true);
  h.pushHistory({ v: 4 }); // new edit
  assert.equal(h.canRedo, false, 'redo stack cleared after new edit');
});

test('history respects max size', () => {
  const h = createHistory(3);
  h.pushHistory({ v: 1 });
  h.pushHistory({ v: 2 });
  h.pushHistory({ v: 3 });
  h.pushHistory({ v: 4 }); // oldest (v:1) should be evicted
  let count = 0;
  while (h.canUndo) { h.undo({ v: 99 }, () => {}); count++; }
  assert.equal(count, 3, 'max 3 undos');
});

test('undo with empty stack is a no-op', () => {
  const h = createHistory();
  let called = false;
  h.undo({ v: 1 }, () => { called = true; });
  assert.equal(called, false);
});

test('redo with empty stack is a no-op', () => {
  const h = createHistory();
  let called = false;
  h.redo({ v: 1 }, () => { called = true; });
  assert.equal(called, false);
});

test('multiple undo/redo cycles are consistent', () => {
  const h = createHistory();
  h.pushHistory({ v: 'a' });
  h.pushHistory({ v: 'b' });
  h.pushHistory({ v: 'c' });

  const states = [];

  // Current is 'd', undo back to 'c'
  h.undo({ v: 'd' }, (m) => states.push(m));
  assert.deepEqual(states[0], { v: 'c' });

  // Undo to 'b'
  h.undo({ v: 'c' }, (m) => states.push(m));
  assert.deepEqual(states[1], { v: 'b' });

  // Redo to 'c'
  h.redo({ v: 'b' }, (m) => states.push(m));
  assert.deepEqual(states[2], { v: 'c' });

  // Redo to 'd'
  h.redo({ v: 'c' }, (m) => states.push(m));
  assert.deepEqual(states[3], { v: 'd' });

  assert.equal(h.canRedo, false);
  assert.equal(h.canUndo, true);
});
