'use client';

/**
 * CartographerSelectionBar
 *
 * Plan 23 — the multi-selection action bar.
 *
 * A single selected object keeps the full Inspector. Two or more would not fit
 * there (and most Inspector fields are per-object), so the selection gets a
 * compact floating bar with the actions that make sense for a group: duplicate,
 * delete and deselect. Both group actions are one undoable step.
 */

import React from 'react';
import { Copy, Trash2, X } from 'lucide-react';

interface CartographerSelectionBarProps {
  count: number;
  onDuplicate: () => void;
  onDelete: () => void;
  onClear: () => void;
  isPersian: boolean;
}

export function CartographerSelectionBar({
  count,
  onDuplicate,
  onDelete,
  onClear,
  isPersian,
}: CartographerSelectionBarProps) {
  return (
    <div
      role="toolbar"
      aria-label={isPersian ? 'عملیات انتخاب' : 'Selection actions'}
      className="absolute bottom-20 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-stone-700/80 bg-stone-950/92 px-2 py-1.5 shadow-2xl backdrop-blur-md"
    >
      <span className="px-2 text-xs font-medium text-amber-100/90">
        {isPersian ? `${count} شیء انتخاب شده` : `${count} objects selected`}
      </span>

      <div className="mx-1 h-5 w-px bg-stone-700" aria-hidden="true" />

      <button
        type="button"
        onClick={onDuplicate}
        title={isPersian ? 'تکثیر (Ctrl+D)' : 'Duplicate (Ctrl+D)'}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-stone-200 transition-colors hover:bg-stone-800 hover:text-white"
      >
        <Copy size={13} />
        {isPersian ? 'تکثیر' : 'Duplicate'}
      </button>

      <button
        type="button"
        onClick={onDelete}
        title={isPersian ? 'حذف (Delete)' : 'Delete (Delete)'}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-300 transition-colors hover:bg-rose-950/60 hover:text-rose-200"
      >
        <Trash2 size={13} />
        {isPersian ? 'حذف' : 'Delete'}
      </button>

      <div className="mx-1 h-5 w-px bg-stone-700" aria-hidden="true" />

      <button
        type="button"
        onClick={onClear}
        title={isPersian ? 'لغو انتخاب (Esc)' : 'Deselect (Esc)'}
        aria-label={isPersian ? 'لغو انتخاب' : 'Deselect'}
        className="rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-800 hover:text-white"
      >
        <X size={14} />
      </button>
    </div>
  );
}
