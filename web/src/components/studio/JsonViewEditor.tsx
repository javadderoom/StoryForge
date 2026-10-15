'use client';

import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Copy, Check, Pencil, ListTree, AlertCircle } from 'lucide-react';

interface JsonViewEditorProps {
  value: unknown;
  onApply: (parsed: any) => void;
  isPersian?: boolean;
  title?: string;
}

type CollapsedMap = Record<string, boolean>;

function pathKey(path: (string | number)[]): string {
  return path.map((p) => String(p)).join('.');
}

function isExpandable(v: unknown): v is Record<string, unknown> | unknown[] {
  return typeof v === 'object' && v !== null;
}

function childCount(v: Record<string, unknown> | unknown[]): number {
  return Array.isArray(v) ? v.length : Object.keys(v).length;
}

function JsonNode({
  label,
  value,
  path,
  depth,
  collapsed,
  toggle,
  isPersian,
}: {
  label?: string;
  value: unknown;
  path: (string | number)[];
  depth: number;
  collapsed: CollapsedMap;
  toggle: (path: (string | number)[]) => void;
  isPersian: boolean;
}) {
  if (!isExpandable(value)) {
    const textColor =
      value === null
        ? 'text-zinc-500'
        : typeof value === 'string'
          ? 'text-emerald-300'
          : typeof value === 'number'
            ? 'text-sky-300'
            : typeof value === 'boolean'
              ? 'text-purple-300'
              : 'text-zinc-300';
    return (
      <div className="flex items-start gap-1.5 py-px font-mono text-[11.5px] leading-relaxed" style={{ paddingLeft: depth * 14 }}>
        {label !== undefined && <span className="text-amber-200/90 shrink-0">"{label}":</span>}
        <span className={`${textColor} break-all`}>
          {value === null ? 'null' : typeof value === 'string' ? `"${value}"` : String(value)}
        </span>
      </div>
    );
  }

  const key = pathKey(path);
  const isCollapsed = !!collapsed[key];
  const count = childCount(value);
  const entries: [string, unknown][] = Array.isArray(value)
    ? value.map((v, i) => [String(i), v])
    : Object.entries(value);
  const open = Array.isArray(value) ? '[' : '{';
  const close = Array.isArray(value) ? ']' : '}';

  return (
    <div className="font-mono text-[11.5px] leading-relaxed">
      <div
        className="flex items-center gap-1.5 py-px rounded hover:bg-zinc-800/60 cursor-pointer select-none"
        style={{ paddingLeft: depth * 14 }}
        onClick={() => toggle(path)}
      >
        {isCollapsed ? (
          <ChevronRight className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
        )}
        {label !== undefined && <span className="text-amber-200/90 shrink-0">"{label}":</span>}
        <span className="text-zinc-400">{open}</span>
        {isCollapsed && (
          <span className="text-zinc-600 text-[10.5px]">
            … {close} <span className="text-zinc-700">({count} {Array.isArray(value) ? (isPersian ? 'مورد' : 'items') : (isPersian ? 'کلید' : 'keys')})</span>
          </span>
        )}
      </div>
      {!isCollapsed &&
        entries.map(([k, v]) => (
          <JsonNode
            key={k}
            label={Array.isArray(value) ? undefined : k}
            value={v}
            path={[...path, k]}
            depth={depth + 1}
            collapsed={collapsed}
            toggle={toggle}
            isPersian={isPersian}
          />
        ))}
      {!isCollapsed && (
        <div className="py-px text-zinc-400" style={{ paddingLeft: depth * 14 }}>
          {close}
        </div>
      )}
    </div>
  );
}

export function JsonViewEditor({ value, onApply, isPersian = true, title }: JsonViewEditorProps) {
  const [mode, setMode] = useState<'tree' | 'edit'>('tree');
  const [collapsed, setCollapsed] = useState<CollapsedMap>({});
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const pretty = useMemo(() => JSON.stringify(value, null, 2) ?? 'null', [value]);

  const toggle = (path: (string | number)[]) => {
    const key = pathKey(path);
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setAll = (collapse: boolean) => {
    if (!collapse) {
      setCollapsed({});
      return;
    }
    const next: CollapsedMap = {};
    const walk = (v: unknown, path: (string | number)[]) => {
      if (!isExpandable(v)) return;
      const entries: [string, unknown][] = Array.isArray(v)
        ? v.map((x, i) => [String(i), x])
        : Object.entries(v);
      if (entries.length === 0) return;
      next[pathKey(path)] = true;
      for (const [k, child] of entries) walk(child, [...path, k]);
    };
    walk(value, []);
    setCollapsed(next);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pretty);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const handleApply = () => {
    const raw = text ?? pretty;
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        setError(isPersian ? 'جی‌سون باید یک آبجکت باشد.' : 'JSON must be an object.');
        return;
      }
      setError(null);
      setText(null);
      setMode('tree');
      setCollapsed({});
      onApply(parsed);
    } catch (e: any) {
      setError(e?.message || (isPersian ? 'جی‌سون نامعتبر است.' : 'Invalid JSON.'));
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-zinc-800/80 bg-zinc-900/40">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] font-bold text-zinc-300 truncate">
            {title || (isPersian ? 'نمای جی‌سون' : 'JSON view')}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {mode === 'tree' ? (
            <>
              <button
                type="button"
                onClick={() => setAll(true)}
                title={isPersian ? 'بستن همه' : 'Collapse all'}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 cursor-pointer"
              >
                <ChevronsDownUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setAll(false)}
                title={isPersian ? 'باز کردن همه' : 'Expand all'}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 cursor-pointer"
              >
                <ChevronsUpDown className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleCopy}
                title={isPersian ? 'کپی' : 'Copy'}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setText(pretty);
                  setError(null);
                  setMode('edit');
                }}
                title={isPersian ? 'ویرایش' : 'Edit'}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25 cursor-pointer"
              >
                <Pencil className="w-3 h-3" />
                {isPersian ? 'ویرایش' : 'Edit'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setMode('tree');
                  setText(null);
                  setError(null);
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-zinc-800 text-zinc-300 hover:bg-zinc-700 cursor-pointer"
              >
                <ListTree className="w-3 h-3" />
                {isPersian ? 'درخت' : 'Tree'}
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="px-3 py-1 rounded-lg text-[11px] font-bold bg-amber-500 text-zinc-950 hover:bg-amber-400 cursor-pointer"
              >
                {isPersian ? 'اعمال' : 'Apply'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      {mode === 'tree' ? (
        <div className="p-3 max-h-96 overflow-auto" dir="ltr">
          <JsonNode
            value={value}
            path={[]}
            depth={0}
            collapsed={collapsed}
            toggle={toggle}
            isPersian={isPersian}
          />
        </div>
      ) : (
        <div className="p-3 space-y-2" dir="ltr">
          <textarea
            value={text ?? pretty}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
            spellCheck={false}
            rows={18}
            className="w-full font-mono text-[11.5px] leading-relaxed bg-black/40 border border-zinc-700 rounded-xl p-3 text-zinc-100 focus:outline-none focus:border-amber-500 resize-y"
          />
          {error && (
            <div className="flex items-center gap-1.5 text-[11px] text-red-400 bg-red-950/30 border border-red-900/50 rounded-lg px-2.5 py-1.5" dir={isPersian ? 'rtl' : 'ltr'}>
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="font-mono break-all">{error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
