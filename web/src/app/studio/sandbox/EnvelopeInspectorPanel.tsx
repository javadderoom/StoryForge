'use client';

import React, { useMemo, useState } from 'react';
import {
  Boxes,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Filter,
  Loader2,
  Scissors,
} from 'lucide-react';
import { useStudioStory } from '@/lib/context/StudioStoryContext';
import type { NPCDossier, WorldLocation } from '@/lib/types/world';

/**
 * Plan 15 Phase 4 — Studio Context Envelope Inspector.
 * Rebuilds the exact play-time world-context envelope for a chosen
 * location / scope tier / party and lists every include, exclude, and
 * token-cap decision with its explicit reason. Author-only data: never wired
 * into reader responses.
 */

interface EnvelopeRecord {
  kind: string;
  id?: string;
  name?: string;
  reason: string;
}

interface EnvelopeResponse {
  success: boolean;
  error?: string;
  data?: {
    locationId: string;
    locationName?: string;
    scopeTier: string;
    elapsedMs: number;
    counts: { included: number; excluded: number; truncatedEntries: number; truncatedEntities: number };
    included: EnvelopeRecord[];
    excluded: EnvelopeRecord[];
    truncated: Array<{ kind: string; withheld: number; cap: number }>;
    sectionCounts: Record<string, number>;
    prompt: string;
  };
}

type ScopeTierLabel = 'street' | 'regional' | 'continental' | 'mythic';

export default function EnvelopeInspectorPanel() {
  const { story, isPersian } = useStudioStory();
  const [locationId, setLocationId] = useState('');
  const [scopeTier, setScopeTier] = useState<ScopeTierLabel>('regional');
  const [chapterTarget, setChapterTarget] = useState('');
  const [partyMemberIds, setPartyMemberIds] = useState<string[]>([]);
  const [result, setResult] = useState<EnvelopeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [listTab, setListTab] = useState<'both' | 'included' | 'excluded'>('both');

  const t = {
    heading: isPersian ? 'بازرس پاکت زمینه' : 'Context Envelope Inspector',
    desc: isPersian
      ? 'سازمان دقیق زمینه‌ای که نویسنده در هر نوبت می‌بیند — همراه با دلیل ورود، خروج یا تراش هر موجودیت.'
      : 'The exact world context the narrator builds each turn — with the reason every entity is included, excluded, or capped out.',
    empty: isPersian
      ? 'مکان و سطح دامنه را انتخاب کنید و «بررسی پاکت» را بزنید.'
      : 'Pick a location and scope tier, then inspect the envelope.',
    location: isPersian ? 'مکان صحنه' : 'Scene Location',
    scopeTierLabel: isPersian ? 'سطح دامنه' : 'Scope Tier',
    chapter: isPersian ? 'شماره فصل (اختیاری)' : 'Chapter # (optional)',
    party: isPersian ? 'گروه همراه' : 'Travelling Party',
    inspect: isPersian ? 'بررسی پاکت' : 'Inspect Envelope',
    net: isPersian ? 'زمان ساخت:' : 'Built in:',
    ms: isPersian ? 'میلی‌ثانیه' : 'ms',
    included: isPersian ? 'گنجانده شده' : 'Included',
    excluded: isPersian ? 'کنار گذاشته' : 'Excluded',
    both: isPersian ? 'هر دو' : 'Both',
    truncated: isPersian ? 'تراش سقف توکن' : 'Token Cap Truncation',
    withheld: isPersian ? 'عنصر مازاد' : 'withheld',
    noRecords: isPersian ? 'هیچ رکوردی ثبت نشد.' : 'No records for this selection.',
    promptPreview: isPersian ? 'پیش‌نمایش بلوک‌های پرامپت' : 'Prompt Block Preview',
    noTruncation: isPersian ? 'هیچ عنصری تراش نخورد.' : 'Nothing was capped.',
    draftWarning: isPersian
      ? 'بازرس، نسخه ذخیره‌شده روی سرور را بازسازی می‌کند؛ تغییرات ذخیره‌نشده را ابتدا sync کنید.'
      : 'The inspector rebuilds the last server-synced copy — sync unsaved edits first.',
  };

  const locations: WorldLocation[] = story.worldBible?.locations ?? [];
  const effectiveLocationId =
    locationId ||
    story.initialStoryBeats?.find((b) => typeof b.locationId === 'string' && b.locationId)
      ?.locationId ||
    locations[0]?.id ||
    '';

  const npcs = useMemo(() => (story.worldBible?.npcs ?? []).slice(0, 200) as NPCDossier[], [story.worldBible]);

  const togglePartyMember = (npcId: string) => {
    setPartyMemberIds((prev) =>
      prev.includes(npcId) ? prev.filter((id) => id !== npcId) : [...prev, npcId]
    );
  };

  const handleInspect = async () => {
    if (!story.id || !effectiveLocationId) return;
    setLoading(true);
    try {
      const chapterNumber = parseInt(chapterTarget, 10);
      const res = await fetch('/api/studio/sandbox/envelope', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyId: story.id,
          locationId: effectiveLocationId,
          scopeTier,
          chapterNumber: Number.isFinite(chapterNumber) ? chapterNumber : undefined,
          accompanyingNpcIds: partyMemberIds,
        }),
      });
      setResult((await res.json()) as EnvelopeResponse);
    } catch (err) {
      setResult({ success: false, error: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  };

  const data = result?.data;

  return (
    <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 md:p-8 shadow-xl space-y-5">
      <div className="flex items-start gap-3">
        <Filter className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
        <div>
          <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider">{t.heading}</h3>
          <p className="text-xs text-zinc-400 leading-relaxed mt-1">{t.desc}</p>
        </div>
      </div>

      {!story.id && <p className="text-xs text-amber-400/90">{t.empty}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">{t.location}</label>
          <select
            value={effectiveLocationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500/60"
          >
            {locations.map((l: WorldLocation) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">{t.scopeTierLabel}</label>
          <select
            value={scopeTier}
            onChange={(e) => setScopeTier(e.target.value as ScopeTierLabel)}
            className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500/60"
          >
            {(['street', 'regional', 'continental', 'mythic'] as ScopeTierLabel[]).map((tier) => (
              <option key={tier} value={tier}>
                {tier}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">{t.chapter}</label>
          <input
            type="number"
            min={1}
            value={chapterTarget}
            onChange={(e) => setChapterTarget(e.target.value)}
            className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500/60"
          />
        </div>
      </div>

      {npcs.length > 0 && (
        <div>
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">{t.party}</label>
          <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
            {npcs.map((n: NPCDossier) => {
              const active = partyMemberIds.includes(n.id);
              return (
                <button
                  key={n.id}
                  onClick={() => togglePartyMember(n.id)}
                  className={`text-[11px] px-2.5 py-1 rounded-xl border transition-all cursor-pointer ${
                    active
                      ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
                      : 'bg-zinc-800/70 text-zinc-400 border-zinc-700/60 hover:bg-zinc-700/70'
                  }`}
                >
                  {n.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button
        onClick={handleInspect}
        disabled={loading || !story.id}
        className="bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-400 hover:to-sky-500 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-2xl shadow-lg shadow-cyan-500/20 transition-all inline-flex items-center gap-2 cursor-pointer"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Boxes className="w-4 h-4" />}
        {t.inspect}
      </button>

      <p className="text-[10px] text-zinc-500">{t.draftWarning}</p>

      {result && !result.success && (
        <p className="text-xs text-rose-400">{result.error}</p>
      )}

      {data && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-400">
            <span className="font-mono text-cyan-400">
              {t.net} {data.elapsedMs}
              {t.ms}
            </span>
            <span className="text-emerald-400">
              {t.included}: {data.counts.included}
            </span>
            <span className="text-rose-400">
              {t.excluded}: {data.counts.excluded}
            </span>
            {data.counts.truncatedEntities > 0 && (
              <span className="text-amber-400">
                {t.truncated}: {data.counts.truncatedEntities} {t.withheld}
              </span>
            )}
          </div>

          <div className="flex gap-2">
            {(['both', 'included', 'excluded'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setListTab(tab)}
                className={`text-[10px] uppercase font-bold px-3 py-1 rounded-xl border transition-all cursor-pointer ${
                  listTab === tab
                    ? 'bg-zinc-700 text-zinc-100 border-zinc-600'
                    : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:bg-zinc-800'
                }`}
              >
                {tab === 'both' ? t.both : tab === 'included' ? t.included : t.excluded}
              </button>
            ))}
          </div>

          {listTab !== 'excluded' && (
            <RecordList title={t.included} records={data.included} tone="emerald" emptyText={t.noRecords} />
          )}
          {listTab !== 'included' && (
            <RecordList title={t.excluded} records={data.excluded} tone="rose" emptyText={t.noRecords} />
          )}

          <TruncationSummary
            truncated={data.truncated}
            title={t.truncated}
            emptyText={t.noTruncation}
            withheldLabel={t.withheld}
          />

          <button
            onClick={() => setShowPrompt((s) => !s)}
            className="inline-flex items-center gap-2 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          >
            {showPrompt ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            <ClipboardList className="w-3.5 h-3.5" />
            {t.promptPreview}
          </button>
          {showPrompt && (
            <pre className="bg-zinc-950/90 border border-zinc-800 rounded-2xl p-4 text-[10px] leading-relaxed text-zinc-300 whitespace-pre-wrap max-h-96 overflow-y-auto font-mono">
              {data.prompt}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function RecordList({
  title,
  records,
  tone,
  emptyText,
}: {
  title: string;
  records: EnvelopeRecord[];
  tone: 'emerald' | 'rose';
  emptyText: string;
}) {
  if (records.length === 0) {
    return (
      <div>
        <h4 className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${tone === 'emerald' ? 'text-emerald-400' : 'text-rose-400'}`}>
          {title}
        </h4>
        <p className="text-[11px] text-zinc-500">{emptyText}</p>
      </div>
    );
  }
  return (
    <div>
      <h4 className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${tone === 'emerald' ? 'text-emerald-400' : 'text-rose-400'}`}>
        {title} ({records.length})
      </h4>
      <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
        {records.map((rec, i) => (
          <div
            key={`${rec.kind}-${rec.id ?? i}-${i}`}
            className={`p-2.5 rounded-xl border text-[11px] leading-snug ${
              tone === 'emerald'
                ? 'bg-emerald-500/5 border-emerald-500/20 text-zinc-300'
                : 'bg-rose-500/5 border-rose-500/20 text-zinc-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`text-[9px] font-mono uppercase ${tone === 'emerald' ? 'text-emerald-500' : 'text-rose-500'}`}>
                {rec.kind}
              </span>
              <span className="font-semibold text-zinc-200">{rec.name ?? rec.id}</span>
            </div>
            <p className="text-zinc-400 mt-0.5">{rec.reason}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TruncationSummary({
  truncated,
  title,
  emptyText,
  withheldLabel,
}: {
  truncated: Array<{ kind: string; withheld: number; cap: number }>;
  title: string;
  emptyText: string;
  withheldLabel: string;
}) {
  return (
    <div>
      <h4 className="text-[10px] font-bold uppercase tracking-wider mb-2 text-amber-400">
        <Scissors className="w-3 h-3 inline mr-1" />
        {title}
      </h4>
      {truncated.length === 0 ? (
        <p className="text-[11px] text-zinc-500">{emptyText}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {truncated.map((t, i) => (
            <span
              key={`${t.kind}-${i}`}
              className="text-[10px] px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono"
            >
              {t.kind}: −{t.withheld} ({t.cap} {withheldLabel})
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
