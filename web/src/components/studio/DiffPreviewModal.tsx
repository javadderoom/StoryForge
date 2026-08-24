'use client';

import React, { useState, useMemo } from 'react';
import { Check, X, Pencil, Loader2 } from 'lucide-react';

export interface DiffView {
  op: 'create' | 'update' | 'delete';
  entityLabel: string;
  oldData?: unknown;
  newData?: unknown;
}

interface DiffPreviewModalProps {
  open: boolean;
  diff: DiffView | null;
  isPersian: boolean;
  busy?: boolean;
  onConfirm: (editedData?: unknown) => void;
  onReject: () => void;
}

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? '');
  }
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function diffKeys(oldData: unknown, newData: unknown): string[] {
  const a = toRecord(oldData);
  const b = toRecord(newData);
  return Array.from(new Set([...Object.keys(a), ...Object.keys(b)]));
}

function isChanged(key: string, oldData: unknown, newData: unknown): boolean {
  const ov = toRecord(oldData)[key];
  const nv = toRecord(newData)[key];
  return JSON.stringify(ov) !== JSON.stringify(nv);
}

export default function DiffPreviewModal({
  open,
  diff,
  isPersian,
  busy,
  onConfirm,
  onReject,
}: DiffPreviewModalProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const keys = useMemo(
    () => diff && diff.op !== 'delete' ? diffKeys(diff.oldData, diff.newData) : [],
    [diff]
  );

  if (!open || !diff) return null;

  const t = isPersian
    ? {
        title: diff.op === 'create' ? 'پیش‌نمایش موجودیت تازه' : diff.op === 'delete' ? 'تأیید حذف' : 'پیش‌نمایش ویرایش',
        current: 'فعلی',
        proposed: 'پیشنهادی',
        removed: 'این موجودیت حذف خواهد شد',
        confirm: 'اعمال تغییر',
        reject: 'رد',
        edit: 'ویرایش دستی',
        done: 'پایان ویرایش',
        unchanged: 'بدون تغییر',
        changed: 'تغییر یافته',
        invalid: 'JSON نامعتبر است',
        confirmDelete: 'حذف قطعی',
      }
    : {
        title: diff.op === 'create' ? 'Preview new entity' : diff.op === 'delete' ? 'Confirm deletion' : 'Preview edit',
        current: 'Current',
        proposed: 'Proposed',
        removed: 'This entity will be removed',
        confirm: 'Apply change',
        reject: 'Reject',
        edit: 'Edit manually',
        done: 'Done editing',
        unchanged: 'unchanged',
        changed: 'changed',
        invalid: 'Invalid JSON',
        confirmDelete: 'Delete for real',
      };

  const beginEdit = () => {
    setDraft(stringify(diff?.newData));
    setEditing(true);
  };

  const commitEdit = () => {
    try {
      const parsed = JSON.parse(draft);
      setEditing(false);
      onConfirm(parsed);
    } catch {
      /* keep editing */
    }
  };

  const confirmClick = () => {
    if (editing) {
      commitEdit();
    } else {
      onConfirm(diff?.newData);
    }
  };

  const invalidJson = editing
    ? (() => {
        try {
          JSON.parse(draft);
          return false;
        } catch {
          return true;
        }
      })()
    : false;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={busy ? undefined : onReject} />
      <div className="relative w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl bg-[#0c0d14] border border-zinc-700/70 shadow-2xl">
        <div className="px-5 py-3 border-b border-zinc-800/80 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">{t.title}</h3>
            <p className="text-[11px] text-zinc-400">{diff.entityLabel}</p>
          </div>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
              diff.op === 'delete'
                ? 'bg-rose-500/20 text-rose-300'
                : diff.op === 'update'
                ? 'bg-sky-500/20 text-sky-300'
                : 'bg-emerald-500/20 text-emerald-300'
            }`}
          >
            {diff.op}
          </span>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {diff.op === 'delete' ? (
            <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl p-4">
              {t.removed}
              <pre className="mt-3 text-[11px] text-zinc-300 whitespace-pre-wrap overflow-auto">
                {stringify(diff.oldData)}
              </pre>
            </div>
          ) : editing ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full h-80 resize-none rounded-xl bg-zinc-950/80 border border-zinc-700/60 p-3 text-xs text-zinc-100 font-mono focus:outline-none focus:border-amber-500/50"
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl border border-zinc-800/70 overflow-hidden">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-zinc-400 bg-zinc-900/60">
                  {t.current}
                </div>
                <pre className="p-3 text-[11px] text-zinc-300 whitespace-pre-wrap overflow-auto max-h-80">
                  {diff.op === 'create' ? '—' : stringify(diff.oldData)}
                </pre>
              </div>
              <div className="rounded-xl border border-zinc-800/70 overflow-hidden">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-emerald-300 bg-emerald-500/10">
                  {t.proposed}
                </div>
                <div className="p-3 text-[11px] whitespace-pre-wrap overflow-auto max-h-80">
                  {keys.map((k) => {
                    const changed = isChanged(k, diff.oldData, diff.newData);
                    const nv = toRecord(diff.newData)[k];
                    return (
                      <div
                        key={k}
                        className={`py-1 border-b border-zinc-800/40 last:border-0 ${
                          changed ? 'bg-emerald-500/5 -mx-3 px-3' : ''
                        }`}
                      >
                        <span className="text-zinc-500">{k}: </span>
                        {changed ? (
                          <span className="text-emerald-200">
                            {stringify(nv)}
                            <span className="ml-1 text-[9px] uppercase text-emerald-400">
                              {t.changed}
                            </span>
                          </span>
                        ) : (
                          <span className="text-zinc-400">
                            {stringify(nv)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-zinc-800/80 flex items-center justify-end gap-2">
          {editing ? (
            <button
              onClick={confirmClick}
              disabled={invalidJson || busy}
              className="px-3 py-1.5 rounded-lg text-xs bg-amber-500 text-zinc-950 font-medium disabled:opacity-40"
            >
              {invalidJson ? t.invalid : t.done}
            </button>
          ) : (
            <button
              onClick={beginEdit}
              className="px-3 py-1.5 rounded-lg text-xs bg-zinc-800 text-zinc-200 hover:bg-zinc-700 flex items-center gap-1"
            >
              <Pencil className="w-3 h-3" />
              {t.edit}
            </button>
          )}
          <button
            onClick={onReject}
            disabled={busy}
            className="px-3 py-1.5 rounded-lg text-xs bg-zinc-800 text-zinc-300 hover:bg-zinc-700 flex items-center gap-1 disabled:opacity-40"
          >
            <X className="w-3 h-3" />
            {t.reject}
          </button>
          <button
            onClick={confirmClick}
            disabled={busy || (editing && invalidJson)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 ${
              diff.op === 'delete'
                ? 'bg-rose-500 text-white hover:bg-rose-400'
                : 'bg-amber-500 text-zinc-950 hover:bg-amber-400'
            } disabled:opacity-40`}
          >
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            {diff.op === 'delete' ? t.confirmDelete : t.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
