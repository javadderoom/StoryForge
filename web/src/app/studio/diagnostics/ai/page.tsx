'use client';

import React, { useEffect, useState } from 'react';
import { useStudioStory } from '@/lib/context/StudioStoryContext';
import {
  FlaskConical,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ScrollText,
  ShieldCheck,
} from 'lucide-react';

interface ScenarioMeta {
  id: string;
  title: string;
  invariant: string;
  language: 'en' | 'fa';
}

interface Finding {
  severity: 'error' | 'warning';
  rule: string;
  detail: string;
}

interface EvalResultView {
  scenarioId: string;
  title: string;
  invariant: string;
  modelUsed: string | null;
  source: 'cassette' | 'live' | 'missing';
  passed: boolean;
  narrative: string;
  choices: Array<{ id: string; text: string; requiredStatId?: string; targetDC?: number; style: string; riskLevel: string }>;
  heuristic: {
    passed: boolean;
    findings: Finding[];
    stats: { choiceCount: number; dicelessCount: number; wordCount: number; checkedDcs: number[]; rescuedChoices: number };
  };
  judge?: { model: string; scores: Record<string, number>; notes?: string };
}

export default function AiDiagnosticsPage() {
  const { isPersian } = useStudioStory();
  const [scenarios, setScenarios] = useState<ScenarioMeta[]>([]);
  const [cassetteModels, setCassetteModels] = useState<string[]>([]);
  const [modelId, setModelId] = useState('gemini-3.5-flash-lite');
  const [live, setLive] = useState(false);
  const [judge, setJudge] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [result, setResult] = useState<EvalResultView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const t = {
    heading: isPersian ? 'میز عیب‌یابی روایت هوش مصنوعی' : 'AI Narrative Diagnostic Bench',
    sub: isPersian
      ? 'اجرای سناریوهای طلایی، بازرسی گزینه‌ها و شناسایی نقض قوانین'
      : 'Run the golden scenarios, inspect raw choices, and pinpoint rule violations.',
    run: isPersian ? 'اجرا' : 'Run',
    running: isPersian ? 'در حال اجرا...' : 'Running...',
    live: isPersian ? 'فراخوانی واقعی مدل (هزینه‌بر)' : 'Live model call (costs credits)',
    judgeToggle: isPersian ? 'داور ادبی مدل‌محور' : 'LLM-as-a-Judge',
    model: isPersian ? 'مدل' : 'Model',
    status: isPersian ? 'وضعیت' : 'Status',
    prose: isPersian ? 'روایت تولیدشده' : 'Generated Prose',
    choices: isPersian ? 'گزینه‌های ارائه‌شده' : 'Presented Choices',
    findings: isPersian ? 'یافته‌های موتور قواعد' : 'Rule Findings',
    stats: isPersian ? 'آمار اجرا' : 'Run Stats',
    noFindings: isPersian ? 'هیچ نقضی یافت نشد.' : 'No violations found.',
    select: isPersian ? 'یک سناریو را اجرا کنید.' : 'Run a scenario to inspect its output.',
  };

  useEffect(() => {
    fetch('/api/studio/diagnostics/ai/run')
      .then((r) => r.json())
      .then((json) => {
        if (json?.success) {
          setScenarios(json.data.scenarios ?? []);
          setCassetteModels(json.data.cassetteModels ?? []);
        }
      })
      .catch(() => setError('Failed to load scenarios.'));
  }, []);

  async function run(scenarioId: string) {
    setRunningId(scenarioId);
    setError(null);
    try {
      const res = await fetch('/api/studio/diagnostics/ai/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId, modelId, live, judge }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error ?? 'Evaluation failed');
      setResult(json.data as EvalResultView);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Evaluation failed');
    } finally {
      setRunningId(null);
    }
  }

  const badge = (r: EvalResultView) =>
    r.source === 'missing' ? (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-400">
        <AlertTriangle className="w-3.5 h-3.5" /> SKIP
      </span>
    ) : r.passed ? (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
        <CheckCircle2 className="w-3.5 h-3.5" /> PASS
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-400">
        <XCircle className="w-3.5 h-3.5" /> FAIL
      </span>
    );

  return (
    <div className="p-5 md:p-8 max-w-6xl mx-auto">
      <header className="mb-6 flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30">
          <FlaskConical className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-zinc-100">{t.heading}</h1>
          <p className="text-sm text-zinc-400 mt-1">{t.sub}</p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-4 mb-6">
        <label className="text-xs text-zinc-400 flex items-center gap-2">
          {t.model}
          <input
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            list="eval-cassette-models"
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 w-56"
          />
          <datalist id="eval-cassette-models">
            {cassetteModels.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>
        <label className="text-xs text-zinc-400 flex items-center gap-2">
          <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />
          {t.live}
        </label>
        <label className="text-xs text-zinc-400 flex items-center gap-2">
          <input type="checkbox" checked={judge} onChange={(e) => setJudge(e.target.checked)} />
          {t.judgeToggle}
        </label>
      </div>

      {error && (
        <div className="mb-5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        {scenarios.map((s) => (
          <div key={s.id} className="border border-zinc-800 rounded-xl bg-[#0d0e15] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-bold text-zinc-100">{s.title}</div>
                <div className="text-xs text-zinc-500 mt-1">{s.invariant}</div>
                <div className="text-[10px] text-zinc-600 mt-1 font-mono">{s.id}</div>
              </div>
              <button
                type="button"
                onClick={() => run(s.id)}
                disabled={runningId === s.id}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 px-2.5 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/25 disabled:opacity-50"
              >
                {runningId === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                {runningId === s.id ? t.running : t.run}
              </button>
            </div>
          </div>
        ))}
      </div>

      {result ? (
        <section className="mt-6 border border-zinc-800 rounded-xl bg-[#0d0e15] p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              {badge(result)}
              <span className="text-sm font-bold text-zinc-200">{result.title}</span>
            </div>
            <span className="text-[11px] text-zinc-500 font-mono">
              {result.modelUsed ?? 'no model'} · {result.source}
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-2">{result.invariant}</p>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4">
            {([
              ['choices', result.heuristic.stats.choiceCount],
              ['diceless', result.heuristic.stats.dicelessCount],
              ['words', result.heuristic.stats.wordCount],
              ['DCs', result.heuristic.stats.checkedDcs.join(', ') || '—'],
              ['rescued', result.heuristic.stats.rescuedChoices],
            ] as Array<[string, string | number]>).map(([k, v]) => (
              <div key={k} className="rounded-lg bg-zinc-900/70 border border-zinc-800 px-2.5 py-2">
                <div className="text-[10px] uppercase tracking-wide text-zinc-500">{k}</div>
                <div className="text-sm font-bold text-zinc-200 font-mono">{String(v)}</div>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-500 mb-2">{t.findings}</div>
            {result.heuristic.findings.length === 0 ? (
              <div className="text-xs text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" /> {t.noFindings}
              </div>
            ) : (
              <ul className="space-y-1.5">
                {result.heuristic.findings.map((f, i) => (
                  <li
                    key={i}
                    className={`text-xs rounded-lg px-2.5 py-1.5 border ${
                      f.severity === 'error'
                        ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                        : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                    }`}
                  >
                    <span className="font-mono font-bold">[{f.rule}]</span> {f.detail}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-500 mb-2 flex items-center gap-1.5">
              <ScrollText className="w-3.5 h-3.5" /> {t.prose}
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {result.narrative || '—'}
            </p>
          </div>

          {result.choices.length > 0 && (
            <div className="mt-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-500 mb-2">{t.choices}</div>
              <ul className="space-y-1.5">
                {result.choices.map((c) => (
                  <li
                    key={c.id}
                    className="text-xs text-zinc-300 rounded-lg border border-zinc-800 px-2.5 py-1.5 flex items-center justify-between gap-3"
                  >
                    <span>{c.text}</span>
                    <span className="shrink-0 font-mono text-[10px] text-zinc-500">
                      {c.requiredStatId ? `${c.requiredStatId} DC ${c.targetDC}` : 'diceless'} · {c.riskLevel}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.judge && (
            <div className="mt-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-500 mb-2">
                Judge ({result.judge.model})
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(result.judge.scores).map(([k, v]) => (
                  <span
                    key={k}
                    className="text-xs rounded-lg bg-zinc-900/70 border border-zinc-800 px-2.5 py-1 text-zinc-300 font-mono"
                  >
                    {k}: {v}/5
                  </span>
                ))}
              </div>
              {result.judge.notes && <p className="text-xs text-zinc-500 mt-2">{result.judge.notes}</p>}
            </div>
          )}
        </section>
      ) : (
        <div className="mt-6 text-xs text-zinc-600">{t.select}</div>
      )}

    </div>
  );
}

