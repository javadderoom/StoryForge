'use client';

import React from 'react';
import Link from 'next/link';
import { AlertTriangle, ShieldAlert, X, ListChecks } from 'lucide-react';
import { useStudioStory } from '@/lib/context/StudioStoryContext';

export function PublishGateNotice() {
  const { publishGate, isPublishGateOpen, setPublishGateOpen, dismissPublishGate, isPersian } =
    useStudioStory();
  if (!publishGate) return null;

  const errorCount = publishGate.errors.length;
  const warningCount = publishGate.warnings.length;
  const blocked = !publishGate.ok || publishGate.publishedDowngraded;

  return (
    <>
      <div
        className={`mb-6 flex items-start gap-3 rounded-2xl border px-5 py-4 text-sm ${
          blocked
            ? 'border-rose-500/40 bg-rose-500/10 text-rose-100'
            : 'border-amber-500/40 bg-amber-500/10 text-amber-100'
        }`}
      >
        <div className="mt-0.5 shrink-0">
          {blocked ? <ShieldAlert className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold">
            {blocked
              ? isPersian
                ? `انتشار متوقف شد — ${errorCount} خطا، ${warningCount} هشدار (امتیاز ${publishGate.score})`
                : `Publication blocked — ${errorCount} errors, ${warningCount} warnings (score ${publishGate.score})`
              : isPersian
              ? `هشدار انسجام جهان (امتیاز ${publishGate.score})`
              : `World consistency warnings (score ${publishGate.score})`}
          </p>
          <p className="mt-0.5 text-xs opacity-80">
            {publishGate.publishedDowngraded
              ? isPersian
                ? 'داستان ذخیره شد اما منتشر نشد. خطاها را رفع کنید و دوباره انتشار را بزنید.'
                : 'Story saved but unpublished. Fix the errors below, then publish again.'
              : isPersian
              ? 'جزئیات کامل خطاها و پیشنهادهای اصلاح را ببینید.'
              : 'Open the full report for errors, warnings, and suggested fixes.'}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPublishGateOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-zinc-950/70 px-3 py-1.5 text-xs font-bold hover:bg-zinc-950 cursor-pointer"
            >
              <ListChecks className="h-3.5 w-3.5" />
              {isPersian ? 'مشاهده گزارش کامل' : 'View full report'}
            </button>
            <Link
              href="/studio/world"
              className="rounded-xl border border-current px-3 py-1.5 text-xs font-semibold opacity-90 hover:opacity-100"
            >
              {isPersian ? 'رفتن به رادار تضاد' : 'Open Contradiction Radar'}
            </Link>
          </div>
        </div>
        <button
          type="button"
          onClick={dismissPublishGate}
          className="shrink-0 rounded-lg p-1 opacity-70 hover:opacity-100"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {isPublishGateOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm"
          onClick={() => setPublishGateOpen(false)}
        >
          <div
            className="h-full w-full max-w-md overflow-y-auto border-l border-zinc-800 bg-zinc-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100">
                {isPersian ? 'گزارش انسجام جهان' : 'World consistency report'}
              </h3>
              <button
                type="button"
                onClick={() => setPublishGateOpen(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 text-3xl font-bold font-mono">
              {publishGate.score}
              <span className="text-sm text-zinc-500">/100</span>
            </div>

            {errorCount > 0 && (
              <div className="mt-4">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-rose-300">
                  {isPersian ? `خطاها (${errorCount})` : `Errors (${errorCount})`}
                </div>
                <div className="space-y-2">
                  {publishGate.errors.map((e, i) => (
                    <div key={i} className="rounded-xl border border-rose-500/40 bg-rose-500/5 p-3 text-xs text-rose-100">
                      {e}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {warningCount > 0 && (
              <div className="mt-4">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-300">
                  {isPersian ? `هشدارها (${warningCount})` : `Warnings (${warningCount})`}
                </div>
                <div className="space-y-2">
                  {publishGate.warnings.map((w, i) => (
                    <div key={i} className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-100">
                      {w}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {publishGate.findings.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-400">
                  {isPersian ? 'یافته‌های تفصیلی' : 'Detailed findings'}
                </div>
                <div className="space-y-2">
                  {publishGate.findings.map((f) => (
                    <div key={f.id} className="rounded-xl border border-zinc-700 bg-zinc-800/40 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-zinc-100">{f.title}</span>
                        <span className="rounded-md bg-zinc-950/60 px-2 py-0.5 font-mono text-[10px] uppercase text-zinc-300">
                          {f.severity}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-400">{f.description}</p>
                      {f.suggestedFix && (
                        <div className="mt-2 rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/10 p-2.5 text-[11px] leading-relaxed text-fuchsia-200/90">
                          <span className="font-bold text-fuchsia-300">⚡ {isPersian ? 'پیشنهاد اصلاح: ' : 'Suggested fix: '}</span>
                          {f.suggestedFix}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
