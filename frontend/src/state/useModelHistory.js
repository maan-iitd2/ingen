//  Undo / Redo stack for ConfigModel snapshots.
//  Keeps at most MAX_HISTORY snapshots; newer pushes beyond that silently drop the oldest.

import { useRef, useState, useCallback } from 'react';

const MAX_HISTORY = 50;

/**
 * Returns an undo/redo-aware wrapper for a model update function.
 *
 * Usage:
 *   const { pushHistory, undo, redo, canUndo, canRedo } = useModelHistory(model);
 *   // call pushHistory(model) BEFORE each mutation so the snapshot captures the pre-mutation state.
 *
 * @param {object} initialModel - the initial config model
 */
export function useModelHistory(initialModel) {
  const pastRef    = useRef([]);   // [...older, immediate-pre-mutation]
  const futureRef  = useRef([]);   // [immediate-post-undo, ...newer]
  const [, rerender] = useState(0);

  const pushHistory = useCallback((model) => {
    const past = pastRef.current;
    pastRef.current  = [...past.slice(-(MAX_HISTORY - 1)), model];
    futureRef.current = [];    // new change clears the redo stack
    rerender((n) => n + 1);
  }, []);

  const undo = useCallback((currentModel, setModel) => {
    const past   = pastRef.current;
    const future = futureRef.current;
    if (!past.length) return;
    const prev = past[past.length - 1];
    pastRef.current  = past.slice(0, -1);
    futureRef.current = [currentModel, ...future];
    setModel(prev);
    rerender((n) => n + 1);
  }, []);

  const redo = useCallback((currentModel, setModel) => {
    const future = futureRef.current;
    if (!future.length) return;
    const next = future[0];
    futureRef.current = future.slice(1);
    pastRef.current   = [...pastRef.current, currentModel];
    setModel(next);
    rerender((n) => n + 1);
  }, []);

  return {
    pushHistory,
    undo,
    redo,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
  };
}
