'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useStudioStory } from '@/lib/context/StudioStoryContext';
import { notify } from '@/lib/notify';
import {
  Cpu,
  Save,
  RotateCcw,
  Plug,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  KeyRound,
} from 'lucide-react';

type Tier = 'normal' | 'plus' | 'advance';
type Provider = 'gemini' | 'aiprime' | 'sinox';

interface TierConfig {
  tier: Tier;
  provider: Provider;
  model: string;
  fallbackModel?: string;
  endpoint?: string;
  temperature?: number;
  reasoningEffort?: 'low' | 'medium' | 'high';
  thinkingBudgetTokens?: number;
  source?: 'database' | 'default';
  repaired?: boolean;
}

interface ProviderStatus {
  provider: Provider;
  label: { en: string; fa: string };
  configured: boolean;
}

interface Payload {
  tiers: Array<{ tier: Tier; cost: number; label: { en: string; fa: string } }>;
  providers: ProviderStatus[];
  defaults: Record<Tier, TierConfig>;
  configs: Record<Tier, TierConfig>;
  role?: string;
  canEdit?: boolean;
}

interface ProbeResult {
  tier: Tier;
  ok: boolean;
  latencyMs: number;
  modelUsed?: string;
  error?: string;
}

const MODEL_SUGGESTIONS: Record<Provider, string[]> = {
  gemini: [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.5-flash',
  ],
  aiprime: ['gemini-3.8-flash', 'gemini-2.5-flash'],
  sinox: ['t-gemini-4-argon'],
};

const TIER_ORDER: Tier[] = ['normal', 'plus', 'advance'];

export default function NarratorModelsPage() {
  const { isPersian } = useStudioStory();
  const [payload, setPayload] = useState<Payload | null>(null);
  const [draft, setDraft] = useState<Record<Tier, TierConfig> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [probing, setProbing] = useState<Tier | null>(null);
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, Record<string, string>>>({});

  const t = useMemo(
    () => ({
      heading: isPersian ? 'مدل‌های روایت‌گر' : 'Narrator Models',
      sub: isPersian
        ? 'تعیین کنید هر پرده روایت (استاندارد، پلاس، پیشرفته) با کدام ارائه‌دهنده و کدام مدل پاسخ دهد.'
        : 'Decide which provider and model answers each narrator tier (Standard, Plus, Advance).',
      providers: isPersian ? 'ارائه‌دهندگان' : 'Providers',
      configured: isPersian ? 'کلید تنظیم شده' : 'Key configured',
      missing: isPersian ? 'کلید تنظیم نشده' : 'No key',
      tier: isPersian ? 'پرده' : 'Tier',
      provider: isPersian ? 'ارائه‌دهنده' : 'Provider',
      model: isPersian ? 'مدل اصلی' : 'Primary model',
      fallback: isPersian ? 'مدل جایگزین' : 'Fallback model',
      endpoint: isPersian ? 'نشانی سرویس' : 'Endpoint',
      temperature: isPersian ? 'دما' : 'Temperature',
      reasoning: isPersian ? 'شدت استدلال' : 'Reasoning effort',
      budget: isPersian ? 'بودجهٔ تفکر' : 'Thinking budget',
      sourceDefault: isPersian ? 'پیش‌فرض کد' : 'Code default',
      sourceDb: isPersian ? 'ذخیره‌شده' : 'Saved',
      repaired: isPersian ? 'مقدار نامعتبر بود و به پیش‌فرض بازگشت' : 'Invalid value — fell back to default',
      save: isPersian ? 'ذخیرهٔ تنظیمات' : 'Save routing',
      saving: isPersian ? 'در حال ذخیره...' : 'Saving...',
      reset: isPersian ? 'بازگشت به پیش‌فرض‌ها' : 'Reset to defaults',
      resetOne: isPersian ? 'بازگشت این پرده' : 'Reset tier',
      test: isPersian ? 'آزمایش اتصال' : 'Test connection',
      testing: isPersian ? 'در حال آزمایش...' : 'Testing...',
      credits: isPersian ? 'اعتبار' : 'credits',
      adminOnly: isPersian
        ? 'تغییر مسیر مدل‌ها فقط برای مدیر سامانه ممکن است.'
        : 'Only an admin can change the model routing.',
      saved: isPersian ? 'تنظیمات ذخیره شد.' : 'Routing saved.',
      resetDone: isPersian ? 'به پیش‌فرض‌ها بازگشت.' : 'Routing reset to defaults.',
      confirmProbe: isPersian
        ? 'این آزمایش یک درخواست کوچک واقعی به ارائه‌دهنده می‌فرستد (هزینهٔ ناچیز). ادامه می‌دهید؟'
        : 'This test sends one tiny real request to the provider (negligible cost). Continue?',
      perScene: isPersian ? 'به ازای هر صحنه' : 'per scene',
    }),
    [isPersian]
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/studio/narrator-models');
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error ?? 'Failed to load');
      const data = json.data as Payload;
      setPayload(data);
      setDraft(structuredClone(data.configs));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const canEdit = payload?.canEdit !== false;

  function patchTier(tier: Tier, patch: Partial<TierConfig>) {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [tier]: { ...prev[tier], ...patch } } as Record<Tier, TierConfig>;
      // Provider-specific fields only make sense for OpenAI-compatible routes.
      if (patch.provider && patch.provider !== 'aiprime' && patch.provider !== 'sinox') {
        next[tier] = {
          ...next[tier],
          endpoint: undefined,
          fallbackModel: undefined,
          reasoningEffort: undefined,
          thinkingBudgetTokens: undefined,
        };
      }
      return next;
    });
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    setFieldErrors({});
    try {
      const res = await fetch('/api/studio/narrator-models', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tiers: draft }),
      });
      const json = await res.json();
      if (!json?.success) {
        if (json?.fieldErrors) setFieldErrors(json.fieldErrors);
        throw new Error(json?.error ?? 'Save failed');
      }
      const data = json.data as Payload;
      setPayload(data);
      setDraft(structuredClone(data.configs));
      setNotice(t.saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function resetAll() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/studio/narrator-models', { method: 'DELETE' });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error ?? 'Reset failed');
      const data = json.data as Payload;
      setPayload(data);
      setDraft(structuredClone(data.configs));
      setNotice(t.resetDone);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reset failed');
    } finally {
      setSaving(false);
    }
  }

  function resetTier(tier: Tier) {
    if (!payload || !draft) return;
    const fallback = payload.defaults[tier];
    setDraft((prev) =>
      prev ? ({ ...prev, [tier]: { ...fallback, source: 'default' } } as Record<Tier, TierConfig>) : prev
    );
  }

  async function runProbe(tier: Tier) {
    if (!canEdit) return;
    const confirmed = await notify.confirm({
      title: isPersian ? 'آزمایش اتصال' : 'Test connection',
      message: t.confirmProbe,
      confirmText: isPersian ? 'آزمایش' : 'Test',
      cancelText: isPersian ? 'انصراف' : 'Cancel',
    });
    if (!confirmed) return;
    setProbing(tier);
    setProbe(null);
    setError(null);
    try {
      const res = await fetch('/api/studio/narrator-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });
      const json = await res.json();
      if (!json?.success) throw new Error(json?.error ?? 'Probe failed');
      setProbe(json.data as ProbeResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Probe failed');
    } finally {
      setProbing(null);
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-3 text-zinc-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        {isPersian ? 'در حال بارگذاری...' : 'Loading...'}
      </div>
    );
  }

  if (!payload || !draft) {
    return (
      <div className="p-8 text-sm text-rose-400 flex items-center gap-2">
        <XCircle className="w-4 h-4" />
        {error ?? (isPersian ? 'بارگذاری ناموفق بود.' : 'Failed to load.')}
      </div>
    );
  }

  const providerStatus = (p: Provider) => payload.providers.find((x) => x.provider === p);

  return (
    <div className="p-5 md:p-8 max-w-6xl mx-auto">
      <header className="mb-6 flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-sky-500/15 border border-sky-500/30">
          <Cpu className="w-5 h-5 text-sky-400" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-zinc-100">{t.heading}</h1>
          <p className="text-sm text-zinc-400 mt-1">{t.sub}</p>
        </div>
      </header>

      {/* Provider key status */}
      <section className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {payload.providers.map((p) => (
          <div
            key={p.provider}
            className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 flex items-center justify-between gap-2"
          >
            <div className="min-w-0">
              <div className="text-xs font-bold text-zinc-200 truncate">
                {isPersian ? p.label.fa : p.label.en}
              </div>
              <div className="text-[10.5px] text-zinc-500 font-mono">{p.provider}</div>
            </div>
            {p.configured ? (
              <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-lg shrink-0">
                <KeyRound className="w-3 h-3" />
                {t.configured}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-lg shrink-0">
                <AlertTriangle className="w-3 h-3" />
                {t.missing}
              </span>
            )}
          </div>
        ))}
      </section>

      {!canEdit && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200">
          <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{t.adminOnly}</span>
        </div>
      )}

      {error && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-200">
          <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-200">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Tier cards */}
      <div className="space-y-4">
        {TIER_ORDER.map((tier) => {
          const cfg = draft[tier];
          const meta = payload.tiers.find((x) => x.tier === tier);
          const isOpenAi = cfg.provider === 'aiprime' || cfg.provider === 'sinox';
          const supportsThinking = cfg.provider === 'sinox';
          const errs = fieldErrors[tier] ?? {};
          const status = providerStatus(cfg.provider);
          return (
            <section
              key={tier}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-zinc-100">
                  {meta?.label ? (isPersian ? meta.label.fa : meta.label.en) : tier}
                </h2>
                <span className="text-[10.5px] font-bold text-zinc-400 bg-zinc-800/70 border border-zinc-700 px-2 py-0.5 rounded-lg">
                  {meta?.cost ?? 1} {t.credits} {t.perScene}
                </span>
                <span className="text-[10.5px] font-mono text-zinc-500">{tier}</span>
                <span
                  className={`text-[10.5px] font-bold px-2 py-0.5 rounded-lg border ${
                    cfg.source === 'database'
                      ? 'text-sky-300 bg-sky-500/10 border-sky-500/30'
                      : 'text-zinc-400 bg-zinc-800/60 border-zinc-700'
                  }`}
                >
                  {cfg.source === 'database' ? t.sourceDb : t.sourceDefault}
                </span>
                {cfg.repaired && (
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-lg">
                    <AlertTriangle className="w-3 h-3" />
                    {t.repaired}
                  </span>
                )}
                <div className="flex-1" />
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => resetTier(tier)}
                  className="text-[11px] font-bold text-zinc-300 hover:text-zinc-100 border border-zinc-700 hover:border-zinc-500 rounded-lg px-2.5 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {t.resetOne}
                </button>
                <button
                  type="button"
                  disabled={!canEdit || probing === tier}
                  onClick={() => runProbe(tier)}
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-zinc-200 hover:text-white bg-zinc-800/70 hover:bg-zinc-700 border border-zinc-700 rounded-lg px-2.5 py-1 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {probing === tier ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Plug className="w-3 h-3" />
                  )}
                  {probing === tier ? t.testing : t.test}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[11px] font-bold text-zinc-400">{t.provider}</span>
                  <select
                    value={cfg.provider}
                    disabled={!canEdit}
                    onChange={(e) => patchTier(tier, { provider: e.target.value as Provider })}
                    className="mt-1 w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-sky-500 disabled:opacity-50"
                  >
                    {payload.providers.map((p) => (
                      <option key={p.provider} value={p.provider}>
                        {isPersian ? p.label.fa : p.label.en} · {p.provider}
                        {p.configured ? '' : ' (no key)'}
                      </option>
                    ))}
                  </select>
                  {status && !status.configured && (
                    <span className="mt-1 block text-[10.5px] text-amber-300">
                      {isPersian
                        ? 'برای این ارائه‌دهنده کلیدی تنظیم نشده — سردباش به مدل پیش‌فرض برمی‌گردد.'
                        : 'No API key for this provider — turns fall back to the default queue.'}
                    </span>
                  )}
                </label>

                <label className="block">
                  <span className="text-[11px] font-bold text-zinc-400">{t.model}</span>
                  <input
                    list={`narrator-models-${tier}`}
                    value={cfg.model}
                    disabled={!canEdit}
                    onChange={(e) => patchTier(tier, { model: e.target.value })}
                    className="mt-1 w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 font-mono focus:outline-none focus:border-sky-500 disabled:opacity-50"
                  />
                  <datalist id={`narrator-models-${tier}`}>
                    {MODEL_SUGGESTIONS[cfg.provider].map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                  {errs.model && <span className="mt-1 block text-[10.5px] text-rose-300">{errs.model}</span>}
                </label>

                {isOpenAi && (
                  <label className="block">
                    <span className="text-[11px] font-bold text-zinc-400">{t.fallback}</span>
                    <input
                      list={`narrator-fallback-${tier}`}
                      value={cfg.fallbackModel ?? ''}
                      disabled={!canEdit}
                      onChange={(e) => patchTier(tier, { fallbackModel: e.target.value })}
                      placeholder={isPersian ? 'اختیاری' : 'optional'}
                      className="mt-1 w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 font-mono focus:outline-none focus:border-sky-500 disabled:opacity-50"
                    />
                    <datalist id={`narrator-fallback-${tier}`}>
                      {MODEL_SUGGESTIONS[cfg.provider].map((m) => (
                        <option key={m} value={m} />
                      ))}
                    </datalist>
                    {errs.fallbackModel && (
                      <span className="mt-1 block text-[10.5px] text-rose-300">{errs.fallbackModel}</span>
                    )}
                  </label>
                )}

                {isOpenAi && (
                  <label className="block">
                    <span className="text-[11px] font-bold text-zinc-400">{t.endpoint}</span>
                    <input
                      value={cfg.endpoint ?? ''}
                      disabled={!canEdit}
                      onChange={(e) => patchTier(tier, { endpoint: e.target.value })}
                      placeholder={isPersian ? 'پیش‌فرض ارائه‌دهنده' : 'provider default'}
                      className="mt-1 w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 font-mono focus:outline-none focus:border-sky-500 disabled:opacity-50"
                    />
                    {errs.endpoint && (
                      <span className="mt-1 block text-[10.5px] text-rose-300">{errs.endpoint}</span>
                    )}
                  </label>
                )}

                <label className="block">
                  <span className="text-[11px] font-bold text-zinc-400">{t.temperature}</span>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="2"
                    value={cfg.temperature ?? ''}
                    disabled={!canEdit}
                    onChange={(e) =>
                      patchTier(tier, {
                        temperature:
                          e.target.value === '' ? undefined : Number(e.target.value),
                      })
                    }
                    placeholder="0.75"
                    className="mt-1 w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 font-mono focus:outline-none focus:border-sky-500 disabled:opacity-50"
                  />
                  {errs.temperature && (
                    <span className="mt-1 block text-[10.5px] text-rose-300">{errs.temperature}</span>
                  )}
                </label>

                {supportsThinking && (
                  <>
                    <label className="block">
                      <span className="text-[11px] font-bold text-zinc-400">{t.reasoning}</span>
                      <select
                        value={cfg.reasoningEffort ?? ''}
                        disabled={!canEdit}
                        onChange={(e) =>
                          patchTier(tier, {
                            reasoningEffort: (e.target.value || undefined) as
                              | 'low'
                              | 'medium'
                              | 'high'
                              | undefined,
                          })
                        }
                        className="mt-1 w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-sky-500 disabled:opacity-50"
                      >
                        <option value="">{isPersian ? 'پیش‌فرض' : 'default'}</option>
                        <option value="low">low</option>
                        <option value="medium">medium</option>
                        <option value="high">high</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-bold text-zinc-400">{t.budget}</span>
                      <input
                        type="number"
                        min="0"
                        max="32768"
                        step="256"
                        value={cfg.thinkingBudgetTokens ?? ''}
                        disabled={!canEdit}
                        onChange={(e) =>
                          patchTier(tier, {
                            thinkingBudgetTokens:
                              e.target.value === '' ? undefined : Number(e.target.value),
                          })
                        }
                        placeholder="1024"
                        className="mt-1 w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 font-mono focus:outline-none focus:border-sky-500 disabled:opacity-50"
                      />
                    </label>
                  </>
                )}
              </div>

              {probe?.tier === tier && (
                <div
                  className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${
                    probe.ok
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                      : 'border-rose-500/30 bg-rose-500/10 text-rose-200'
                  }`}
                >
                  {probe.ok ? (
                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  )}
                  <span>
                    {probe.ok
                      ? `${probe.modelUsed ?? cfg.model} · ${probe.latencyMs}ms`
                      : probe.error}
                  </span>
                </div>
              )}
            </section>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!canEdit || saving}
          onClick={save}
          className="inline-flex items-center gap-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl px-4 py-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? t.saving : t.save}
        </button>
        <button
          type="button"
          disabled={!canEdit || saving}
          onClick={resetAll}
          className="inline-flex items-center gap-2 text-xs font-bold text-zinc-200 bg-zinc-800/70 hover:bg-zinc-700 border border-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl px-4 py-2"
        >
          <RotateCcw className="w-4 h-4" />
          {t.reset}
        </button>
      </div>
    </div>
  );
}
