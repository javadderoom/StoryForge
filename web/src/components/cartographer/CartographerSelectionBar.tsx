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
import { Copy, Trash2, X, Layers, Folder, Unlink } from 'lucide-react';
import type { MapGroup, MapGroupMode } from '@/lib/types/world';

interface CartographerSelectionBarProps {
  count: number;
  onDuplicate: () => void;
  onDelete: () => void;
  onClear: () => void;
  isPersian: boolean;
  currentGroup?: MapGroup | null;
  onGroup?: (mode: MapGroupMode) => void;
  onUngroup?: () => void;
}

export function CartographerSelectionBar({
  count,
  onDuplicate,
  onDelete,
  onClear,
  isPersian,
  currentGroup,
  onGroup,
  onUngroup,
}: CartographerSelectionBarProps) {
  return (
    <div
      role="toolbar"
      aria-label={isPersian ? 'عملیات انتخاب' : 'Selection actions'}
      className="absolute bottom-20 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1.5 rounded-2xl border border-stone-700/80 bg-stone-950/95 px-3 py-2 shadow-2xl backdrop-blur-md"
    >
      <span className="px-2 text-xs font-medium text-amber-100/90 whitespace-nowrap">
        {isPersian ? `${count} شیء انتخاب شده` : `${count} objects selected`}
      </span>

      {currentGroup && (
        <>
          <div className="mx-1 h-5 w-px bg-stone-700" aria-hidden="true" />
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/15 text-amber-300 text-xs font-medium border border-amber-500/30 max-w-[180px] truncate">
            {currentGroup.mode === 'unified_entity' ? (
              <Layers size={13} className="text-amber-400 shrink-0" />
            ) : (
              <Folder size={13} className="text-stone-300 shrink-0" />
            )}
            <span className="truncate">{currentGroup.name}</span>
          </span>
          {onUngroup && (
            <button
              type="button"
              onClick={onUngroup}
              title={isPersian ? 'جداسازی و انحلال گروه (Ungroup)' : 'Dissolve group into separate objects'}
              className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-colors"
            >
              <Unlink size={13} />
              <span>{isPersian ? 'جداسازی (Ungroup)' : 'Ungroup'}</span>
            </button>
          )}
        </>
      )}

      {!currentGroup && onGroup && count >= 2 && (
        <>
          <div className="mx-1 h-5 w-px bg-stone-700" aria-hidden="true" />
          <button
            type="button"
            onClick={() => onGroup('unified_entity')}
            title={
              isPersian
                ? 'گروه‌بندی به عنوان یک انتینتی واحد داستان (مانند رودخانه و شاخه‌های دلتا)'
                : 'Group into one canonical World Entity (e.g. river and delta branches)'
            }
            className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-colors"
          >
            <Layers size={13} />
            <span>{isPersian ? 'انتینتی واحد' : 'Group (Unified Entity)'}</span>
          </button>

          <button
            type="button"
            onClick={() => onGroup('folder')}
            title={
              isPersian
                ? 'پوشه سازمانی صرفاً برای جابجایی دسته‌جمعی بدون تغییر هویت در بازی'
                : 'Folder group for canvas layout only (independent engine entities)'
            }
            className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium text-stone-300 hover:bg-stone-800 hover:text-white border border-stone-700/60 transition-colors"
          >
            <Folder size={13} />
            <span>{isPersian ? 'پوشه سازمانی' : 'Group (Folder)'}</span>
          </button>
        </>
      )}

      <div className="mx-1 h-5 w-px bg-stone-700" aria-hidden="true" />

      <button
        type="button"
        onClick={onDuplicate}
        title={isPersian ? 'تکثیر (Ctrl+D)' : 'Duplicate (Ctrl+D)'}
        className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium text-stone-200 transition-colors hover:bg-stone-800 hover:text-white"
      >
        <Copy size={13} />
        {isPersian ? 'تکثیر' : 'Duplicate'}
      </button>

      <button
        type="button"
        onClick={onDelete}
        title={isPersian ? 'حذف (Delete)' : 'Delete (Delete)'}
        className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium text-rose-300 transition-colors hover:bg-rose-950/60 hover:text-rose-200"
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
        className="rounded-xl p-1.5 text-stone-400 transition-colors hover:bg-stone-800 hover:text-white"
      >
        <X size={14} />
      </button>
    </div>
  );
}
