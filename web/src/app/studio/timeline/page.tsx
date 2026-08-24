'use client';

import React, { useState } from 'react';
import { useStudioStory } from '@/lib/context/StudioStoryContext';
import {
  Clock,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  Layers,
  Sparkles,
  Shield,
  MapPin,
  Lock,
  Eye,
  EyeOff,
  Flame,
  Crown,
  History,
  X,
  Check,
  Waves,
  Zap,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  BookOpen,
} from 'lucide-react';
import {
  TimelineEvent,
  EpochArc,
  TimelineRipple,
  TimelineRippleRepercussion,
} from '@/lib/types';
import { notify } from '@/lib/notify';
import AiFillSection from '@/components/studio/AiFillSection';
import { buildWorldContextString } from '@/lib/engines/narrative/worldContext';

export default function TimelineStudioPage() {
  const {
    story,
    isPersian,
    addTimelineEvent,
    editTimelineEvent,
    deleteTimelineEvent,
  } = useStudioStory();

  const [filterEra, setFilterEra] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  // Form State
  const [eventTitle, setEventTitle] = useState('');
  const [eventYear, setEventYear] = useState('');
  const [eventCategory, setEventCategory] = useState<'ancient' | 'war' | 'reign' | 'cataclysm' | 'present'>('ancient');
  const [eventSummary, setEventSummary] = useState('');
  const [eventSignificance, setEventSignificance] = useState('');
  const [eventIsPublic, setEventIsPublic] = useState(true);
  const [eventSecretDetails, setEventSecretDetails] = useState('');
  const [eventLinkedFactions, setEventLinkedFactions] = useState<string[]>([]);
  const [eventLinkedLocations, setEventLinkedLocations] = useState<string[]>([]);

  // Plan 05 State: Epoch Arc & Timeline Ripples
  const [generatingEpochArc, setGeneratingEpochArc] = useState(false);
  const [epochArcPreview, setEpochArcPreview] = useState<EpochArc | null>(null);

  const [generatingRippleEventId, setGeneratingRippleEventId] = useState<string | null>(null);
  const [ripplePreview, setRipplePreview] = useState<{
    targetEvent: TimelineEvent;
    ripple: TimelineRipple;
  } | null>(null);

  const [expandedRippleIds, setExpandedRippleIds] = useState<Set<string>>(new Set());

  const timeline = story.worldBible.timeline || [];
  const factions = story.worldBible.factions || [];
  const locations = story.worldBible.locations || [];

  const filteredTimeline = timeline.filter((evt) => {
    if (filterEra === 'all') return true;
    if (filterEra === 'secret') return !evt.knownByPublic;
    if (filterEra === 'public') return evt.knownByPublic;
    return evt.eraCategory === filterEra;
  });

  const toggleRippleExpand = (id: string) => {
    setExpandedRippleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleOpenAddModal = () => {
    setEditingEventId(null);
    setEventTitle('');
    setEventYear('');
    setEventCategory('ancient');
    setEventSummary('');
    setEventSignificance('');
    setEventIsPublic(true);
    setEventSecretDetails('');
    setEventLinkedFactions([]);
    setEventLinkedLocations([]);
    setShowAddModal(true);
  };

  const handleOpenEditModal = (evt: TimelineEvent) => {
    setEditingEventId(evt.id);
    setEventTitle(evt.title);
    setEventYear(evt.yearOrEra);
    setEventCategory((evt.eraCategory as any) || 'ancient');
    setEventSummary(evt.summary);
    setEventSignificance(evt.significance || '');
    setEventIsPublic(evt.knownByPublic);
    setEventSecretDetails(evt.secretDetails || '');
    setEventLinkedFactions(evt.linkedFactionIds || []);
    setEventLinkedLocations(evt.linkedLocationIds || []);
    setShowAddModal(true);
  };

  const handleSaveEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim() || !eventYear.trim()) {
      notify.error(isPersian ? 'عنوان رویداد و زمان آن الزامی است' : 'Event title and year/era are required');
      return;
    }

    const payload: TimelineEvent = {
      id: editingEventId || `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      yearOrEra: eventYear.trim(),
      title: eventTitle.trim(),
      summary: eventSummary.trim(),
      significance: eventSignificance.trim(),
      knownByPublic: eventIsPublic,
      eraCategory: eventCategory,
      secretDetails: eventSecretDetails.trim() || undefined,
      linkedFactionIds: eventLinkedFactions.length > 0 ? eventLinkedFactions : undefined,
      linkedLocationIds: eventLinkedLocations.length > 0 ? eventLinkedLocations : undefined,
    };

    if (editingEventId) {
      editTimelineEvent(editingEventId, payload);
      notify.success(isPersian ? 'رویداد تاریخی ویرایش شد' : 'Historical event updated');
    } else {
      addTimelineEvent(payload);
      notify.success(isPersian ? 'رویداد جدید به گاه‌شمار افزوده شد' : 'Added event to chronicle');
    }

    setShowAddModal(false);
  };

  const handleDeleteEvent = async (evt: TimelineEvent) => {
    const confirmed = await notify.confirm({
      title: isPersian ? 'حذف واقعه تاریخی' : 'Delete Chronicle Event',
      message: isPersian
        ? `آیا از حذف واقعه "${evt.title}" اطمینان دارید؟`
        : `Are you sure you want to delete "${evt.title}" from the world chronicle?`,
      confirmText: isPersian ? 'حذف شود' : 'Delete',
      cancelText: isPersian ? 'انصراف' : 'Cancel',
      isDestructive: true,
    });

    if (confirmed) {
      deleteTimelineEvent(evt.id);
    }
  };

  const applyAiFill = (data: Record<string, unknown>) => {
    if (data.title) setEventTitle(data.title as string);
    if (data.yearOrEra) setEventYear(data.yearOrEra as string);
    if (data.eraCategory) setEventCategory(data.eraCategory as any);
    if (data.summary) setEventSummary(data.summary as string);
    if (data.significance) setEventSignificance(data.significance as string);
    if (data.secretDetails) setEventSecretDetails(data.secretDetails as string);
  };

  // ----------------------------------------------------------------
  // Plan 05: 3-Era Epoch Arc Synthesizer
  // ----------------------------------------------------------------
  const handleGenerateEpochArc = async () => {
    try {
      setGeneratingEpochArc(true);
      const worldContext = buildWorldContextString(story);
      const res = await fetch('/api/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'epoch_arc',
          prompt: 'Synthesize a cohesive 3-era historical macro-arc (Mythic Dawn, Great Cataclysm, Present Ash Age) with 4+ turning point events.',
          themeContext: story.worldBible.themeNotes,
          worldContext,
          isPersian,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to generate epoch arc (${res.status})`);
      }

      const json = await res.json();
      if (json.data && Array.isArray(json.data.eras) && Array.isArray(json.data.keyEvents)) {
        setEpochArcPreview(json.data);
      } else {
        notify.error(isPersian ? 'قالب کلان‌تاریخ معتبر نبود' : 'Invalid epoch arc format');
      }
    } catch (err: any) {
      notify.error(err.message || 'Error generating epoch arc');
    } finally {
      setGeneratingEpochArc(false);
    }
  };

  const handleCommitEpochArc = () => {
    if (!epochArcPreview) return;
    let addedCount = 0;
    for (const kEvt of epochArcPreview.keyEvents) {
      const payload: TimelineEvent = {
        id: `evt_arc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        yearOrEra: kEvt.eraName,
        title: kEvt.title,
        summary: kEvt.narrativeSummary,
        significance: kEvt.lastingConsequences,
        knownByPublic: true,
        eraCategory: kEvt.eraName.toLowerCase().includes('dawn') || kEvt.eraName.toLowerCase().includes('creation')
          ? 'ancient'
          : kEvt.eraName.toLowerCase().includes('cataclysm') || kEvt.eraName.toLowerCase().includes('war')
          ? 'cataclysm'
          : 'present',
      };
      addTimelineEvent(payload);
      addedCount++;
    }
    setEpochArcPreview(null);
    notify.success(
      isPersian
        ? `${addedCount} رویداد کلیدی از کلان‌تاریخ ۳ عصری به گاه‌شمار افزوده شد`
        : `Committed ${addedCount} key events from 3-era epoch arc to chronicle`
    );
  };

  // ----------------------------------------------------------------
  // Plan 05: Timeline Ripple Propagator
  // ----------------------------------------------------------------
  const handleGenerateTimelineRipples = async (evt: TimelineEvent) => {
    try {
      setGeneratingRippleEventId(evt.id);
      const worldContext = buildWorldContextString(story);
      const res = await fetch('/api/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'timeline_ripple',
          prompt: `Propagate modern cascading repercussions across existing factions, sacred locations, relics, or faith schisms resulting from historical event: "${evt.title}" (${evt.yearOrEra}). Summary: ${evt.summary}.`,
          themeContext: story.worldBible.themeNotes,
          worldContext,
          isPersian,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to propagate ripples (${res.status})`);
      }

      const json = await res.json();
      if (json.data && Array.isArray(json.data.modernRepercussions)) {
        setRipplePreview({
          targetEvent: evt,
          ripple: json.data,
        });
      } else {
        notify.error(isPersian ? 'قالب پیامدهای تاریخی معتبر نبود' : 'Invalid ripple repercussions format');
      }
    } catch (err: any) {
      notify.error(err.message || 'Error propagating timeline ripples');
    } finally {
      setGeneratingRippleEventId(null);
    }
  };

  const handleCommitRipples = () => {
    if (!ripplePreview) return;
    editTimelineEvent(ripplePreview.targetEvent.id, {
      ripples: ripplePreview.ripple.modernRepercussions,
    });
    setExpandedRippleIds((prev) => new Set(prev).add(ripplePreview.targetEvent.id));
    setRipplePreview(null);
    notify.success(
      isPersian
        ? 'موج پیامدهای تاریخی این واقعه ثبت شد'
        : 'Modern repercussions saved to event'
    );
  };

  const getEraBadge = (era?: string) => {
    switch (era) {
      case 'ancient':
        return { label: isPersian ? 'عصر کهن و اساطیر' : 'Ancient / Mythic', color: 'text-amber-300 bg-amber-500/10 border-amber-500/30' };
      case 'war':
        return { label: isPersian ? 'جنگ و بحران' : 'War / Crisis', color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' };
      case 'reign':
        return { label: isPersian ? 'دوران سلطنت' : 'Reign / Golden Era', color: 'text-purple-300 bg-purple-500/10 border-purple-500/30' };
      case 'cataclysm':
        return { label: isPersian ? 'فاجعه و رخداد شوم' : 'Cataclysm / Anomaly', color: 'text-red-400 bg-red-500/10 border-red-500/30' };
      case 'present':
        return { label: isPersian ? 'دوران معاصر' : 'Present Era', color: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' };
      default:
        return { label: era || (isPersian ? 'نامشخص' : 'General'), color: 'text-zinc-400 bg-zinc-800 border-zinc-700' };
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-sm shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Clock className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl md:text-2xl font-bold text-zinc-100">
              {isPersian ? 'گاه‌شمار و کلان‌تاریخ جهان' : 'Chronicles & Historical Macro-Arc'}
            </h2>
          </div>
          <p className="text-sm text-zinc-400">
            {isPersian
              ? 'سنتز اعصار تاریخی سه‌گانه، ثبت وقایع کهن، و ردیابی موج پیامدهای تاریخی بر جهان امروز'
              : 'Synthesize 3-era historical macro-arcs, record ancient chronicles, and propagate modern ripple repercussions.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Plan 05: 3-Era Epoch Arc Synthesizer Trigger */}
          <button
            onClick={handleGenerateEpochArc}
            disabled={generatingEpochArc}
            className="flex items-center gap-2 text-xs bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-purple-500/20 cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            <span>
              {generatingEpochArc
                ? isPersian
                  ? 'سنتز کلان‌تاریخ...'
                  : 'Synthesizing...'
                : isPersian
                ? '⏳ سنتز کلان‌تاریخ ۳ عصری'
                : '⏳ Synthesize 3-Era Arc'}
            </span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 text-xs bg-amber-500 hover:bg-amber-400 text-zinc-950 px-4 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {isPersian ? '+ ثبت واقعه تاریخی' : '+ Add Event'}
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-zinc-800">
        {[
          { id: 'all', label: isPersian ? 'همه وقایع' : 'All Events' },
          { id: 'ancient', label: isPersian ? 'عصر باستان' : 'Ancient' },
          { id: 'war', label: isPersian ? 'جنگ‌ها' : 'Wars' },
          { id: 'reign', label: isPersian ? 'سلسله‌ها' : 'Reigns' },
          { id: 'cataclysm', label: isPersian ? 'فجایع' : 'Cataclysms' },
          { id: 'present', label: isPersian ? 'معاصر' : 'Present' },
          { id: 'public', label: isPersian ? 'رویدادهای آشکار' : 'Public Lore' },
          { id: 'secret', label: isPersian ? 'اسرار کهن' : 'Secret Lore' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterEra(tab.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              filterEra === tab.id
                ? 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
                : 'text-zinc-400 hover:text-zinc-200 bg-zinc-900/40 border border-zinc-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Timeline List */}
      {filteredTimeline.length === 0 ? (
        <div className="text-center py-20 bg-zinc-900/40 border border-zinc-800/60 rounded-3xl p-8 space-y-3">
          <History className="w-12 h-12 text-zinc-600 mx-auto" />
          <h4 className="text-sm font-bold text-zinc-300">
            {isPersian ? 'هیچ رویدادی در این دسته‌بندی یافت نشد' : 'No chronicle events found'}
          </h4>
          <p className="text-xs text-zinc-500 max-w-md mx-auto">
            {isPersian
              ? 'می‌توانید با استفاده از دکمه «سنتز کلان‌تاریخ ۳ عصری» تاریخچه کاملی از طلوع اساطیر تا عصر حاضر خلق کنید.'
              : 'Use the "Synthesize 3-Era Arc" button to procedurally generate a cohesive macro-history.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTimeline.map((evt) => {
            const eraBadge = getEraBadge(evt.eraCategory);
            const isRippleExpanded = expandedRippleIds.has(evt.id);

            return (
              <div
                key={evt.id}
                className="bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 rounded-3xl p-6 shadow-xl space-y-4 transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className={`px-2.5 py-0.5 rounded-xl text-[11px] font-bold border ${eraBadge.color}`}>
                        {eraBadge.label}
                      </span>
                      <span className="text-xs font-mono text-amber-300/90 font-bold" dir="ltr">
                        {evt.yearOrEra}
                      </span>
                      {!evt.knownByPublic && (
                        <span className="text-[10.5px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-lg flex items-center gap-1 font-bold">
                          <Lock className="w-3 h-3" />
                          {isPersian ? 'راز پنهان تاریخ' : 'Secret Lore'}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-zinc-100">{evt.title}</h3>
                  </div>

                  <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => handleGenerateTimelineRipples(evt)}
                      disabled={generatingRippleEventId === evt.id}
                      className="px-2.5 py-1 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10.5px] font-bold flex items-center gap-1 transition-all"
                      title="Propagate Ripple Effects"
                    >
                      <Waves className="w-3.5 h-3.5" />
                      <span>
                        {generatingRippleEventId === evt.id
                          ? isPersian
                            ? 'محاسبه...'
                            : 'Propagating...'
                          : isPersian
                          ? '🌊 موج پیامدها'
                          : '🌊 Ripples'}
                      </span>
                    </button>

                    <button
                      onClick={() => handleOpenEditModal(evt)}
                      className="p-1.5 text-zinc-400 hover:text-amber-300 rounded-lg hover:bg-zinc-800"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteEvent(evt)}
                      className="p-1.5 text-zinc-400 hover:text-red-400 rounded-lg hover:bg-zinc-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-zinc-300 leading-relaxed">{evt.summary}</p>

                {evt.significance && (
                  <div className="p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800/80 text-xs text-zinc-300 space-y-1">
                    <span className="text-amber-400/90 font-bold block text-[11px]">
                      {isPersian ? 'پیامد تاریخی و تأثیر بر دوران کنونی:' : 'Lasting Repercussions & Impact:'}
                    </span>
                    <p className="italic text-zinc-300">{evt.significance}</p>
                  </div>
                )}

                {/* Plan 05: Modern Ripple Effects Repercussions Drawer */}
                {evt.ripples && evt.ripples.length > 0 && (
                  <div className="bg-zinc-950/80 border border-blue-500/20 rounded-2xl overflow-hidden">
                    <div
                      onClick={() => toggleRippleExpand(evt.id)}
                      className="p-3 flex items-center justify-between cursor-pointer hover:bg-zinc-900/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Waves className="w-4 h-4 text-blue-400" />
                        <span className="text-xs font-bold text-blue-300">
                          {isPersian ? 'پیامدهای جاری این واقعه در جهان امروز' : 'Modern Ripple Repercussions'}
                        </span>
                        <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-lg font-mono">
                          {evt.ripples.length} {isPersian ? 'اثر' : 'effects'}
                        </span>
                      </div>
                      {isRippleExpanded ? (
                        <ChevronUp className="w-4 h-4 text-zinc-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-zinc-400" />
                      )}
                    </div>

                    {isRippleExpanded && (
                      <div className="p-3.5 pt-0 space-y-2 text-xs border-t border-zinc-900 animate-fadeIn">
                        {evt.ripples.map((rip, ripIdx) => (
                          <div
                            key={ripIdx}
                            className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-start gap-2"
                          >
                            <span className="px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-300 border border-blue-500/20 font-mono text-[9.5px] uppercase shrink-0 mt-0.5">
                              {rip.targetType}: {rip.targetName}
                            </span>
                            <p className="text-zinc-300 text-[11px] leading-relaxed">{rip.effectDescription}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Plan 05: Epoch Arc Preview Modal */}
      {epochArcPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                {isPersian ? 'پیش‌نمایش کلان‌تاریخ ۳ عصری جهان' : '3-Era Epoch Arc Preview'}
              </h3>
              <button
                onClick={() => setEpochArcPreview(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 3 Eras Overview */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-purple-400 block">
                {isPersian ? 'اعصار سه‌گانه تاریخ:' : 'Three Historical Eras:'}
              </span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {epochArcPreview.eras.map((era, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-300">{era.eraName}</span>
                    </div>
                    <p className="text-[10.5px] font-mono text-zinc-400" dir="ltr">{era.timeframe}</p>
                    <p className="text-zinc-300 text-[11px] line-clamp-3">{era.description}</p>
                    {era.majorCataclysm && (
                      <div className="pt-1.5 border-t border-zinc-900 text-[10.5px] text-red-300">
                        ⚡ <strong>{isPersian ? 'نقطه عطف: ' : 'Cataclysm: '}</strong>
                        {era.majorCataclysm}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Key Events to Commit */}
            <div className="space-y-2 pt-2 border-t border-zinc-800">
              <span className="text-xs font-bold text-amber-400 block">
                {isPersian ? 'وقایع کلیدی برای ثبت در گاه‌شمار:' : 'Key Events to Commit:'}
              </span>
              <div className="space-y-2">
                {epochArcPreview.keyEvents.map((ke, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-zinc-200">{ke.title}</span>
                      <span className="px-2 py-0.5 rounded-lg bg-zinc-800 text-amber-300 font-mono text-[10px]">
                        {ke.eraName}
                      </span>
                    </div>
                    <p className="text-zinc-300 text-[11px]">{ke.narrativeSummary}</p>
                    <p className="text-amber-400/90 text-[10.5px] italic">
                      🎯 {ke.lastingConsequences}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setEpochArcPreview(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700"
              >
                {isPersian ? 'انصراف' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleCommitEpochArc}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold shadow-lg shadow-purple-500/20 flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{isPersian ? '📥 تزریق کلان‌تاریخ به گاه‌شمار' : '📥 Commit to Chronicle'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plan 05: Timeline Ripple Preview Modal */}
      {ripplePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Waves className="w-5 h-5 text-blue-400" />
                {isPersian ? 'موج پیامدهای تاریخی در جهان امروز' : 'Modern Ripple Repercussions'}
              </h3>
              <button
                onClick={() => setRipplePreview(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800 text-xs space-y-1">
              <span className="text-zinc-500 font-mono text-[10px]">
                {isPersian ? 'رویداد مبدأ:' : 'Source Event:'}
              </span>
              <p className="font-bold text-zinc-200">{ripplePreview.targetEvent.title}</p>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-blue-400 block">
                {isPersian ? 'پیامدها و تحولات به وجود آمده:' : 'Synthesized Consequences:'}
              </span>
              {ripplePreview.ripple.modernRepercussions.map((rip, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs space-y-1.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-300 border border-blue-500/20 font-mono text-[10px] uppercase">
                      {rip.targetType}
                    </span>
                    <strong className="text-zinc-200">{rip.targetName}</strong>
                  </div>
                  <p className="text-zinc-300 text-[11px] leading-relaxed">{rip.effectDescription}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setRipplePreview(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700"
              >
                {isPersian ? 'انصراف' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleCommitRipples}
                className="px-5 py-2 rounded-xl bg-blue-500 text-zinc-950 text-xs font-bold shadow-lg shadow-blue-500/20 flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{isPersian ? '📥 ثبت پیامدها بر این واقعه' : '📥 Save Ripples'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Event Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-400" />
                {editingEventId
                  ? isPersian
                    ? 'ویرایش رویداد تاریخی'
                    : 'Edit Chronicle Event'
                  : isPersian
                  ? 'ثبت رویداد تاریخی جدید'
                  : 'Add Historical Event'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="space-y-4">
              <AiFillSection type="timeline_event" onFilled={applyAiFill} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'عنوان واقعه:' : 'Event Title:'}
                  </label>
                  <input
                    type="text"
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                    placeholder={isPersian ? 'مثال: نبرد دره خاکستر' : 'e.g. Siege of the Ashen Gate'}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'دوره زمانی / سال:' : 'Year or Era:'}
                  </label>
                  <input
                    type="text"
                    value={eventYear}
                    onChange={(e) => setEventYear(e.target.value)}
                    placeholder={isPersian ? 'مثال: ۳۰۰ سال پیش (عصر خاکستر)' : 'e.g. 300 Years Ago (Age of Ash)'}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'دسته‌بندی عصر:' : 'Era Category:'}
                  </label>
                  <select
                    value={eventCategory}
                    onChange={(e) => setEventCategory(e.target.value as any)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                  >
                    <option value="ancient">{isPersian ? 'عصر باستان و اساطیر' : 'Ancient / Mythic'}</option>
                    <option value="war">{isPersian ? 'جنگ‌ها و نبردهای خونین' : 'War / Crisis'}</option>
                    <option value="reign">{isPersian ? 'دوران سلطنت و سلسله‌ها' : 'Reign / Golden Era'}</option>
                    <option value="cataclysm">{isPersian ? 'فاجعه‌های طبیعی و جادویی' : 'Cataclysm / Anomaly'}</option>
                    <option value="present">{isPersian ? 'دوره معاصر و جاری' : 'Present Day'}</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'سطح آگاهی و دسترسی:' : 'Lore Accessibility:'}
                  </label>
                  <label className="flex items-center gap-2 mt-2 cursor-pointer text-xs text-zinc-300">
                    <input
                      type="checkbox"
                      checked={eventIsPublic}
                      onChange={(e) => setEventIsPublic(e.target.checked)}
                      className="rounded accent-amber-500 w-4 h-4"
                    />
                    <span>{isPersian ? 'دانش عمومی (مردم و قهرمان از آن آگاهند)' : 'Publicly Known Lore'}</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                  {isPersian ? 'شرح واقعه:' : 'Event Narrative Summary:'}
                </label>
                <textarea
                  rows={3}
                  value={eventSummary}
                  onChange={(e) => setEventSummary(e.target.value)}
                  placeholder={isPersian ? 'توضیح آنچه در تاریخ رخ داده است...' : 'Describe what happened...'}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                  {isPersian ? 'پیامد و تأثیر تاریخی بر جهان امروز:' : 'Historical Aftermath & Significance:'}
                </label>
                <input
                  type="text"
                  value={eventSignificance}
                  onChange={(e) => setEventSignificance(e.target.value)}
                  placeholder={isPersian ? 'مثال: انقراض کامل اژدهایان و سقوط خاندان کهن' : 'e.g. Extinction of dragonkind and rise of the human empire'}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-red-400 block mb-1.5">
                  {isPersian ? 'اسرار مکتوم و حقایق پنهان واقعه (اختیاری):' : 'Secret Lore Context (Optional):'}
                </label>
                <input
                  type="text"
                  value={eventSecretDetails}
                  onChange={(e) => setEventSecretDetails(e.target.value)}
                  placeholder={isPersian ? 'حقیقتی که فقط با آزمون‌های دانش کهن (Arcana) فاش می‌شود...' : 'Secret facts uncovered through Arcana/History checks...'}
                  className="w-full bg-zinc-950 border border-red-500/30 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-red-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700"
                >
                  {isPersian ? 'انصراف' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold shadow-lg shadow-amber-500/20"
                >
                  {editingEventId
                    ? isPersian
                      ? 'ذخیره تغییرات'
                      : 'Update Event'
                    : isPersian
                    ? 'ثبت در گاه‌شمار'
                    : 'Save to Chronicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
