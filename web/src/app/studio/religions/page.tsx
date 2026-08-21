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
} from 'lucide-react';
import { WorldDeity } from '@/lib/types';
import { notify } from '@/lib/notify';

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

  const religions = story.worldBible.religions || [];
  const factions = story.worldBible.factions || [];
  const locations = story.worldBible.locations || [];

  const filteredReligions = religions.filter((d) => {
    if (filterDomain === 'all') return true;
    return d.domain === filterDomain;
  });

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
      notify.error(isPersian ? 'نام ایزد / مذهب الزامی است' : 'Deity name is required');
      return;
    }

    const taboosArray = dTaboos
      .split('\n')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const blessingsArray = dBlessings
      .split('\n')
      .map((b) => b.trim())
      .filter((b) => b.length > 0);

    const payload: WorldDeity = {
      id: editingDeityId || `deity_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      name: dName.trim(),
      title: dTitle.trim(),
      domain: dDomain,
      sacredSymbol: dSymbol.trim() || (isPersian ? 'نماد ناشناخته' : 'Unknown Sigil'),
      coreDogma: dDogma.trim() || (isPersian ? 'پیروی از احکام ازلی جهان' : 'Follow the celestial order'),
      taboos: taboosArray,
      divineBlessings: blessingsArray,
      affiliatedFactionIds: dFactions,
      holyLocationIds: dLocations,
    };

    if (editingDeityId) {
      editDeity(editingDeityId, payload);
    } else {
      addDeity(payload);
    }

    setShowAddModal(false);
  };

  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const handleAiGenerate = async () => {
    setIsGeneratingAi(true);
    try {
      const res = await fetch('/api/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'deity',
          isPersian,
          themeContext: story.worldBible.themeNotes,
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        addDeity({
          id: `deity_${Date.now().toString(36)}`,
          name: json.data.name || 'ایزدبانوی ناشناخته',
          title: json.data.title || '',
          domain: json.data.domain || 'secrets',
          sacredSymbol: json.data.sacredSymbol || (isPersian ? 'نماد مقدس کهن' : 'Ancient Sigil'),
          coreDogma: json.data.coreDogma || '',
          taboos: json.data.taboos || [],
          divineBlessings: json.data.divineBlessings || [],
          affiliatedFactionIds: [],
          holyLocationIds: [],
        });
        notify.success(isPersian ? 'ایزد کیهانی توسط هوش مصنوعی خلق شد' : 'Deity generated by AI');
      } else {
        notify.error(isPersian ? 'خطا در خلق ایزد' : 'Failed to generate deity');
      }
    } catch {
      notify.error(isPersian ? 'خطا در ارتباط با هوش مصنوعی' : 'AI connection error');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-sm shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <Sun className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl md:text-2xl font-bold text-zinc-100">
              {isPersian ? 'پانتئون ایزدان، ادیان و مکاتب کیهانی' : 'Pantheon, Deities & Faith Systems'}
            </h2>
          </div>
          <p className="text-sm text-zinc-400 max-w-3xl leading-relaxed">
            {isPersian
              ? 'ثبت و مدیریت الهه‌ها، احکام مذهبی، گناهان و تابوهای مقدس، برکات الهی و پیوند آیین‌ها با جناح‌ها و معابد داستان.'
              : 'Architect sacred dogmas, cosmic pantheons, holy taboos, and divine boons that drive ideological faction wars.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleAiGenerate}
            disabled={isGeneratingAi}
            className="px-3.5 py-2 rounded-2xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md disabled:opacity-50"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isGeneratingAi ? 'animate-spin' : 'text-amber-400'}`} />
            <span>{isGeneratingAi ? (isPersian ? 'در حال خلق...' : 'Divining...') : (isPersian ? '⚡ دستیار هوش مصنوعی' : '⚡ AI Co-Pilot')}</span>
          </button>
          <span className="text-xs bg-amber-500/10 border border-amber-500/20 text-amber-300 px-3.5 py-1.5 rounded-xl font-mono flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            {religions.length} {isPersian ? 'ایزد ثبت‌شده' : 'Deities & Creeds'}
          </span>
          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-zinc-950 text-xs font-bold shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>{isPersian ? '+ ثبت ایزد جدید' : '+ Add Deity & Creed'}</span>
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
          {isPersian ? 'همه آیین‌ها' : 'All Creeds'} ({religions.length})
        </button>
        {Object.entries(DOMAIN_MAP).map(([domKey, domMeta]) => (
          <button
            key={domKey}
            onClick={() => setFilterDomain(domKey)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
              filterDomain === domKey
                ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-md'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent'
            }`}
          >
            {isPersian ? domMeta.labelFa : domMeta.labelEn}
          </button>
        ))}
      </div>

      {/* Deities Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredReligions.length === 0 ? (
          <div className="col-span-full text-center py-16 bg-zinc-900/40 border border-zinc-800/60 rounded-3xl p-8">
            <Sun className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-zinc-300">
              {isPersian ? 'آیینی در این حوزه کیهانی یافت نشد' : 'No deities found in this domain'}
            </h4>
            <p className="text-xs text-zinc-500 mt-1">
              {isPersian ? 'برای ثبت ایزد روی دکمه ثبت ایزد جدید کلیک کنید.' : 'Click "+ Add Deity & Creed" to forge cosmic beliefs.'}
            </p>
          </div>
        ) : (
          filteredReligions.map((d) => {
            const domMeta = DOMAIN_MAP[d.domain] || DOMAIN_MAP.light;
            const affFacObjs = factions.filter((f) => d.affiliatedFactionIds?.includes(f.id));
            const holyLocObjs = locations.filter((l) => d.holyLocationIds?.includes(l.id));

            return (
              <div
                key={d.id}
                className={`bg-gradient-to-b ${domMeta.bgGlow} bg-zinc-900/80 border border-zinc-800/80 hover:border-zinc-700 rounded-3xl p-6 backdrop-blur-xl shadow-xl flex flex-col justify-between transition-all space-y-4`}
              >
                <div className="space-y-4">
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
                    <span className={`px-3 py-1 rounded-xl text-xs font-bold border ${domMeta.color}`}>
                      {isPersian ? domMeta.labelFa : domMeta.labelEn}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEditModal(d)}
                        className="text-zinc-400 hover:text-amber-300 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={async () => {
                          const conf = await notify.confirm({
                            title: isPersian ? 'حذف ایزد از پانتئون' : 'Delete Deity',
                            message: isPersian
                              ? `آیا از حذف "${d.name}" از نظام اعتقادی مطمئن هستید؟`
                              : `Are you sure you want to remove "${d.name}" from the world pantheon?`,
                            confirmText: isPersian ? 'بله، حذف شود' : 'Delete',
                            cancelText: isPersian ? 'انصراف' : 'Cancel',
                            isDestructive: true,
                          });
                          if (conf) deleteDeity(d.id);
                        }}
                        className="text-zinc-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-zinc-100">{d.name}</h3>
                    {d.title && <p className="text-xs text-amber-400/90 font-medium mt-0.5">{d.title}</p>}
                  </div>

                  {/* Sacred Symbol */}
                  <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 text-xs text-zinc-300 flex items-center gap-2">
                    <Compass className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-zinc-400">{isPersian ? 'نماد مقدس:' : 'Symbol:'}</span>
                    <span className="font-semibold text-zinc-200">{d.sacredSymbol}</span>
                  </div>

                  {/* Core Dogma */}
                  <div className="p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 text-xs text-zinc-300 space-y-1">
                    <span className="text-amber-400 font-bold block text-[11px]">
                      {isPersian ? 'احکام و آموزه بنیادین:' : 'Core Dogma & Commandments:'}
                    </span>
                    <p className="italic leading-relaxed text-zinc-300">&ldquo;{d.coreDogma}&rdquo;</p>
                  </div>

                  {/* Blessings & Taboos */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {d.divineBlessings && d.divineBlessings.length > 0 && (
                      <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-2.5 space-y-1">
                        <span className="text-emerald-400 font-bold block text-[11px]">
                          {isPersian ? 'برکات الهی:' : 'Blessings:'}
                        </span>
                        {d.divineBlessings.map((b, idx) => (
                          <span key={idx} className="block text-emerald-200/90 text-[11px] leading-tight">
                            • {b}
                          </span>
                        ))}
                      </div>
                    )}
                    {d.taboos && d.taboos.length > 0 && (
                      <div className="bg-rose-950/20 border border-rose-500/20 rounded-xl p-2.5 space-y-1">
                        <span className="text-rose-400 font-bold block text-[11px]">
                          {isPersian ? 'گناهان و تابوها:' : 'Taboos:'}
                        </span>
                        {d.taboos.map((t, idx) => (
                          <span key={idx} className="block text-rose-200/90 text-[11px] leading-tight">
                            • {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer: Factions & Temples */}
                <div className="pt-3 border-t border-zinc-800/80 flex flex-wrap items-center gap-1.5">
                  {affFacObjs.map((f) => (
                    <span key={f.id} className="text-[10.5px] bg-purple-500/10 border border-purple-500/20 text-purple-300 px-2 py-0.5 rounded-lg flex items-center gap-1">
                      <Users className="w-2.5 h-2.5" /> {f.name}
                    </span>
                  ))}
                  {holyLocObjs.map((l) => (
                    <span key={l.id} className="text-[10.5px] bg-sky-500/10 border border-sky-500/20 text-sky-300 px-2 py-0.5 rounded-lg flex items-center gap-1">
                      <MapPin className="w-2.5 h-2.5" /> {l.name}
                    </span>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Deity Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <span className="text-sm font-bold text-amber-400 flex items-center gap-2">
                <Sun className="w-4 h-4" />
                {editingDeityId
                  ? isPersian
                    ? 'ویرایش ایزد و نظام اعتقادی'
                    : 'Edit Deity & Creed'
                  : isPersian
                  ? 'ثبت ایزد و نظام اعتقادی جدید'
                  : 'Add New Deity & Faith'}
              </span>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDeity} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'نام ایزد / نام مکتب:' : 'Deity Name:'}
                  </label>
                  <input
                    type="text"
                    value={dName}
                    onChange={(e) => setDName(e.target.value)}
                    placeholder={isPersian ? 'مثال: بانوی سایه‌ها و گذرگاه‌های خاموش' : 'e.g. The Lady of Veils'}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'لقب و عنوان اسطوره‌ای:' : 'Divine Epithet / Title:'}
                  </label>
                  <input
                    type="text"
                    value={dTitle}
                    onChange={(e) => setDTitle(e.target.value)}
                    placeholder={isPersian ? 'مثال: حافظ عهد کهن و الهه گمشدگان' : 'e.g. Keeper of Lost Covenants'}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'حوزه کیهانی (Domain):' : 'Cosmic Domain:'}
                  </label>
                  <select
                    value={dDomain}
                    onChange={(e) => setDDomain(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                  >
                    <option value="light">{isPersian ? 'نور و داوری (Light & Order)' : 'Light'}</option>
                    <option value="secrets">{isPersian ? 'سایه‌ها و اسرار (Shadows & Secrets)' : 'Secrets'}</option>
                    <option value="death">{isPersian ? 'مرگ و ارواح (Death & Rebirth)' : 'Death'}</option>
                    <option value="war">{isPersian ? 'جنگ و افتخار (War & Conquest)' : 'War'}</option>
                    <option value="nature">{isPersian ? 'طبیعت و عناصر (Nature & Elements)' : 'Nature'}</option>
                    <option value="chaos">{isPersian ? 'آشوب و دگرگونی (Chaos & Change)' : 'Chaos'}</option>
                    <option value="forge">{isPersian ? 'آهنگری و صنعت (Forge & Metallurgy)' : 'Forge'}</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'نماد مقدس (Sacred Symbol):' : 'Sacred Symbol:'}
                  </label>
                  <input
                    type="text"
                    value={dSymbol}
                    onChange={(e) => setDSymbol(e.target.value)}
                    placeholder={isPersian ? 'مثال: هلال ماه واژگون نقره‌ای' : 'e.g. Inverted silver crescent'}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                  {isPersian ? 'احکام و آموزه بنیادین (Core Dogma):' : 'Core Dogma & Edicts:'}
                </label>
                <textarea
                  rows={2}
                  value={dDogma}
                  onChange={(e) => setDDogma(e.target.value)}
                  placeholder={isPersian ? 'شرح دستورات دینی و باورهای مذهبی پیروان...' : 'Core beliefs and commandments...'}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-emerald-400 block mb-1.5">
                    {isPersian ? 'برکات و موهبت‌های الهی (هر خط یک مورد):' : 'Divine Blessings / Boons:'}
                  </label>
                  <textarea
                    rows={2}
                    value={dBlessings}
                    onChange={(e) => setDBlessings(e.target.value)}
                    placeholder={isPersian ? 'دید در تاریکی مطلق\nمهارت در استتار' : 'Darkvision\nStealth bonus'}
                    className="w-full bg-zinc-950 border border-emerald-500/30 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-rose-400 block mb-1.5">
                    {isPersian ? 'گناهان و تابوهای مقدس (هر خط یک مورد):' : 'Taboos & Sins:'}
                  </label>
                  <textarea
                    rows={2}
                    value={dTaboos}
                    onChange={(e) => setDTaboos(e.target.value)}
                    placeholder={isPersian ? 'روشن کردن مشعل در معبد\nخیانت به برادران' : 'Igniting torches\nBetraying brothers'}
                    className="w-full bg-zinc-950 border border-rose-500/30 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-rose-400"
                  />
                </div>
              </div>

              {/* Faction Links */}
              <div>
                <label className="text-xs font-bold text-purple-300 block mb-1.5">
                  {isPersian ? 'جناح‌های پیرو و معتقد:' : 'Affiliated Factions:'}
                </label>
                <div className="flex flex-wrap gap-2">
                  {factions.map((fac) => {
                    const isSelected = dFactions.includes(fac.id);
                    return (
                      <button
                        key={fac.id}
                        type="button"
                        onClick={() => handleToggleFaction(fac.id)}
                        className={`text-xs px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-purple-500/20 border-purple-400 text-purple-200'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-600'
                        }`}
                      >
                        <Users className="w-3 h-3" />
                        <span>{fac.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Location / Holy Temple Links */}
              <div>
                <label className="text-xs font-bold text-sky-300 block mb-1.5">
                  {isPersian ? 'معابد و زیارتگاه‌های مقدس:' : 'Holy Sites & Temples:'}
                </label>
                <div className="flex flex-wrap gap-2">
                  {locations.map((loc) => {
                    const isSelected = dLocations.includes(loc.id);
                    return (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => handleToggleLocation(loc.id)}
                        className={`text-xs px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-600'
                        }`}
                      >
                        <MapPin className="w-3 h-3" />
                        <span>{loc.name}</span>
                      </button>
                    );
                  })}
                </div>
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
                      : 'Update Deity'
                    : isPersian
                    ? 'ثبت در پانتئون'
                    : 'Save to Pantheon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
