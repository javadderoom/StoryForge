'use client';

import React, { useState } from 'react';
import { useStudioStory } from '@/lib/context/StudioStoryContext';
import {
  Skull,
  Plus,
  Trash2,
  Edit2,
  Shield,
  MapPin,
  Flame,
  Zap,
  Crosshair,
  Package,
  Layers,
  X,
  Sparkles,
} from 'lucide-react';
import { WorldCreature } from '@/lib/types';
import { notify } from '@/lib/notify';
import AiFillSection from '@/components/studio/AiFillSection';

const SPECIES_CATEGORIES = {
  elemental: { labelFa: 'عنصری و سنگی', labelEn: 'Elemental', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  monstrosity: { labelFa: 'هیولا و جهش‌یافته', labelEn: 'Monstrosity', color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
  undead: { labelFa: 'نامردگان و ارواح', labelEn: 'Undead', color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' },
  beast: { labelFa: 'جانور وحشی', labelEn: 'Beast', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  flora: { labelFa: 'گیاه سمی و مهاجم', labelEn: 'Flora', color: 'text-lime-400 bg-lime-500/10 border-lime-500/30' },
  draconic: { labelFa: 'اژدهایی و کهن', labelEn: 'Draconic', color: 'text-red-400 bg-red-500/10 border-red-500/30' },
  humanoid: { labelFa: 'انسان‌نما و قبیله‌ای', labelEn: 'Humanoid', color: 'text-sky-400 bg-sky-500/10 border-sky-500/30' },
};

export default function BestiaryStudioPage() {
  const { story, isPersian, addCreature, editCreature, deleteCreature } = useStudioStory();

  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingCreatureId, setEditingCreatureId] = useState<string | null>(null);

  // Form states
  const [cName, setCName] = useState('');
  const [cCategory, setCCategory] = useState<'beast' | 'monstrosity' | 'undead' | 'elemental' | 'flora' | 'draconic' | 'humanoid'>('beast');
  const [cDanger, setCDanger] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [cHabitats, setCHabitats] = useState<string[]>([]);
  const [cTactics, setCTactics] = useState('');
  const [cWeaknesses, setCWeaknesses] = useState('');
  const [cResistances, setCResistances] = useState('');
  const [cLoot, setCLoot] = useState<Array<{ itemId: string; name: string; dropRate: string }>>([]);
  const [cDesc, setCDesc] = useState('');

  // Temp loot row state
  const [newLootName, setNewLootName] = useState('');
  const [newLootRate, setNewLootRate] = useState('50%');

  const bestiary = story.worldBible.bestiary || [];
  const locations = story.worldBible.locations || [];

  const filteredCreatures = bestiary.filter((c) => {
    if (filterCategory === 'all') return true;
    return c.speciesCategory === filterCategory;
  });

  const handleOpenAddModal = () => {
    setEditingCreatureId(null);
    setCName('');
    setCCategory('beast');
    setCDanger(3);
    setCHabitats([]);
    setCTactics('');
    setCWeaknesses('');
    setCResistances('');
    setCLoot([]);
    setCDesc('');
    setShowAddModal(true);
  };

  const handleOpenEditModal = (c: WorldCreature) => {
    setEditingCreatureId(c.id);
    setCName(c.name);
    setCCategory(c.speciesCategory);
    setCDanger(c.dangerLevel);
    setCHabitats(c.habitatLocationIds || []);
    setCTactics(c.behavioralTactics);
    setCWeaknesses(c.weaknesses.join('\n'));
    setCResistances(c.resistances.join('\n'));
    setCLoot(c.harvestableLoot || []);
    setCDesc(c.loreDescription);
    setShowAddModal(true);
  };

  const handleAddLootItem = () => {
    if (!newLootName.trim()) return;
    const itemId = `loot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
    setCLoot((prev) => [...prev, { itemId, name: newLootName.trim(), dropRate: newLootRate.trim() || '50%' }]);
    setNewLootName('');
  };

  const handleRemoveLootItem = (idx: number) => {
    setCLoot((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleToggleHabitat = (locId: string) => {
    setCHabitats((prev) =>
      prev.includes(locId) ? prev.filter((id) => id !== locId) : [...prev, locId]
    );
  };

  const handleSaveCreature = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cName.trim()) {
      notify.error(isPersian ? 'نام موجود الزامی است' : 'Creature name is required');
      return;
    }

    const weakArray = cWeaknesses
      .split('\n')
      .map((w) => w.trim())
      .filter((w) => w.length > 0);

    const resArray = cResistances
      .split('\n')
      .map((r) => r.trim())
      .filter((r) => r.length > 0);

    const payload: WorldCreature = {
      id: editingCreatureId || `creature_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      name: cName.trim(),
      speciesCategory: cCategory,
      dangerLevel: cDanger,
      habitatLocationIds: cHabitats,
      behavioralTactics: cTactics.trim() || (isPersian ? 'حمله غریزی در صورت احساس خطر' : 'Instinctive defense'),
      weaknesses: weakArray,
      resistances: resArray,
      harvestableLoot: cLoot,
      loreDescription: cDesc.trim(),
    };

    if (editingCreatureId) {
      editCreature(editingCreatureId, payload);
    } else {
      addCreature(payload);
    }

    setShowAddModal(false);
  };

  const applyAiFill = (data: Record<string, unknown>) => {
    if (!cName && data.name) setCName(data.name as string);
    if (data.speciesCategory) setCCategory(data.speciesCategory as typeof cCategory);
    if (data.dangerLevel) setCDanger(data.dangerLevel as typeof cDanger);
    if (!cDesc && data.loreDescription) setCDesc(data.loreDescription as string);
    if (!cTactics && data.behavioralTactics) setCTactics(data.behavioralTactics as string);
    if (!cWeaknesses && Array.isArray(data.weaknesses) && (data.weaknesses as string[]).length)
      setCWeaknesses((data.weaknesses as string[]).join('\n'));
    if (!cResistances && Array.isArray(data.resistances) && (data.resistances as string[]).length)
      setCResistances((data.resistances as string[]).join('\n'));
    if (!cLoot.length && Array.isArray(data.harvestableLoot) && (data.harvestableLoot as unknown[]).length)
      setCLoot(data.harvestableLoot as typeof cLoot);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-sm shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <Skull className="w-5 h-5 text-rose-400" />
            <h2 className="text-xl md:text-2xl font-bold text-zinc-100">
              {isPersian ? 'دانشنامه موجودات و هیولاهای بومی' : 'Bestiary & Native Flora/Fauna'}
            </h2>
          </div>
          <p className="text-sm text-zinc-400 max-w-3xl leading-relaxed">
            {isPersian
              ? 'ثبت و مدیریت رفتار تاکتیکی هیولاها، نقاط ضعف و مقاومت‌های نبرد، غنایم قابل غارت و زیستگاه‌های جغرافیایی در دنیای داستان.'
              : 'Dossiers on native wildlife, abominations, and combat choreography directives for AI game encounters.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs bg-rose-500/10 border border-rose-500/20 text-rose-300 px-3.5 py-1.5 rounded-xl font-mono flex items-center gap-1.5">
            <Skull className="w-3.5 h-3.5 text-rose-400" />
            {bestiary.length} {isPersian ? 'موجود ثبت‌شده' : 'Dossiers'}
          </span>
          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 rounded-2xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 text-zinc-950 text-xs font-bold shadow-lg shadow-rose-500/20 flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>{isPersian ? '+ ثبت موجود جدید' : '+ Add Creature Dossier'}</span>
          </button>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-3 overflow-x-auto">
        <button
          onClick={() => setFilterCategory('all')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
            filterCategory === 'all'
              ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400 shadow-md'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent'
          }`}
        >
          {isPersian ? 'همه موجودات' : 'All Creatures'} ({bestiary.length})
        </button>
        {Object.entries(SPECIES_CATEGORIES).map(([catKey, catMeta]) => (
          <button
            key={catKey}
            onClick={() => setFilterCategory(catKey)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
              filterCategory === catKey
                ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400 shadow-md'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent'
            }`}
          >
            {isPersian ? catMeta.labelFa : catMeta.labelEn}
          </button>
        ))}
      </div>

      {/* Dossiers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCreatures.length === 0 ? (
          <div className="col-span-full text-center py-16 bg-zinc-900/40 border border-zinc-800/60 rounded-3xl p-8">
            <Skull className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-zinc-300">
              {isPersian ? 'موجودی در این رده یافت نشد' : 'No creatures found in this category'}
            </h4>
            <p className="text-xs text-zinc-500 mt-1">
              {isPersian ? 'برای ثبت پرونده زیستی روی دکمه ثبت موجود جدید کلیک کنید.' : 'Click "+ Add Creature Dossier" to populate the bestiary.'}
            </p>
          </div>
        ) : (
          filteredCreatures.map((c) => {
            const catMeta = SPECIES_CATEGORIES[c.speciesCategory] || SPECIES_CATEGORIES.beast;
            const habitatLocObjs = locations.filter((l) => c.habitatLocationIds?.includes(l.id));

            return (
              <div
                key={c.id}
                className="bg-zinc-900/70 border border-zinc-800/80 hover:border-zinc-700 rounded-3xl p-6 backdrop-blur-xl shadow-xl flex flex-col justify-between transition-all space-y-4"
              >
                <div className="space-y-4">
                  {/* Header: Name, Danger, Category */}
                  <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-3">
                    <span className={`px-2.5 py-1 rounded-xl text-xs font-bold border ${catMeta.color}`}>
                      {isPersian ? catMeta.labelFa : catMeta.labelEn}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 rounded-lg">
                        ★ {c.dangerLevel} / 5
                      </span>
                      <button
                        onClick={() => handleOpenEditModal(c)}
                        className="text-zinc-400 hover:text-rose-300 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={async () => {
                          const conf = await notify.confirm({
                            title: isPersian ? 'حذف موجود از دانشنامه' : 'Delete Creature',
                            message: isPersian
                              ? `آیا از حذف "${c.name}" از دانشنامه مطمئن هستید؟`
                              : `Are you sure you want to remove "${c.name}" from the bestiary?`,
                            confirmText: isPersian ? 'بله، حذف شود' : 'Delete',
                            cancelText: isPersian ? 'انصراف' : 'Cancel',
                            isDestructive: true,
                          });
                          if (conf) deleteCreature(c.id);
                        }}
                        className="text-zinc-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-zinc-100">{c.name}</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed mt-1">{c.loreDescription}</p>
                  </div>

                  {/* Tactics */}
                  <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-2xl p-3.5 text-xs text-zinc-300 space-y-1">
                    <span className="text-amber-400 font-bold flex items-center gap-1.5">
                      <Crosshair className="w-3.5 h-3.5" />
                      {isPersian ? 'رفتار تاکتیکی در نبرد:' : 'Combat Tactics Directive:'}
                    </span>
                    <p className="text-zinc-300 leading-relaxed">{c.behavioralTactics}</p>
                  </div>

                  {/* Weaknesses & Resistances */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {c.weaknesses && c.weaknesses.length > 0 && (
                      <div className="bg-sky-950/20 border border-sky-500/20 rounded-xl p-2.5 space-y-1">
                        <span className="text-sky-400 font-bold block text-[11px]">
                          {isPersian ? 'نقاط ضعف:' : 'Weaknesses:'}
                        </span>
                        {c.weaknesses.map((w, idx) => (
                          <span key={idx} className="block text-sky-200/90 text-[11px] leading-tight">
                            • {w}
                          </span>
                        ))}
                      </div>
                    )}
                    {c.resistances && c.resistances.length > 0 && (
                      <div className="bg-rose-950/20 border border-rose-500/20 rounded-xl p-2.5 space-y-1">
                        <span className="text-rose-400 font-bold block text-[11px]">
                          {isPersian ? 'مقاومت‌ها:' : 'Resistances:'}
                        </span>
                        {c.resistances.map((r, idx) => (
                          <span key={idx} className="block text-rose-200/90 text-[11px] leading-tight">
                            • {r}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Loot */}
                  {c.harvestableLoot && c.harvestableLoot.length > 0 && (
                    <div className="bg-zinc-950/40 border border-zinc-800/80 rounded-2xl p-3 text-xs space-y-1.5">
                      <span className="text-zinc-400 font-bold flex items-center gap-1.5 text-[11px]">
                        <Package className="w-3.5 h-3.5 text-amber-400" />
                        {isPersian ? 'غنایم قابل استحصال (Loot):' : 'Harvestable Loot Drops:'}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {c.harvestableLoot.map((item, idx) => (
                          <span
                            key={idx}
                            className="bg-zinc-800/80 border border-zinc-700/80 text-zinc-200 px-2 py-0.5 rounded-lg text-[10.5px] font-mono flex items-center gap-1"
                          >
                            <span>{item.name}</span>
                            <span className="text-amber-400/90">({item.dropRate})</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Footer: Habitat Locations */}
                <div className="pt-3 border-t border-zinc-800/80 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10.5px] text-zinc-500 font-medium">
                    {isPersian ? 'زیستگاه:' : 'Habitats:'}
                  </span>
                  {habitatLocObjs.length > 0 ? (
                    habitatLocObjs.map((l) => (
                      <span key={l.id} className="text-[10.5px] bg-sky-500/10 border border-sky-500/20 text-sky-300 px-2 py-0.5 rounded-lg flex items-center gap-1">
                        <MapPin className="w-2.5 h-2.5" /> {l.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10.5px] text-zinc-500 italic">
                      {isPersian ? 'ناشناخته / آزاد در قلمرو' : 'Wandering / Unbound'}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Creature Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <span className="text-sm font-bold text-rose-400 flex items-center gap-2">
                <Skull className="w-4 h-4" />
                {editingCreatureId
                  ? isPersian
                    ? 'ویرایش پرونده زیستی موجود'
                    : 'Edit Creature Dossier'
                  : isPersian
                  ? 'ثبت پرونده زیستی موجود جدید'
                  : 'Add New Creature Dossier'}
              </span>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCreature} className="space-y-4">
              <AiFillSection type="creature" onFilled={applyAiFill} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'نام موجود / هیولا:' : 'Creature Name:'}
                  </label>
                  <input
                    type="text"
                    value={cName}
                    onChange={(e) => setCName(e.target.value)}
                    placeholder={isPersian ? 'مثال: گولم بازالتی اعماق' : 'e.g. Basalt Depth Golem'}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-rose-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'رده زیستی (Species Category):' : 'Species Category:'}
                  </label>
                  <select
                    value={cCategory}
                    onChange={(e) => setCCategory(e.target.value as any)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-rose-400"
                  >
                    <option value="beast">{isPersian ? 'جانور وحشی (Beast)' : 'Beast'}</option>
                    <option value="monstrosity">{isPersian ? 'هیولا و جهش‌یافته (Monstrosity)' : 'Monstrosity'}</option>
                    <option value="undead">{isPersian ? 'نامردگان و ارواح (Undead)' : 'Undead'}</option>
                    <option value="elemental">{isPersian ? 'عنصری و سنگی (Elemental)' : 'Elemental'}</option>
                    <option value="flora">{isPersian ? 'گیاه سمی و مهاجم (Flora)' : 'Flora'}</option>
                    <option value="draconic">{isPersian ? 'اژدهایی و کهن (Draconic)' : 'Draconic'}</option>
                    <option value="humanoid">{isPersian ? 'انسان‌نما و قبیله‌ای (Humanoid)' : 'Humanoid'}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                  {isPersian ? 'سطح خطر و قدرت نبرد (۱ تا ۵):' : 'Danger Level (1-5):'}
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setCDanger(lvl as any)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                        cDanger === lvl
                          ? 'bg-rose-500 border-rose-400 text-zinc-950 shadow-md shadow-rose-500/20'
                          : 'bg-zinc-950 border-zinc-700 text-zinc-300 hover:border-zinc-500'
                      }`}
                    >
                      ★ {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                  {isPersian ? 'شرح زیست‌شناسی و ویژگی‌های ظاهری:' : 'Description & Lore:'}
                </label>
                <textarea
                  rows={2}
                  value={cDesc}
                  onChange={(e) => setCDesc(e.target.value)}
                  placeholder={isPersian ? 'ویژگی‌های فیزیکی، جثه، رنگ و رفتار عمومی...' : 'Physical traits and behavior...'}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-rose-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                  {isPersian ? 'دستورالعمل رفتار هوش مصنوعی در نبرد (Tactics):' : 'AI Combat Tactics Directive:'}
                </label>
                <textarea
                  rows={2}
                  value={cTactics}
                  onChange={(e) => setCTactics(e.target.value)}
                  placeholder={isPersian ? 'مثال: کمین در سایه و حمله هنگام خاموشی مشعل...' : 'e.g. Ambush from darkness when torch goes out...'}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-rose-400"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-sky-400 block mb-1.5">
                    {isPersian ? 'نقاط ضعف (هر خط یک مورد):' : 'Weaknesses (One per line):'}
                  </label>
                  <textarea
                    rows={2}
                    value={cWeaknesses}
                    onChange={(e) => setCWeaknesses(e.target.value)}
                    placeholder={isPersian ? 'جادوی یخ\nضربه به بلور سینه' : 'Frost magic\nBlunt chest hit'}
                    className="w-full bg-zinc-950 border border-sky-500/30 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-sky-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-rose-400 block mb-1.5">
                    {isPersian ? 'مقاومت‌ها و مصونیت‌ها (هر خط یک مورد):' : 'Resistances (One per line):'}
                  </label>
                  <textarea
                    rows={2}
                    value={cResistances}
                    onChange={(e) => setCResistances(e.target.value)}
                    placeholder={isPersian ? 'مصونیت از آتش\nمقاومت تیغه‌ای' : 'Fire immunity\nSlash resistance'}
                    className="w-full bg-zinc-950 border border-rose-500/30 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-rose-400"
                  />
                </div>
              </div>

              {/* Habitat Selection */}
              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                  {isPersian ? 'زیستگاه‌های حضور در نقشه:' : 'Habitat Locations:'}
                </label>
                <div className="flex flex-wrap gap-2">
                  {locations.map((loc) => {
                    const isSelected = cHabitats.includes(loc.id);
                    return (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => handleToggleHabitat(loc.id)}
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

              {/* Harvestable Loot Builder */}
              <div className="bg-zinc-950/60 border border-zinc-800 rounded-2xl p-3.5 space-y-2">
                <label className="text-xs font-bold text-amber-400 block">
                  {isPersian ? 'غنایم قابل استحصال پس از شکست (Loot Table):' : 'Harvestable Loot Table:'}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={isPersian ? 'نام آیتم غنیمت...' : 'Loot item name...'}
                    value={newLootName}
                    onChange={(e) => setNewLootName(e.target.value)}
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-zinc-100 focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder={isPersian ? 'شانس افتادن (مثال: ۱۰۰٪)' : 'Drop rate (e.g. 100%)'}
                    value={newLootRate}
                    onChange={(e) => setNewLootRate(e.target.value)}
                    className="w-28 bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-zinc-100 focus:outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleAddLootItem}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 text-zinc-950 text-xs font-bold hover:bg-amber-400"
                  >
                    + {isPersian ? 'افزودن' : 'Add'}
                  </button>
                </div>
                {cLoot.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {cLoot.map((item, idx) => (
                      <span
                        key={idx}
                        className="bg-zinc-900 border border-zinc-700 text-zinc-200 px-2.5 py-1 rounded-xl text-xs flex items-center gap-2 font-mono"
                      >
                        <span>{item.name}</span>
                        <span className="text-amber-400">({item.dropRate})</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveLootItem(idx)}
                          className="text-zinc-500 hover:text-red-400"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
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
                  className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-zinc-950 text-xs font-bold shadow-lg shadow-rose-500/20"
                >
                  {editingCreatureId
                    ? isPersian
                      ? 'ذخیره تغییرات'
                      : 'Update Dossier'
                    : isPersian
                    ? 'ثبت در دانشنامه'
                    : 'Save to Bestiary'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
