'use client';

import React, { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

export interface PageAction {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  disabled?: boolean;
  /** Primary actions stay visible as compact icon buttons on mobile. */
  primary?: boolean;
  className?: string;
}

/**
 * Plan responsiveness: page-header action row.
 * - Desktop (md+): every action rendered inline with its label.
 * - Mobile: only `primary` actions remain visible as icon buttons, everything
 *   else collapses into a ⋯ overflow menu. `trailing` (chips/badges) shows in
 *   both modes.
 */
export function PageActions({
  actions,
  trailing,
}: {
  actions: PageAction[];
  trailing?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const primaryActions = actions.filter((a) => a.primary);
  const overflowActions = actions.filter((a) => !a.primary);

  return (
    <div className="flex items-center gap-2 self-start md:self-auto">
      {/* Mobile group */}
      <div className="flex md:hidden items-center gap-2">
        {primaryActions.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={a.onClick}
            disabled={a.disabled}
            title={a.label}
            aria-label={a.label}
            className={`flex items-center justify-center w-9 h-9 rounded-xl font-bold transition-all cursor-pointer disabled:opacity-50 ${a.className || 'bg-zinc-900 border border-zinc-700 text-zinc-300'}`}
          >
            <a.icon className={`w-4 h-4 ${a.disabled ? '' : ''}`} />
          </button>
        ))}
        {trailing}
        {overflowActions.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label="More actions"
              className={`flex items-center justify-center w-9 h-9 rounded-xl border transition-all cursor-pointer ${
                open
                  ? 'bg-zinc-800 border-zinc-600 text-white'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-300'
              }`}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {open && (
              <>
                <div className="fixed inset-0 z-[99]" onClick={() => setOpen(false)} />
                <div className="absolute right-0 top-full mt-2 z-[100] w-60 rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl p-1.5 space-y-1 animate-fadeIn">
                  {actions.map((a) => (
                    <button
                      key={a.key}
                      type="button"
                      disabled={a.disabled}
                      onClick={() => {
                        setOpen(false);
                        a.onClick();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-zinc-200 hover:bg-zinc-800 disabled:opacity-50 text-start cursor-pointer"
                    >
                      <a.icon className="w-4 h-4 shrink-0" />
                      <span>{a.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Desktop group */}
      <div className="hidden md:flex items-center gap-2.5">
        {actions.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={a.onClick}
            disabled={a.disabled}
            className={`flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-xl font-bold cursor-pointer transition-all disabled:opacity-50 ${a.className || 'bg-zinc-900 border border-zinc-700 text-zinc-300'}`}
          >
            <a.icon className="w-3.5 h-3.5" />
            <span>{a.label}</span>
          </button>
        ))}
        {trailing}
      </div>
    </div>
  );
}
