'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  Check,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp,
  MapPin,
  Lock,
  ArrowRight,
  Shield,
  Zap,
  Sword,
  Target,
  Layers,
  Sparkle,
  SunMedium,
} from 'lucide-react';
import { WeavedBeat, WeaveQualityReport, WeaveItemKind } from '@/lib/engines/narrative/storyWeaver';
import { StoryManifest } from '@/lib/types';
import { notify } from '@/lib/notify';
import { buildWorldContextString } from '@/lib/engines/narrative/worldContext';

interface StoryWeavePreviewModalProps {
  open: boolean;
  isPersian: boolean;
  scope: 'act' | 'whole_arc';
  weavedBeats: WeavedBeat[];
  qualityReport?: WeaveQualityReport;
  story: StoryManifest;
  onClose: () => void;
  onCommit: (selectedBeats: WeavedBeat[]) => void;
}

export default function StoryWeavePreviewModal({
  open,
  isPersian,
  scope,
  weavedBeats: initialBeats,
  qualityReport,
  story,
  onClose,
  onCommit,
}: StoryWeavePreviewModalProps) {
  const [beats, setBeats] = useState<WeavedBeat[]>(initialBeats);
  const [selectedBeatIds, setSelectedBeatIds] = useState<Set<string>>(
    () => new Set(initialBeats.map((b) => b.sceneId))
  );
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [showFindings, setShowFindings] = useState(false);
  const [expandedBeatIds, setExpandedBeatIds] = useState<Set<string>>(new Set());

  // Keep local beats in sync if initialBeats changes
  React.useEffect(() => {
    setBeats(initialBeats);
    setSelectedBeatIds(new Set(initialBeats.map((b) => b.sceneId)));
  }, [initialBeats]);

  const locationMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const loc of story.worldBible?.locations || []) {
      map.set(loc.id, loc.name);
    }
    return map;
  }, [story]);

  if (!open) return null;

  const t = isPersian
    ? {
        title: 'پیش‌نمایش تار و پود داستان (Story-Weaver)',
        scopeAct: 'محدوده: پرده / فصل فعال',
        scopeArc: 'محدوده: کل کمان داستان',
        scoreLabel: 'امتیاز کیفیت ساختار:',
        viewFindings: 'مشاهده گزارش اعتبارسنجی',
        hideFindings: 'بستن گزارش اعتبارسنجی',
        selectAll: 'انتخاب همه',
        deselectAll: 'لغو انتخاب همه',
        selectedCount: (sel: number, total: number) => `${sel} از ${total} صحنه انتخاب شده`,
        anchorBadge: '🔷 تکیه‌گاه (دست‌نخورده)',
        bridgeBadge: '🔶 پل روایی',
        expansionBadge: '🟣 توسعه و اوج',
        openerBadge: '🌅 صحنه آغازین',
        regenerate: 'بازنویسی پل',
        regenerating: 'در حال بازنویسی...',
        commit: (count: number) => `تأیید و تزریق ${count} صحنه به داستان`,
        cancel: 'انصراف',
        choices: 'انتخاب‌ها:',
        introductions: 'معرفی اولیه:',
        resolves: 'پیوستگی روایی:',
        dcText: (dc: number, stat?: string) => `تاس سختی ${dc}${stat ? ` (${stat})` : ''}`,
      }
    : {
        title: 'Story-Weaver Preview & Graph Diff',
        scopeAct: 'Scope: Active Act / Chapter',
        scopeArc: 'Scope: Whole Story Arc',
        scoreLabel: 'Weave Quality Score:',
        viewFindings: 'View Quality Audit Findings',
        hideFindings: 'Hide Quality Audit Findings',
        selectAll: 'Select All',
        deselectAll: 'Deselect All',
        selectedCount: (sel: number, total: number) => `${sel} of ${total} beats selected`,
        anchorBadge: '🔷 Anchor (Verbatim)',
        bridgeBadge: '🔶 Bridge',
        expansionBadge: '🟣 Expansion',
        openerBadge: '🌅 Opener',
        regenerate: 'Regenerate Bridge',
        regenerating: 'Regenerating...',
        commit: (count: number) => `Commit ${count} Weaved Beats`,
        cancel: 'Cancel',
        choices: 'Choices:',
        introductions: 'First Introductions:',
        resolves: 'Narrative Continuity:',
        dcText: (dc: number, stat?: string) => `DC ${dc}${stat ? ` (${stat})` : ''}`,
      };

  const toggleSelectBeat = (sceneId: string) => {
    setSelectedBeatIds((prev) => {
      const next = new Set(prev);
      if (next.has(sceneId)) {
        next.delete(sceneId);
      } else {
        next.add(sceneId);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedBeatIds(new Set(beats.map((b) => b.sceneId)));
  };

  const deselectAll = () => {
    setSelectedBeatIds(new Set());
  };

  const toggleExpandBeat = (sceneId: string) => {
    setExpandedBeatIds((prev) => {
      const next = new Set(prev);
      if (next.has(sceneId)) {
        next.delete(sceneId);
      } else {
        next.add(sceneId);
      }
      return next;
    });
  };

  const handleRegenerateBridge = async (targetBeat: WeavedBeat, index: number) => {
    if (regeneratingId) return;
    setRegeneratingId(targetBeat.sceneId);

    const predecessor = index > 0 ? beats[index - 1] : null;
    const successor = index < beats.length - 1 ? beats[index + 1] : null;

    try {
      const prompt =
        `Write a vivid narrative bridge scene connecting two beats.\n` +
        `Preceding scene summary: "${predecessor?.narrativeText?.slice(0, 250) || 'Story beginning'}"\n` +
        `Succeeding scene summary: "${successor?.narrativeText?.slice(0, 250) || 'Story climax'}"\n` +
        `Bridge objective: "${targetBeat.title || targetBeat.carryoverSummary || 'Bridge connection'}".\n` +
        `Ensure choices lead logically towards the succeeding scene (leadToSceneId: "${successor?.sceneId || ''}").`;

      const res = await fetch('/api/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'scene',
          taskType: 'scene',
          prompt,
          themeContext: story.worldBible.themeNotes,
          worldContext: buildWorldContextString(story),
          isPersian,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        const generated = json.data;
        setBeats((prev) =>
          prev.map((b) => {
            if (b.sceneId !== targetBeat.sceneId) return b;
            return {
              ...b,
              narrativeText: generated.narrativeText || b.narrativeText,
              choices: (generated.choices || []).map((c: any, cIdx: number) => ({
                id: `choice_${b.sceneId}_${cIdx + 1}`,
                text: c.text || 'Continue onward',
                style: c.style || 'defensive',
                riskLevel: c.riskLevel || 'low',
                targetDC: c.targetDC,
                requiredStatId: c.requiredStatId,
                targetSceneId: c.targetSceneId || successor?.sceneId,
              })),
            };
          })
        );
        notify.success(isPersian ? 'پل روایی با موفقیت بازنویسی شد' : 'Bridge beat regenerated successfully');
      } else {
        notify.error(isPersian ? 'خطا در بازنویسی پل' : 'Failed to regenerate bridge beat');
      }
    } catch {
      notify.error(isPersian ? 'خطا در اتصال به هوش مصنوعی' : 'AI connection error');
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleCommit = () => {
    const selected = beats.filter((b) => selectedBeatIds.has(b.sceneId));
    if (selected.length === 0) {
      notify.info(isPersian ? 'حداقل یک صحنه را انتخاب کنید' : 'Please select at least one beat');
      return;
    }
    onCommit(selected);
  };

  const score = qualityReport?.score ?? 85;
  const scoreColor =
    score >= 80
      ? 'text-emerald-400 bg-emerald-950/60 border-emerald-500/40'
      : score >= 65
      ? 'text-amber-400 bg-amber-950/60 border-amber-500/40'
      : 'text-rose-400 bg-rose-950/60 border-rose-500/40';

  const getKindBadge = (kind: WeaveItemKind) => {
    switch (kind) {
      case 'anchor':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-cyan-950/80 border border-cyan-500/40 text-cyan-300">
            <Lock className="w-3 h-3 text-cyan-400" />
            {t.anchorBadge}
          </span>
        );
      case 'bridge':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-amber-950/80 border border-amber-500/40 text-amber-300">
            <Sparkles className="w-3 h-3 text-amber-400" />
            {t.bridgeBadge}
          </span>
        );
      case 'expansion':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-purple-950/80 border border-purple-500/40 text-purple-300">
            <Layers className="w-3 h-3 text-purple-400" />
            {t.expansionBadge}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 md:p-6 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-zinc-900 border border-amber-500/30 rounded-3xl p-5 md:p-7 max-w-5xl w-full shadow-2xl flex flex-col max-h-[92vh] text-xs">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-800 pb-4 shrink-0">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h3 className="text-base md:text-lg font-bold text-zinc-100">{t.title}</h3>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-md bg-zinc-800 text-zinc-300 font-medium text-[11px]">
                {scope === 'act' ? t.scopeAct : t.scopeArc}
              </span>
              {qualityReport && (
                <div className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full border text-[11px] font-bold ${scoreColor}`}>
                  <span>{t.scoreLabel}</span>
                  <span className="font-mono text-sm">{score}/100</span>
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1.5 rounded-xl hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quality Findings Banner (Collapsible) */}
        {qualityReport && qualityReport.findings.length > 0 && (
          <div className="mt-3 bg-zinc-950 border border-zinc-800 rounded-2xl p-3 shrink-0">
            <button
              type="button"
              onClick={() => setShowFindings(!showFindings)}
              className="w-full flex items-center justify-between text-zinc-300 hover:text-white text-xs font-semibold cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>
                  {showFindings ? t.hideFindings : t.viewFindings} ({qualityReport.findings.length})
                </span>
              </span>
              {showFindings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showFindings && (
              <div className="mt-2.5 space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {qualityReport.findings.map((f, i) => (
                  <div
                    key={i}
                    className={`p-2 rounded-xl border flex items-start gap-2 text-[11px] leading-relaxed ${
                      f.severity === 'error'
                        ? 'bg-rose-950/40 border-rose-500/30 text-rose-200'
                        : f.severity === 'warning'
                        ? 'bg-amber-950/40 border-amber-500/30 text-amber-200'
                        : 'bg-sky-950/40 border-sky-500/30 text-sky-200'
                    }`}
                  >
                    {f.severity === 'error' ? (
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                    ) : f.severity === 'warning' ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    ) : (
                      <Info className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <strong className="font-semibold block">{f.title}</strong>
                      <span className="opacity-90">{f.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Selection & Controls Bar */}
        <div className="flex items-center justify-between py-3 border-b border-zinc-800 shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-semibold transition cursor-pointer"
            >
              {t.selectAll}
            </button>
            <button
              type="button"
              onClick={deselectAll}
              className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-semibold transition cursor-pointer"
            >
              {t.deselectAll}
            </button>
            <span className="text-[11px] text-zinc-400">
              {t.selectedCount(selectedBeatIds.size, beats.length)}
            </span>
          </div>
        </div>

        {/* Beats List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1.5">
          {beats.map((beat, idx) => {
            const isSelected = selectedBeatIds.has(beat.sceneId);
            const isOpener = idx === 0 || beat.order === 0;
            const isRegenerating = regeneratingId === beat.sceneId;
            const isExpanded = expandedBeatIds.has(beat.sceneId);
            const locName = locationMap.get(beat.locationId) || beat.locationId;

            return (
              <div
                key={beat.sceneId}
                className={`p-4 rounded-2xl border transition-all ${
                  isSelected
                    ? beat.kind === 'anchor'
                      ? 'bg-zinc-950/90 border-cyan-500/40 shadow-sm'
                      : beat.kind === 'bridge'
                      ? 'bg-zinc-950/90 border-amber-500/40 shadow-sm'
                      : 'bg-zinc-950/90 border-purple-500/40 shadow-sm'
                    : 'bg-zinc-950/40 border-zinc-800/70 opacity-60'
                }`}
              >
                {/* Top Row: Checkbox, Kind, Opener, Location, Actions */}
                <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectBeat(beat.sceneId)}
                      className="w-4 h-4 rounded text-amber-500 focus:ring-0 cursor-pointer accent-amber-500"
                    />
                    <span className="font-mono text-[11px] text-zinc-400 font-bold">
                      #{idx + 1}
                    </span>
                    {getKindBadge(beat.kind)}
                    {isOpener && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-950/80 border border-emerald-500/40 text-emerald-300">
                        <SunMedium className="w-3 h-3 text-emerald-400" />
                        {t.openerBadge}
                      </span>
                    )}
                    <h4 className="font-bold text-zinc-100 text-xs">
                      {beat.title || beat.sceneId}
                    </h4>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400 bg-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-800">
                      <MapPin className="w-3 h-3 text-sky-400" />
                      {locName}
                    </span>

                    {beat.kind !== 'anchor' && (
                      <button
                        type="button"
                        disabled={isRegenerating}
                        onClick={() => handleRegenerateBridge(beat, idx)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-300 text-[10.5px] font-semibold transition border border-amber-500/20 disabled:opacity-50 cursor-pointer"
                        title={t.regenerate}
                      >
                        <RefreshCw className={`w-3 h-3 ${isRegenerating ? 'animate-spin' : ''}`} />
                        <span>{isRegenerating ? t.regenerating : t.regenerate}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Carryover summary */}
                {beat.carryoverSummary && (
                  <div className="mb-2 px-3 py-1.5 rounded-xl bg-amber-950/20 border border-amber-500/20 text-[11px] text-amber-200/90 italic flex items-center gap-1.5">
                    <ArrowRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>
                      <strong>{t.resolves}</strong> {beat.carryoverSummary}
                    </span>
                  </div>
                )}

                {/* Introduced entities */}
                {beat.introducedEntityNames && beat.introducedEntityNames.length > 0 && (
                  <div className="mb-2 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-purple-300 font-bold flex items-center gap-1">
                      <Sparkle className="w-3 h-3 text-purple-400" />
                      {t.introductions}
                    </span>
                    {beat.introducedEntityNames.map((name, eIdx) => (
                      <span
                        key={eIdx}
                        className="px-2 py-0.5 rounded-md bg-purple-950/60 border border-purple-500/30 text-purple-200 text-[10px]"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Narrative Text */}
                <div className="relative mb-3">
                  <p className="text-zinc-300 text-xs leading-relaxed whitespace-pre-line font-serif">
                    {isExpanded || beat.narrativeText.length <= 260
                      ? beat.narrativeText
                      : `${beat.narrativeText.slice(0, 260)}...`}
                  </p>
                  {beat.narrativeText.length > 260 && (
                    <button
                      type="button"
                      onClick={() => toggleExpandBeat(beat.sceneId)}
                      className="mt-1 text-[10.5px] font-bold text-amber-400 hover:text-amber-300 cursor-pointer"
                    >
                      {isExpanded ? (isPersian ? 'نمایش کمتر' : 'Show less') : (isPersian ? 'ادامه متن...' : 'Read full text...')}
                    </button>
                  )}
                </div>

                {/* Choices */}
                {beat.choices && beat.choices.length > 0 && (
                  <div className="pt-2 border-t border-zinc-900 space-y-1.5">
                    <span className="text-[10px] font-bold text-zinc-500 block">
                      {t.choices} ({beat.choices.length})
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                      {beat.choices.map((c, cIdx) => (
                        <div
                          key={cIdx}
                          className="p-2 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-start justify-between gap-2 text-[11px]"
                        >
                          <div className="flex-1 min-w-0">
                            <span className="text-zinc-200 font-medium block truncate">
                              {c.text}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              {c.targetDC ? (
                                <span className="px-1.5 py-0.2 rounded bg-amber-950/60 border border-amber-500/30 text-amber-300 text-[9.5px] font-mono">
                                  {t.dcText(c.targetDC, c.requiredStatId)}
                                </span>
                              ) : (
                                <span className="text-zinc-500 text-[9.5px]">
                                  {isPersian ? 'بدون تاس (انتخاب روایی)' : 'Diceless narrative'}
                                </span>
                              )}
                            </div>
                          </div>
                          {c.targetSceneId && (
                            <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[9.5px] font-mono text-sky-400 shrink-0" dir="ltr">
                              → {c.targetSceneId}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition cursor-pointer"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={handleCommit}
            disabled={selectedBeatIds.size === 0}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-zinc-950 text-xs font-bold shadow-lg shadow-amber-500/20 flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{t.commit(selectedBeatIds.size)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
