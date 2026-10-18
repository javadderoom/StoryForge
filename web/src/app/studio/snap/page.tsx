'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useStudioStory } from '@/lib/context/StudioStoryContext';
import type { SnapReportSummary } from '@/lib/play/snapReport';
import {
  Activity,
  CheckCircle2,
  Clock3,
  Gauge,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
  XCircle,
} from 'lucide-react';

interface RecentPrediction {
  id: string;
  sessionId: string;
  turnNumber: number;
  predictedChoiceId: string;
  predictedChoiceText: string | null;
  actualChoiceId: string | null;
  actualChoiceText: string | null;
  actualActionText: string | null;
  hit: boolean | null;
  confidence: number | null;
  latencyMs: number | null;
  createdAt: string;
  resolvedAt: string | null;
  branch: {
    id: string;
    status: string;
    verdict: string | null;
    outcome: string | null;
    diceRoll: number | null;
    isDiceless: boolean;
    findings: number;
  } | null;
}

interface SnapApiData {
  storyId: string | null;
  limit: number;
  flags: { snapAot: boolean; judge: boolean };
  summary: SnapReportSummary;
  recent: RecentPrediction[];
}

const EMPTY_SUMMARY: SnapReportSummary = {
  predictions: { total: 0, resolved: 0, hits: 0, misses: 0, pending: 0, hitRate: null },
  branches: { total: 0, byStatus: {}, generated: 0, avgGenerationLatencyMs: null, models: {} },
  gate: { wouldServe: 0, hitWithoutBranch: 0, wastedSpend: 0, savedSpend: 0, pendingBranch: 0 },
  audit: {
    branchesAudited: 0,
    byVerdict: {},
    firstDraftFailed: 0,
    repaired: 0,
    findingsByCategory: {},
    judge: { evaluated: 0, skipped: 0, findings: 0 },
  },
};

export default function SnapAnalyticsPage() {
  const { isPersian, selectedStoryId, story } = useStudioStory();
  const [data, setData] = useState<SnapApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [allStories, setAllStories] = useState(false);

  const t = useMemo(
    () => ({
      heading: isPersian ? 'تحلیل پیش‌بینی اسنپ' : 'Snap Prediction Analytics',
      sub: isPersian
        ? 'نرخ درست‌بودن پیش‌بینی انتخابِ خواننده و شاخص‌های شاخه‌های AOT سایه'
        : 'Measured hit rate of SubQ choice predictions and the shadow-AOT branch audit behind the serving gate.',
      story: isPersian ? 'داستان' : 'Story',
      thisStory: isPersian ? 'همین داستان' : 'This story',
      allStories: isPersian ? 'همه داستان‌ها' : 'All stories',
      refresh: isPersian ? 'تازه‌سازی' : 'Refresh',
      loading: isPersian ? 'در حال بارگذاری...' : 'Loading…',
      hitRate: isPersian ? 'نرخ برخورد' : 'Hit rate',
      hits: isPersian ? 'برخورد' : 'Hits',
      misses: isPersian ? 'خطا' : 'Misses',
      pending: isPersian ? 'بی‌پاسخ' : 'Pending',
      resolved: isPersian ? 'حل‌شده' : 'resolved',
      ofTotal: isPersian ? 'از' : 'of',
      window: isPersian ? 'آخرین' : 'last',
      branchAudit: isPersian ? 'ممیزی شاخه‌های AOT' : 'AOT branch audit',
      branches: isPersian ? 'شاخه‌ها' : 'Branches',
      generated: isPersian ? 'تولیدشده' : 'Generated',
      avgLatency: isPersian ? 'میانگین تأخیر تولید' : 'Avg generation latency',
      verdicts: isPersian ? 'وضعیت ممیزی' : 'Audit verdicts',
      firstDraftFailed: isPersian ? 'پیش‌نویس ناموفق' : 'First draft failed',
      repaired: isPersian ? 'ترمیم‌شده' : 'Repaired',
      topFindings: isPersian ? 'یافته‌های اصلی' : 'Top findings',
      judge: isPersian ? 'داور معنایی SubQ' : 'SubQ semantic judge',
      evaluated: isPersian ? 'ارزیابی‌شده' : 'Evaluated',
      skipped: isPersian ? 'ردشده' : 'Skipped',
      findings: isPersian ? 'یافته‌ها' : 'Findings',
      gate: isPersian ? 'ماتریس دروازه سرو' : 'Serving gate matrix',
      wouldServe: isPersian ? 'برخورد + شاخه آماده' : 'Hit + branch ready',
      hitNoBranch: isPersian ? 'برخورد بدون شاخه' : 'Hit, no branch',
      wasted: isPersian ? 'خطا + شاخه (هزینه تلف‌شده)' : 'Miss + branch (wasted)',
      saved: isPersian ? 'خطا بدون شاخه (هزینه ذخیره‌شده)' : 'Miss, no branch (saved)',
      pendingBranch: isPersian ? 'بی‌پاسخ + شاخه' : 'Pending + branch',
      recent: isPersian ? 'پیش‌بینی‌های اخیر' : 'Recent predictions',
      turn: isPersian ? 'نوبت' : 'Turn',
      session: isPersian ? 'نشست' : 'Session',
      predicted: isPersian ? 'پیش‌بینی' : 'Predicted',
      actual: isPersian ? 'انتخاب واقعی' : 'Actual',
      result: isPersian ? 'نتیجه' : 'Result',
      confidence: isPersian ? 'اطمینان' : 'Confidence',
      latency: isPersian ? 'تأخیر' : 'Latency',
      branch: isPersian ? 'شاخه' : 'Branch',
      hit: isPersian ? 'برخورد' : 'HIT',
      miss: isPersian ? 'خطا' : 'MISS',
      open: isPersian ? 'بی‌پاسخ' : 'PENDING',
      freeText: isPersian ? '(متن آزاد)' : '(free text)',
      none: isPersian ? '—' : '—',
      emptyTitle: isPersian ? 'هنوز پیش‌بینی‌ای ثبت نشده' : 'No predictions recorded yet',
      emptyBody: isPersian
        ? 'وقتی خواننده‌ای صحنه‌ای را باز کند، اسنپ در پس‌زمینه پیش‌بینی می‌کند و بعد از انتخابش نتیجه ثبت می‌شود.'
        : 'When a reader opens a scene, Snap predicts the next tap in the background; the row resolves when they choose.',
      aotOff: isPersian
        ? 'تولید AOT سایه خاموش است. ENABLE_SNAP_AOT=true را در web/.env تنظیم کنید تا شاخه‌ها جمع‌آوری شوند.'
        : 'Shadow AOT generation is off. Set ENABLE_SNAP_AOT=true in web/.env to start collecting branches.',
      judgeOff: isPersian
        ? 'داور معنایی SubQ خاموش است (SNAP_AOT_JUDGE).'
        : 'The SubQ semantic judge is off (SNAP_AOT_JUDGE).',
      hitDefinition: isPersian
        ? 'برخورد یعنی خواننده دقیقاً همان گزینهٔ پیش‌بینی‌شده را انتخاب کرده باشد؛ انتخاب دیگر یا متن آزاد خطا محسوب می‌شود.'
        : 'A hit means the reader tapped the exact predicted choice. A different choice or free text counts as a miss.',
      dbDisabled: isPersian
        ? 'پایگاه داده در این محیط فعال نیست (ENABLE_DB=true لازم است).'
        : 'The database is not enabled in this environment (ENABLE_DB=true required).',
    }),
    [isPersian]
  );

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const params = new URLSearchParams({ limit: '100' });
        if (!allStories && selectedStoryId) params.set('storyId', selectedStoryId);
        const res = await fetch(`/api/studio/snap?${params.toString()}`, { cache: 'no-store' });
        const json = await res.json();
        if (!json?.success) {
          throw new Error(
            json?.databaseDisabled ? t.dbDisabled : json?.error ?? 'Failed to load Snap analytics'
          );
        }
        if (cancelled) return;
        setData(json.data as SnapApiData);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load Snap analytics');
        setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [selectedStoryId, refreshKey, allStories, t.dbDisabled]);

  const summary = data?.summary ?? EMPTY_SUMMARY;
  const p = summary.predictions;
  const verdictEntries = ['clean', 'repaired', 'warned', 'rejected'] as const;
  const hitPercent = p.hitRate ?? 0;

  return (
    <div className="p-6 md:p-8 space-y-6" dir={isPersian ? 'rtl' : 'ltr'}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{t.heading}</h1>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-zinc-400">{t.sub}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
              <div className="inline-flex overflow-hidden rounded-md border border-zinc-800">
                <button
                  onClick={() => {
                    if (allStories) return;
                    setLoading(true);
                    setAllStories(false);
                  }}
                  className={`px-2 py-1 transition-colors ${
                    allStories
                      ? 'bg-transparent text-zinc-500 hover:text-zinc-300'
                      : 'bg-zinc-800/80 text-zinc-200'
                  }`}
                >
                  {t.thisStory}
                </button>
                <button
                  onClick={() => {
                    if (allStories) return;
                    setLoading(true);
                    setAllStories(true);
                  }}
                  className={`px-2 py-1 transition-colors ${
                    allStories
                      ? 'bg-zinc-800/80 text-zinc-200'
                      : 'bg-transparent text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {t.allStories}
                </button>
              </div>
              <span className="rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-0.5">
                {t.story}:{' '}
                <span className="text-zinc-300">
                  {allStories ? t.allStories : story?.title || t.story}
                </span>
              </span>
              <span className="text-zinc-600">{t.hitDefinition}</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            setLoading(true);
            setRefreshKey((key) => key + 1);
          }}
          disabled={loading}
          className="inline-flex w-fit items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-xs font-semibold text-zinc-200 transition-colors hover:bg-zinc-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          {t.refresh}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
          {error}
        </div>
      )}

      {data && (!data.flags.snapAot || !data.flags.judge) && (
        <div className="flex flex-col gap-1 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3 text-[11px] text-amber-200/90">
          {!data.flags.snapAot && <span>• {t.aotOff}</span>}
          {!data.flags.judge && <span>• {t.judgeOff}</span>}
        </div>
      )}

      {loading && !data ? (
        <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-10 text-xs text-zinc-400">
          <Clock3 className="h-4 w-4 animate-pulse" /> {t.loading}
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <section className="rounded-2xl border border-zinc-800 bg-[#0d0f16] p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                  <Gauge className="h-4 w-4 text-emerald-400" /> {t.hitRate}
                </div>
                <span className="text-[11px] text-zinc-500">
                  {p.resolved} {t.resolved} {t.ofTotal} {p.total} · {t.window}{' '}
                  {data?.limit ?? 100}
                </span>
              </div>
              <div className="mt-4 flex items-end gap-3">
                <span className="text-4xl font-black tracking-tight text-white">
                  {p.hitRate === null ? '—' : `${p.hitRate}%`}
                </span>
                <span className="pb-1 text-[11px] text-zinc-500">
                  {p.hits} {t.hits} / {p.misses} {t.misses} / {p.pending} {t.pending}
                </span>
              </div>
              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className={`h-full rounded-full transition-all ${
                    hitPercent >= 60
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                      : hitPercent >= 35
                        ? 'bg-gradient-to-r from-amber-500 to-orange-400'
                        : 'bg-gradient-to-r from-rose-600 to-rose-400'
                  }`}
                  style={{ width: `${Math.max(hitPercent > 0 ? 2 : 0, Math.min(100, hitPercent))}%` }}
                />
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2">
                <Metric label={t.hits} value={p.hits} accent="text-emerald-400" />
                <Metric label={t.misses} value={p.misses} accent="text-rose-400" />
                <Metric label={t.pending} value={p.pending} accent="text-zinc-300" />
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-[#0d0f16] p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                  <Sparkles className="h-4 w-4 text-indigo-400" /> {t.branchAudit}
                </div>
                <span className="text-[11px] text-zinc-500">
                  {t.window} {data?.limit ?? 100}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <Metric label={t.branches} value={summary.branches.total} />
                <Metric label={t.generated} value={summary.branches.generated} accent="text-indigo-300" />
                <Metric
                  label={t.avgLatency}
                  value={
                    summary.branches.avgGenerationLatencyMs === null
                      ? '—'
                      : `${summary.branches.avgGenerationLatencyMs} ms`
                  }
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {verdictEntries.map((verdict) => (
                  <span
                    key={verdict}
                    className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                      verdict === 'rejected'
                        ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                        : verdict === 'warned'
                          ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                          : verdict === 'repaired'
                            ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300'
                            : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    }`}
                  >
                    {verdict} {summary.audit.byVerdict[verdict] ?? 0}
                  </span>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-500">
                <span>
                  {t.firstDraftFailed}: {summary.audit.firstDraftFailed}
                </span>
                <span>
                  {t.repaired}: {summary.audit.repaired}
                </span>
              </div>
              <div className="mt-4 border-t border-zinc-800/80 pt-3 text-[11px] text-zinc-400">
                <div className="flex items-center gap-2">
                  <Activity className="h-3.5 w-3.5 text-amber-400" /> {t.judge}{' '}
                  <span className={data?.flags.judge ? 'text-emerald-400' : 'text-zinc-500'}>
                    {data?.flags.judge ? 'ON' : 'OFF'}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-zinc-500">
                  <span>
                    {t.evaluated}: {summary.audit.judge.evaluated}
                  </span>
                  <span>
                    {t.skipped}: {summary.audit.judge.skipped}
                  </span>
                  <span>
                    {t.findings}: {summary.audit.judge.findings}
                  </span>
                </div>
              </div>
              {Object.keys(summary.audit.findingsByCategory).length > 0 && (
                <div className="mt-3 border-t border-zinc-800/80 pt-3">
                  <div className="text-[10px] uppercase tracking-wide text-zinc-500">
                    {t.topFindings}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {Object.entries(summary.audit.findingsByCategory)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 6)
                      .map(([category, count]) => (
                        <span
                          key={category}
                          className="rounded bg-zinc-800/60 px-1.5 py-0.5 text-[10px] text-zinc-300"
                        >
                          {category} <span className="text-zinc-500">{count}</span>
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </section>
          </div>

          <section className="rounded-2xl border border-zinc-800 bg-[#0d0f16] p-5">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
              <ShieldAlert className="h-4 w-4 text-amber-400" /> {t.gate}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <GateCell label={t.wouldServe} value={summary.gate.wouldServe} tone="emerald" />
              <GateCell label={t.hitNoBranch} value={summary.gate.hitWithoutBranch} tone="indigo" />
              <GateCell label={t.wasted} value={summary.gate.wastedSpend} tone="rose" />
              <GateCell label={t.saved} value={summary.gate.savedSpend} tone="emerald" />
              <GateCell label={t.pendingBranch} value={summary.gate.pendingBranch} tone="zinc" />
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#0d0f16]">
            <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                <Activity className="h-4 w-4 text-emerald-400" /> {t.recent}
              </div>
              <span className="text-[11px] text-zinc-500">{p.total}</span>
            </div>
            {data?.recent.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-[11px]">
                  <thead className="bg-zinc-900/60 text-[10px] uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-4 py-2.5">{t.turn}</th>
                      <th className="px-4 py-2.5">{t.session}</th>
                      <th className="px-4 py-2.5">{t.predicted}</th>
                      <th className="px-4 py-2.5">{t.actual}</th>
                      <th className="px-4 py-2.5">{t.result}</th>
                      <th className="px-4 py-2.5">{t.confidence}</th>
                      <th className="px-4 py-2.5">{t.latency}</th>
                      <th className="px-4 py-2.5">{t.branch}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/70">
                    {data.recent.map((row) => (
                      <tr key={row.id} className="text-zinc-300">
                        <td className="whitespace-nowrap px-4 py-2.5 font-mono text-zinc-400">
                          {row.turnNumber}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 font-mono text-zinc-500">
                          {row.sessionId.slice(0, 8)}
                        </td>
                        <td className="max-w-[220px] px-4 py-2.5">
                          <div className="truncate text-zinc-200">
                            {row.predictedChoiceText ?? row.predictedChoiceId}
                          </div>
                          <div className="truncate font-mono text-[10px] text-zinc-600">
                            {row.predictedChoiceId}
                          </div>
                        </td>
                        <td className="max-w-[220px] px-4 py-2.5">
                          {row.actualChoiceId ? (
                            <div>
                              <div className="truncate text-zinc-300">
                                {row.actualChoiceText ?? row.actualChoiceId}
                              </div>
                              <div className="truncate font-mono text-[10px] text-zinc-600">
                                {row.actualChoiceId}
                              </div>
                            </div>
                          ) : row.actualActionText ? (
                            <div className="truncate italic text-zinc-500">
                              {row.actualActionText}{' '}
                              <span className="not-italic text-zinc-600">{t.freeText}</span>
                            </div>
                          ) : (
                            <span className="text-zinc-600">{t.none}</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5">
                          {row.hit === true ? (
                            <span className="inline-flex items-center gap-1 font-bold text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5" /> {t.hit}
                            </span>
                          ) : row.hit === false ? (
                            <span className="inline-flex items-center gap-1 font-bold text-rose-400">
                              <XCircle className="h-3.5 w-3.5" /> {t.miss}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-zinc-500">
                              <Clock3 className="h-3.5 w-3.5" /> {t.open}
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-zinc-400">
                          {row.confidence === null ? t.none : `${Math.round(row.confidence * 100)}%`}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-zinc-400">
                          {row.latencyMs === null ? t.none : `${row.latencyMs} ms`}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5">
                          {row.branch ? (
                            <span className="inline-flex items-center gap-1.5">
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                  row.branch.verdict === 'rejected'
                                    ? 'bg-rose-500/15 text-rose-300'
                                    : row.branch.verdict === 'warned'
                                      ? 'bg-amber-500/15 text-amber-300'
                                      : row.branch.verdict === 'repaired'
                                        ? 'bg-indigo-500/15 text-indigo-300'
                                        : row.branch.verdict === 'clean' ||
                                            row.branch.status === 'generated'
                                          ? 'bg-emerald-500/15 text-emerald-300'
                                          : 'bg-zinc-700/40 text-zinc-300'
                                }`}
                              >
                                {row.branch.verdict ?? row.branch.status}
                              </span>
                              {row.branch.findings > 0 && (
                                <span className="text-[10px] text-zinc-500">
                                  {row.branch.findings} {t.findings}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-zinc-600">{t.none}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-5 py-10 text-center">
                <Target className="mx-auto h-7 w-7 text-zinc-700" />
                <p className="mt-2 text-xs font-semibold text-zinc-300">{t.emptyTitle}</p>
                <p className="mx-auto mt-1 max-w-md text-[11px] leading-relaxed text-zinc-500">
                  {t.emptyBody}
                </p>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  accent = 'text-white',
}: {
  label: string;
  value: number | string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`mt-1 text-lg font-bold ${accent}`}>{value}</div>
    </div>
  );
}

function GateCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'emerald' | 'rose' | 'indigo' | 'zinc';
}) {
  const toneClass =
    tone === 'emerald'
      ? 'text-emerald-300 border-emerald-500/25 bg-emerald-500/[0.06]'
      : tone === 'rose'
        ? 'text-rose-300 border-rose-500/25 bg-rose-500/[0.06]'
        : tone === 'indigo'
          ? 'text-indigo-300 border-indigo-500/25 bg-indigo-500/[0.06]'
          : 'text-zinc-300 border-zinc-700/60 bg-zinc-800/30';
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${toneClass}`}>
      <div className="text-[10px] uppercase tracking-wide opacity-75">{label}</div>
      <div className="mt-1 text-lg font-bold">{value}</div>
    </div>
  );
}
