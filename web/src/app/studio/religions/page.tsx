'use client';

import React, { useState } from 'react';
import { useStudioStory } from '@/lib/context/StudioStoryContext';
import {
  Sun,
  Moon,
  Flame,
  Shield,
  Plus,
  Trash2,
  Edit2,
  MapPin,
  Users,
  Eye,
  Lock,
  Sparkles,
  Zap,
  X,
  Compass,
  Skull,
  ChevronDown,
  ChevronUp,
  Check,
  AlertTriangle,
  Crown,
} from 'lucide-react';
import { WorldDeity, SectarianSchism, EnhancedReligionPayload } from '@/lib/types';
import { notify } from '@/lib/notify';
import AiFillSection from '@/components/studio/AiFillSection';
import { buildWorldContextString } from '@/lib/engines/narrative/worldContext';

const DOMAIN_MAP: Record<string, { labelFa: string; labelEn: string; color: string; bgGlow: string }> = {
  light: { labelFa: 'نور و داوری', labelEn: 'Light & Order', color: 'text-amber-300 bg-amber-500/10 border-amber-500/30', bgGlow: 'from-amber-500/10 to-orange-500/5' },
  secrets: { labelFa: 'سایه‌ها و اسرار', labelEn: 'Shadows & Secrets', color: 'text-purple-300 bg-purple-500/10 border-purple-500/30', bgGlow: 'from-purple-500/10 to-indigo-500/5' },
  death: { labelFa: 'مرگ و ارواح', labelEn: 'Death & Rebirth', color: 'text-zinc-300 bg-zinc-700/20 border-zinc-600/40', bgGlow: 'from-zinc-800/40 to-zinc-950' },
  war: { labelFa: 'جنگ و افتخار', labelEn: 'War & Conquest', color: 'text-red-400 bg-red-500/10 border-red-500/30', bgGlow: 'from-red-500/10 to-rose-500/5' },
  nature: { labelFa: 'طبیعت و عناصر', labelEn: 'Nature & Elements', color: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30', bgGlow: 'from-emerald-500/10 to-teal-500/5' },
  chaos: { labelFa: 'آشوب و دگرگونی', labelEn: 'Chaos & Change', color: 'text-pink-400 bg-pink-500/10 border-pink-500/30', bgGlow: 'from-pink-500/10 to-purple-500/5' },
  forge: { labelFa: 'آهنگری و صنعت', labelEn: 'Forge & Metallurgy', color: 'text-orange-400 bg-orange-500/10 border-orange-500/30', bgGlow: 'from-orange-500/10 to-amber-500/5' },
};

export default function ReligionsStudioPage() {
  const { story, isPersian, addDeity, editDeity, deleteDeity } = useStudioStory();

  const [filterDomain, setFilterDomain] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingDeityId, setEditingDeityId] = useState<string | null>(null);

  // Form state
  const [dName, setDName] = useState('');
  const [dTitle, setDTitle] = useState('');
  const [dDomain, setDDomain] = useState('light');
  const [dSymbol, setDSymbol] = useState('');
  const [dDogma, setDDogma] = useState('');
  const [dTaboos, setDTaboos] = useState('');
  const [dBlessings, setDBlessings] = useState('');
  const [dFactions, setDFactions] = useState<string[]>([]);
  const [dLocations, setDLocations] = useState<string[]>([]);

  // Plan 05 Form states
  const [dOmens, setDOmens] = useState('');
  const [dSchisms, setDSchisms] = useState<SectarianSchism[]>([]);

  // Expandable Drawers & AI Generator States
  const [expandedSchismIds, setExpandedSchismIds] = useState<Set<string>>(new Set());
  const [generatingSchismsDeityId, setGeneratingSchismsDeityId] = useState<string | null>(null);
  const [schismsPreview, setSchismsPreview] = useState<{
    targetDeity: WorldDeity;
    payload: EnhancedReligionPayload;
  } | null>(null);

  const religions = story.worldBible.religions || [];
  const factions = story.worldBible.factions || [];
  const locations = story.worldBible.locations || [];

  const domains = story.worldBible.ontology?.domains ?? [];
  const domainOptions = domains.length
    ? domains.map((d) => ({ id: d.id, name: d.name }))
    : Object.keys(DOMAIN_MAP).map((id) => ({ id, name: DOMAIN_MAP[id as keyof typeof DOMAIN_MAP].labelEn }));

  const filteredReligions = religions.filter((d) => {
    if (filterDomain === 'all') return true;
    return d.domain === filterDomain;
  });

  const toggleSchismExpand = (id: string) => {
    setExpandedSchismIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleOpenAddModal = () => {
    setEditingDeityId(null);
    setDName('');
    setDTitle('');
    setDDomain('light');
    setDSymbol('');
    setDDogma('');
    setDTaboos('');
    setDBlessings('');
    setDFactions([]);
    setDLocations([]);
    setDOmens('');
    setDSchisms([]);
    setShowAddModal(true);
  };

  const handleOpenEditModal = (d: WorldDeity) => {
    setEditingDeityId(d.id);
    setDName(d.name);
    setDTitle(d.title);
    setDDomain(d.domain);
    setDSymbol(d.sacredSymbol);
    setDDogma(d.coreDogma);
    setDTaboos(d.taboos.join('\n'));
    setDBlessings(d.divineBlessings.join('\n'));
    setDFactions(d.affiliatedFactionIds || []);
    setDLocations(d.holyLocationIds || []);
    setDOmens(d.divineOmensForViolation || '');
    setDSchisms(d.sectarianSchisms || []);
    setShowAddModal(true);
  };

  const handleToggleFaction = (facId: string) => {
    setDFactions((prev) =>
      prev.includes(facId) ? prev.filter((id) => id !== facId) : [...prev, facId]
    );
  };

  const handleToggleLocation = (locId: string) => {
    setDLocations((prev) =>
      prev.includes(locId) ? prev.filter((id) => id !== locId) : [...prev, locId]
    );
  };

  const handleSaveDeity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dName.trim()) {
      notify.error(isPersian ? 'نام ایزد / مذهب الزامی است' : 'Deity / Religion name is required');
      return;
    }

    const taboosArr = dTaboos
      .split('\n')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const blessingsArr = dBlessings
      .split('\n')
      .map((b) => b.trim())
      .filter((b) => b.length > 0);

    const payload: WorldDeity = {
      id: editingDeityId || `deity_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      name: dName.trim(),
      title: dTitle.trim(),
      domain: dDomain,
      sacredSymbol: dSymbol.trim() || (isPersian ? 'نماد ناشناخته' : 'Unspecified Symbol'),
      coreDogma: dDogma.trim() || (isPersian ? 'ایمان و اراده الهی' : 'Faith and divine conviction'),
      taboos: taboosArr.length > 0 ? taboosArr : [isPersian ? 'هتک حرمت معابد' : 'Desecration of shrines'],
      divineBlessings: blessingsArr.length > 0 ? blessingsArr : [isPersian ? 'برکت و هدایت الهی' : 'Divine guidance'],
      affiliatedFactionIds: dFactions,
      holyLocationIds: dLocations,
      divineOmensForViolation: dOmens.trim() || undefined,
      sectarianSchisms: dSchisms.length > 0 ? dSchisms : undefined,
    };

    if (editingDeityId) {
      editDeity(editingDeityId, payload);
      notify.success(isPersian ? 'مذهب / ایزد ویرایش شد' : 'Faith / Deity updated');
    } else {
      addDeity(payload);
      notify.success(isPersian ? 'مذهب جدید به پانتئون جهان افزوده شد' : 'Added faith to pantheon');
    }

    setShowAddModal(false);
  };

  // ----------------------------------------------------------------
  // Plan 05: AI Taboos & Schisms Generator
  // ----------------------------------------------------------------
  const handleGenerateReligionSchisms = async (deity: WorldDeity) => {
    try {
      setGeneratingSchismsDeityId(deity.id);
      const worldContext = buildWorldContextString(story);
      const res = await fetch('/api/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'religion_schisms',
          prompt: `Generate sacred taboos, chilling divine wrath omens, blessings, and 1 to 3 subterranean heresy splinter cults for "${deity.name}" (Domain: ${deity.domain}). Dogma: ${deity.coreDogma}.`,
          themeContext: story.worldBible.themeNotes,
          domain: deity.domain,
          worldContext,
          isPersian,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to generate schisms (${res.status})`);
      }

      const json = await res.json();
      if (json.data && Array.isArray(json.data.sacredTaboos)) {
        setSchismsPreview({
          targetDeity: deity,
          payload: json.data,
        });
      } else {
        notify.error(isPersian ? 'قالب شقاق‌های مذهبی معتبر نبود' : 'Invalid religion schisms format');
      }
    } catch (err: any) {
      notify.error(err.message || 'Error generating religion schisms');
    } finally {
      setGeneratingSchismsDeityId(null);
    }
  };

  const handleCommitSchisms = () => {
    if (!schismsPreview) return;
    const { targetDeity, payload } = schismsPreview;
    editDeity(targetDeity.id, {
      taboos: payload.sacredTaboos,
      divineOmensForViolation: payload.divineOmensForViolation,
      divineBlessings: [payload.divineBlessing, ...targetDeity.divineBlessings.slice(0, 2)],
      sectarianSchisms: payload.sectarianSchisms,
    });
    setExpandedSchismIds((prev) => new Set(prev).add(targetDeity.id));
    setSchismsPreview(null);
    notify.success(isPersian ? 'تابوها، شوم‌نامه‌ها و بدعت‌های مذهبی ثبت شد' : 'Taboos, omens, and schisms updated');
  };

  const applyAiFill = (data: Record<string, unknown>) => {
    if (!dName && data.name) setDName(data.name as string);
    if (!dTitle && data.title) setDTitle(data.title as string);
    if (data.domain) setDDomain(data.domain as string);
    if (!dSymbol && data.sacredSymbol) setDSymbol(data.sacredSymbol as string);
    if (!dDogma && data.coreDogma) setDDogma(data.coreDogma as string);
    if (!dTaboos && Array.isArray(data.taboos)) setDTaboos((data.taboos as string[]).join('\n'));
    if (!dBlessings && Array.isArray(data.divineBlessings))
      setDBlessings((data.divineBlessings as string[]).join('\n'));
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Info */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-sm shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Sun className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl md:text-2xl font-bold text-zinc-100">
              {isPersian ? 'پانتئون ایزدان و نظام‌های مذهبی' : 'Pantheons & Divine Faiths'}
            </h2>
          </div>
          <p className="text-sm text-zinc-400 max-w-3xl leading-relaxed">
            {isPersian
              ? 'ثبت و مدیریت عقاید قدسی، تابوهای الهی، شوم‌نامه‌های کفرورزی، برکات ماورایی، و فرقه‌های بدعت‌گذار انشعابی.'
              : 'Catalogue divine dogmas, sacred taboos, blasphemy omens, miracles, and underground sectarian heresy schisms.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs bg-amber-500/10 border border-amber-500/20 text-amber-300 px-3.5 py-1.5 rounded-xl font-mono flex items-center gap-1.5">
            <Crown className="w-3.5 h-3.5 text-amber-400" />
            {religions.length} {isPersian ? 'مذهب ثبت‌شده' : 'Registered Faiths'}
          </span>
          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 text-zinc-950 text-xs font-bold shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isPersian ? '+ ثبت آیین یا ایزد جدید' : '+ Add Divine Faith'}</span>
          </button>
        </div>
      </div>

      {/* Domain Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-3 overflow-x-auto">
        <button
          onClick={() => setFilterDomain('all')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
            filterDomain === 'all'
              ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-md'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent'
          }`}
        >
          {isPersian ? 'همه حوزه‌ها' : 'All Domains'} ({religions.length})
        </button>
        {domainOptions.map((opt) => (
          <button
            key={opt.id}
            onClick={() => setFilterDomain(opt.id)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
              filterDomain === opt.id
                ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-md'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent'
            }`}
          >
            {opt.name}
          </button>
        ))}
      </div>

      {/* Faith Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredReligions.length === 0 ? (
          <div className="col-span-full text-center py-16 bg-zinc-900/40 border border-zinc-800/60 rounded-3xl p-8">
            <Sun className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-zinc-300">
              {isPersian ? 'مذهبی در این حوزه یافت نشد' : 'No faiths found in this domain'}
            </h4>
            <p className="text-xs text-zinc-500 mt-1">
              {isPersian ? 'برای ثبت آیین روی دکمه ثبت آیین جدید کلیک کنید.' : 'Click "+ Add Divine Faith" to create a new deity.'}
            </p>
          </div>
        ) : (
          filteredReligions.map((d) => {
            const domainMeta = DOMAIN_MAP[d.domain] || DOMAIN_MAP.light;
            const isSchismExpanded = expandedSchismIds.has(d.id);

            return (
              <div
                key={d.id}
                className="bg-zinc-900/70 border border-zinc-800/80 hover:border-zinc-700 rounded-3xl p-6 backdrop-blur-xl shadow-xl flex flex-col justify-between transition-all space-y-4"
              >
                <div className="space-y-4">
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-3">
                    <span className={`px-3 py-1 rounded-xl text-xs font-bold border ${domainMeta.color}`}>
                      {isPersian ? domainMeta.labelFa : domainMeta.labelEn}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleGenerateReligionSchisms(d)}
                        disabled={generatingSchismsDeityId === d.id}
                        className="px-2.5 py-1 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10.5px] font-bold flex items-center gap-1 transition-all"
                        title="Generate Taboos & Schisms"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>
                          {generatingSchismsDeityId === d.id
                            ? isPersian
                              ? 'سنتز...'
                              : 'Synthesizing...'
                            : isPersian
                            ? '🔮 بدعت‌ها'
                            : '🔮 Schisms'}
                        </span>
                      </button>

                      <button
                        onClick={() => handleOpenEditModal(d)}
                        className="text-zinc-400 hover:text-amber-300 p-1.5 rounded-lg hover:bg-zinc-800"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={async () => {
                          const conf = await notify.confirm({
                            title: isPersian ? 'حذف مذهب' : 'Delete Faith',
                            message: isPersian
                              ? `آیا از حذف آیین "${d.name}" اطمینان دارید؟`
                              : `Are you sure you want to delete "${d.name}"?`,
                            confirmText: isPersian ? 'بله، حذف شود' : 'Delete',
                            cancelText: isPersian ? 'انصراف' : 'Cancel',
                            isDestructive: true,
                          });
                          if (conf) deleteDeity(d.id);
                        }}
                        className="text-zinc-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-zinc-800"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-zinc-100">{d.name}</h3>
                    {d.title && <p className="text-xs text-amber-400/90 font-medium mt-0.5">{d.title}</p>}
                    <p className="text-xs text-zinc-400 leading-relaxed mt-2">&ldquo;{d.coreDogma}&rdquo;</p>
                  </div>

                  {/* Sacred Symbol */}
                  {d.sacredSymbol && (
                    <div className="p-2.5 bg-zinc-950/60 border border-zinc-800/80 rounded-2xl text-xs flex items-center gap-2 text-zinc-300">
                      <span className="text-amber-400 font-bold text-[11px]">{isPersian ? 'نماد قدسی:' : 'Symbol:'}</span>
                      <span>{d.sacredSymbol}</span>
                    </div>
                  )}

                  {/* Taboos */}
                  {d.taboos && d.taboos.length > 0 && (
                    <div className="p-3 bg-red-950/20 border border-red-500/20 rounded-2xl text-xs space-y-1">
                      <span className="text-[11px] font-bold text-red-400 block">
                        ⛔ {isPersian ? 'تابوهای قدسی و ممنوعه‌ها:' : 'Sacred Taboos:'}
                      </span>
                      <ul className="space-y-0.5 text-red-300 text-[11px]">
                        {d.taboos.map((t, idx) => (
                          <li key={idx}>• {t}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Divine Blessings */}
                  {d.divineBlessings && d.divineBlessings.length > 0 && (
                    <div className="p-3 bg-amber-950/20 border border-amber-500/20 rounded-2xl text-xs space-y-1">
                      <span className="text-[11px] font-bold text-amber-400 block">
                        ✨ {isPersian ? 'برکات و معجزات برای مؤمنان:' : 'Divine Blessings:'}
                      </span>
                      <ul className="space-y-0.5 text-amber-200 text-[11px]">
                        {d.divineBlessings.map((b, idx) => (
                          <li key={idx}>• {b}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Plan 05: Divine Omens & Cult Schisms Drawer */}
                  <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-2xl overflow-hidden">
                    <div
                      onClick={() => toggleSchismExpand(d.id)}
                      className="p-3 flex items-center justify-between cursor-pointer hover:bg-zinc-900/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-purple-400" />
                        <span className="text-xs font-bold text-zinc-200">
                          {isPersian ? 'شوم‌نامه‌ها و انشعابات بدعت‌گذار' : 'Wrath Omens & Sectarian Schisms'}
                        </span>
                        {d.sectarianSchisms && d.sectarianSchisms.length > 0 && (
                          <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-lg font-mono">
                            {d.sectarianSchisms.length} {isPersian ? 'فرقه' : 'cults'}
                          </span>
                        )}
                      </div>
                      {isSchismExpanded ? (
                        <ChevronUp className="w-4 h-4 text-zinc-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-zinc-400" />
                      )}
                    </div>

                    {isSchismExpanded && (
                      <div className="p-3.5 pt-0 space-y-2.5 text-xs border-t border-zinc-900 animate-fadeIn">
                        {d.divineOmensForViolation && (
                          <div className="p-2 rounded-xl bg-red-950/30 border border-red-500/30 text-red-300 text-[11px]">
                            <span className="text-[10px] text-red-400 font-bold block">
                              ⚡ {isPersian ? 'شوم‌نامه خشم الهی برای کفرورزان:' : 'Wrath Omen for Violation:'}
                            </span>
                            <p className="mt-0.5 leading-relaxed">{d.divineOmensForViolation}</p>
                          </div>
                        )}

                        {d.sectarianSchisms && d.sectarianSchisms.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[10px] text-zinc-500 block">
                              🔮 {isPersian ? 'فرقه‌های زیرزمینی و بدعت‌ها:' : 'Sectarian Splinter Cults:'}
                            </span>
                            {d.sectarianSchisms.map((schism, sIdx) => (
                              <div
                                key={sIdx}
                                className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-[11px] space-y-0.5"
                              >
                                <div className="flex items-center justify-between">
                                  <strong className="text-purple-300">{schism.cultName}</strong>
                                  {schism.headquartersLocation && (
                                    <span className="text-[9.5px] text-zinc-400 flex items-center gap-0.5">
                                      <MapPin className="w-2.5 h-2.5" />
                                      {schism.headquartersLocation}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10.5px] text-zinc-400 italic">{schism.heresyDoctrine}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {!d.divineOmensForViolation && (!d.sectarianSchisms || d.sectarianSchisms.length === 0) && (
                          <div className="text-center py-3 text-zinc-500 text-xs space-y-1">
                            <p>{isPersian ? 'شوم‌نامه یا فرقه‌ای ثبت نشده است.' : 'No wrath omens or schisms recorded.'}</p>
                            <button
                              type="button"
                              onClick={() => handleGenerateReligionSchisms(d)}
                              className="text-purple-400 font-bold hover:underline"
                            >
                              {isPersian ? 'اکنون با هوش مصنوعی تولید کنید' : 'Generate with AI now'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Holy Locations & Factions */}
                <div className="pt-3 border-t border-zinc-800 text-[11px] text-zinc-400 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-amber-400" />
                    {d.holyLocationIds && d.holyLocationIds.length > 0
                      ? `${d.holyLocationIds.length} ${isPersian ? 'مکان مقدس' : 'holy sites'}`
                      : isPersian
                      ? 'بدون معبد'
                      : 'No shrines'}
                  </span>
                  <span className="font-mono text-zinc-500 text-[10px]">ID: {d.id}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Plan 05: Religion Schisms Preview Modal */}
      {schismsPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-purple-400" />
                {isPersian ? 'پیش‌نمایش تابوها و فرقه‌های بدعت‌گذار' : 'Taboos & Sectarian Schisms Preview'}
              </h3>
              <button
                onClick={() => setSchismsPreview(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800">
                <span className="text-[10px] text-zinc-500 block">{isPersian ? 'آیین:' : 'Faith:'}</span>
                <strong className="text-zinc-100 text-sm">{schismsPreview.targetDeity.name}</strong>
              </div>

              {schismsPreview.payload.divineOmensForViolation && (
                <div className="p-3 rounded-xl bg-red-950/30 border border-red-500/30 text-red-300 space-y-1">
                  <span className="text-[10px] text-red-400 font-bold block">
                    ⚡ {isPersian ? 'شوم‌نامه خشم الهی:' : 'Divine Wrath Omen:'}
                  </span>
                  <p className="leading-relaxed">{schismsPreview.payload.divineOmensForViolation}</p>
                </div>
              )}

              {schismsPreview.payload.sacredTaboos.length > 0 && (
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                  <span className="text-[10px] text-amber-400 font-bold block">
                    ⛔ {isPersian ? 'تابوهای قدسی:' : 'Sacred Taboos:'}
                  </span>
                  <ul className="space-y-0.5 text-zinc-300">
                    {schismsPreview.payload.sacredTaboos.map((taboo, idx) => (
                      <li key={idx}>• {taboo}</li>
                    ))}
                  </ul>
                </div>
              )}

              {schismsPreview.payload.sectarianSchisms.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] text-zinc-400 font-bold block">
                    🔮 {isPersian ? 'فرقه‌های بدعت‌گذار انشعابی:' : 'Sectarian Splinter Cults:'}
                  </span>
                  {schismsPreview.payload.sectarianSchisms.map((schism, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-0.5"
                    >
                      <strong className="text-purple-300 block">{schism.cultName}</strong>
                      <p className="text-zinc-400 text-[10.5px] italic">{schism.heresyDoctrine}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setSchismsPreview(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700"
              >
                {isPersian ? 'انصراف' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleCommitSchisms}
                className="px-5 py-2 rounded-xl bg-purple-500 text-zinc-950 text-xs font-bold shadow-lg shadow-purple-500/20 flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{isPersian ? '📥 ثبت شقاق‌ها و تابوها' : '📥 Save Schisms'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Deity Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Sun className="w-5 h-5 text-amber-400" />
                {editingDeityId
                  ? isPersian
                    ? 'ویرایش ایزد یا آیین'
                    : 'Edit Faith'
                  : isPersian
                  ? 'ثبت ایزد یا نظام مذهبی جدید'
                  : 'Add New Divine Faith'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDeity} className="space-y-4">
              <AiFillSection type="deity" onFilled={applyAiFill} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'نام ایزد / آیین:' : 'Faith / Deity Name:'}
                  </label>
                  <input
                    type="text"
                    value={dName}
                    onChange={(e) => setDName(e.target.value)}
                    placeholder={isPersian ? 'مثال: مشعل‌دار نخستین' : 'e.g. The First Pyremaster'}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'عنوان و القاب:' : 'Title / Epithet:'}
                  </label>
                  <input
                    type="text"
                    value={dTitle}
                    onChange={(e) => setDTitle(e.target.value)}
                    placeholder={isPersian ? 'مثال: پاسدار خاکستر' : 'e.g. Warden of the Cinders'}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'حوزه الوهیت (Domain):' : 'Divine Domain:'}
                  </label>
                  <select
                    value={dDomain}
                    onChange={(e) => setDDomain(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                  >
                    {domainOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'نماد قدسی:' : 'Sacred Symbol:'}
                  </label>
                  <input
                    type="text"
                    value={dSymbol}
                    onChange={(e) => setDSymbol(e.target.value)}
                    placeholder={isPersian ? 'مثال: چشم طلایی با بال‌های گداخته' : 'e.g. Golden eye flanked by molten wings'}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                  {isPersian ? 'عقیده اصلی (Core Dogma):' : 'Core Dogma:'}
                </label>
                <textarea
                  rows={2}
                  value={dDogma}
                  onChange={(e) => setDDogma(e.target.value)}
                  placeholder={isPersian ? 'اعتقاد بنیادین پیروان...' : 'Fundamental belief or creed...'}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                  {isPersian ? 'تابوهای قدسی و گناهان کبیره (هر سطر یک مورد):' : 'Sacred Taboos (One per line):'}
                </label>
                <textarea
                  rows={2}
                  value={dTaboos}
                  onChange={(e) => setDTaboos(e.target.value)}
                  placeholder="Extinguishing a sacred flame\nLying before the altar"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                  {isPersian ? 'برکات و معجزات برای مؤمنان (هر سطر یک مورد):' : 'Divine Blessings (One per line):'}
                </label>
                <textarea
                  rows={2}
                  value={dBlessings}
                  onChange={(e) => setDBlessings(e.target.value)}
                  placeholder="Immunity to poison\nBlinding radiant aura"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
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
                  {editingDeityId
                    ? isPersian
                      ? 'ذخیره تغییرات'
                      : 'Update Faith'
                    : isPersian
                    ? 'ثبت آیین'
                    : 'Save Faith'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
