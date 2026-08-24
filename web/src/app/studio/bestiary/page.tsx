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
  Leaf,
  FlaskConical,
  ChevronDown,
  ChevronUp,
  Check,
  HeartHandshake,
} from 'lucide-react';
import { WorldCreature, CreatureAlchemicalYield, EnhancedCreaturePayload } from '@/lib/types';
import { notify } from '@/lib/notify';
import AiFillSection from '@/components/studio/AiFillSection';
import { buildWorldContextString } from '@/lib/engines/narrative/worldContext';

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

  // Plan 05 Form states
  const [cNiche, setCNiche] = useState('');
  const [cPacification, setCPacification] = useState('');
  const [cYields, setCYields] = useState<CreatureAlchemicalYield[]>([]);

  // Temp loot row state
  const [newLootName, setNewLootName] = useState('');
  const [newLootRate, setNewLootRate] = useState('50%');

  // Plan 05: Expandable Drawers & AI Generator States
  const [expandedEcologyIds, setExpandedEcologyIds] = useState<Set<string>>(new Set());
  const [generatingEcologyCreatureId, setGeneratingEcologyCreatureId] = useState<string | null>(null);
  const [ecologyPreview, setEcologyPreview] = useState<{
    targetCreature: WorldCreature;
    payload: EnhancedCreaturePayload;
  } | null>(null);

  const bestiary = story.worldBible.bestiary || [];
  const locations = story.worldBible.locations || [];

  const filteredCreatures = bestiary.filter((c) => {
    if (filterCategory === 'all') return true;
    return c.speciesCategory === filterCategory;
  });

  const toggleEcologyExpand = (id: string) => {
    setExpandedEcologyIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
    setCNiche('');
    setCPacification('');
    setCYields([]);
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
    setCNiche(c.predatorPreyNiche || '');
    setCPacification(c.nonCombatPacificationMethod || '');
    setCYields(c.alchemicalYields || []);
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

  const handleSaveCreature = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cName.trim()) {
      notify.error(isPersian ? 'نام موجود الزامی است' : 'Creature name is required');
      return;
    }

    const weaknessesArr = cWeaknesses
      .split('\n')
      .map((w) => w.trim())
      .filter((w) => w.length > 0);

    const resistancesArr = cResistances
      .split('\n')
      .map((r) => r.trim())
      .filter((r) => r.length > 0);

    const payload: WorldCreature = {
      id: editingCreatureId || `creature_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      name: cName.trim(),
      speciesCategory: cCategory,
      dangerLevel: cDanger,
      habitatLocationIds: cHabitats,
      behavioralTactics: cTactics.trim() || (isPersian ? 'حمله غافلگیرکننده' : 'Ambush and swarm tactics'),
      weaknesses: weaknessesArr.length > 0 ? weaknessesArr : [isPersian ? 'آسیب آتشین' : 'Fire damage'],
      resistances: resistancesArr,
      harvestableLoot: cLoot,
      loreDescription: cDesc.trim(),
      predatorPreyNiche: cNiche.trim() || undefined,
      nonCombatPacificationMethod: cPacification.trim() || undefined,
      alchemicalYields: cYields.length > 0 ? cYields : undefined,
    };

    if (editingCreatureId) {
      editCreature(editingCreatureId, payload);
      notify.success(isPersian ? 'موجود ویرایش شد' : 'Creature updated');
    } else {
      addCreature(payload);
      notify.success(isPersian ? 'موجود جدید به زیست‌بوم افزوده شد' : 'Added creature to bestiary');
    }

    setShowAddModal(false);
  };

  // ----------------------------------------------------------------
  // Plan 05: AI Ecology & Reagents Generator
  // ----------------------------------------------------------------
  const handleGenerateCreatureEcology = async (creature: WorldCreature) => {
    try {
      setGeneratingEcologyCreatureId(creature.id);
      const worldContext = buildWorldContextString(story);
      const res = await fetch('/api/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'creature_ecology',
          prompt: `Generate food chain dynamics, non-lethal pacification methods, and 1 to 3 harvestable alchemical / crafting reagents for "${creature.name}" (${creature.speciesCategory}, Danger Level ${creature.dangerLevel}).`,
          themeContext: story.worldBible.themeNotes,
          worldContext,
          isPersian,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to generate ecology (${res.status})`);
      }

      const json = await res.json();
      if (json.data && Array.isArray(json.data.alchemicalYields)) {
        setEcologyPreview({
          targetCreature: creature,
          payload: json.data,
        });
      } else {
        notify.error(isPersian ? 'قالب اکولوژی معتبر نبود' : 'Invalid creature ecology format');
      }
    } catch (err: any) {
      notify.error(err.message || 'Error generating creature ecology');
    } finally {
      setGeneratingEcologyCreatureId(null);
    }
  };

  const handleCommitEcology = () => {
    if (!ecologyPreview) return;
    const { targetCreature, payload } = ecologyPreview;
    editCreature(targetCreature.id, {
      predatorPreyNiche: payload.predatorPreyNiche,
      nonCombatPacificationMethod: payload.nonCombatPacificationMethod,
      alchemicalYields: payload.alchemicalYields,
    });
    setExpandedEcologyIds((prev) => new Set(prev).add(targetCreature.id));
    setEcologyPreview(null);
    notify.success(isPersian ? 'اکولوژی و مواد کیمیاگری ثبت شد' : 'Ecology and alchemical yields saved');
  };

  const applyAiFill = (data: Record<string, unknown>) => {
    if (!cName && data.name) setCName(data.name as string);
    if (data.speciesCategory) setCCategory(data.speciesCategory as typeof cCategory);
    if (data.dangerLevel) setCDanger(data.dangerLevel as typeof cDanger);
    if (!cTactics && data.behavioralTactics) setCTactics(data.behavioralTactics as string);
    if (!cDesc && data.loreDescription) setCDesc(data.loreDescription as string);
    if (!cWeaknesses && Array.isArray(data.weaknesses)) setCWeaknesses((data.weaknesses as string[]).join('\n'));
    if (!cResistances && Array.isArray(data.resistances)) setCResistances((data.resistances as string[]).join('\n'));
    if (Array.isArray(data.harvestableLoot) && !cLoot.length) {
      setCLoot(data.harvestableLoot as typeof cLoot);
    }
  };

  const renderDangerStars = (level: number) => {
    return (
      <div className="flex items-center gap-1" dir="ltr">
        {[1, 2, 3, 4, 5].map((star) => (
          <Skull
            key={star}
            className={`w-3.5 h-3.5 ${
              star <= level ? 'text-red-400 fill-red-400/20' : 'text-zinc-700'
            }`}
          />
        ))}
        <span className="text-[11px] font-mono text-zinc-400 ml-1">Lvl {level}</span>
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Info */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-sm shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Skull className="w-5 h-5 text-red-400" />
            <h2 className="text-xl md:text-2xl font-bold text-zinc-100">
              {isPersian ? 'دانشنامه زیست‌بوم و جانوران جهان' : 'Bestiary & Ecological Systems'}
            </h2>
          </div>
          <p className="text-sm text-zinc-400 max-w-3xl leading-relaxed">
            {isPersian
              ? 'مدیریت جانوران، هیولاها، زنجیره غذایی، روش‌های رام‌سازی بدون خون‌ریزی و مواد قابل استخراج کیمیاگری.'
              : 'Catalogue fauna, monstrosities, ecological niches, non-lethal pacification, and alchemical crafting yields.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs bg-red-500/10 border border-red-500/20 text-red-300 px-3.5 py-1.5 rounded-xl font-mono flex items-center gap-1.5">
            <Crosshair className="w-3.5 h-3.5 text-red-400" />
            {bestiary.length} {isPersian ? 'گونه ثبت‌شده' : 'Registered Species'}
          </span>
          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 rounded-2xl bg-gradient-to-r from-red-500 to-amber-600 hover:from-red-400 text-zinc-950 text-xs font-bold shadow-lg shadow-red-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isPersian ? '+ ثبت گونه جدید' : '+ Add Creature'}</span>
          </button>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-3 overflow-x-auto">
        <button
          onClick={() => setFilterCategory('all')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
            filterCategory === 'all'
              ? 'bg-red-500/10 border border-red-500/30 text-red-400 shadow-md'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent'
          }`}
        >
          {isPersian ? 'همه گونه‌ها' : 'All Species'} ({bestiary.length})
        </button>
        {Object.entries(SPECIES_CATEGORIES).map(([key, val]) => (
          <button
            key={key}
            onClick={() => setFilterCategory(key)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
              filterCategory === key
                ? 'bg-red-500/10 border border-red-500/30 text-red-400 shadow-md'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent'
            }`}
          >
            {isPersian ? val.labelFa : val.labelEn}
          </button>
        ))}
      </div>

      {/* Bestiary Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCreatures.length === 0 ? (
          <div className="col-span-full text-center py-16 bg-zinc-900/40 border border-zinc-800/60 rounded-3xl p-8">
            <Skull className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-zinc-300">
              {isPersian ? 'موجودی در این رده زیستی یافت نشد' : 'No creatures found in this category'}
            </h4>
            <p className="text-xs text-zinc-500 mt-1">
              {isPersian ? 'برای ثبت موجود روی دکمه ثبت گونه جدید کلیک کنید.' : 'Click "+ Add Creature" to populate the bestiary.'}
            </p>
          </div>
        ) : (
          filteredCreatures.map((c) => {
            const catMeta = SPECIES_CATEGORIES[c.speciesCategory] || SPECIES_CATEGORIES.beast;
            const isEcologyExpanded = expandedEcologyIds.has(c.id);

            return (
              <div
                key={c.id}
                className="bg-zinc-900/70 border border-zinc-800/80 hover:border-zinc-700 rounded-3xl p-6 backdrop-blur-xl shadow-xl flex flex-col justify-between transition-all space-y-4"
              >
                <div className="space-y-4">
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-3">
                    <span className={`px-3 py-1 rounded-xl text-xs font-bold border ${catMeta.color}`}>
                      {isPersian ? catMeta.labelFa : catMeta.labelEn}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleGenerateCreatureEcology(c)}
                        disabled={generatingEcologyCreatureId === c.id}
                        className="px-2.5 py-1 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10.5px] font-bold flex items-center gap-1 transition-all"
                        title="Generate Ecology & Reagents"
                      >
                        <Leaf className="w-3.5 h-3.5" />
                        <span>
                          {generatingEcologyCreatureId === c.id
                            ? isPersian
                              ? 'سنتز...'
                              : 'Synthesizing...'
                            : isPersian
                            ? '🌿 اکولوژی'
                            : '🌿 Ecology'}
                        </span>
                      </button>

                      <button
                        onClick={() => handleOpenEditModal(c)}
                        className="text-zinc-400 hover:text-amber-300 p-1.5 rounded-lg hover:bg-zinc-800"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={async () => {
                          const conf = await notify.confirm({
                            title: isPersian ? 'حذف موجود' : 'Delete Creature',
                            message: isPersian
                              ? `آیا از حذف "${c.name}" از زیست‌بوم جهان مطمئن هستید؟`
                              : `Are you sure you want to delete "${c.name}"?`,
                            confirmText: isPersian ? 'بله، حذف شود' : 'Delete',
                            cancelText: isPersian ? 'انصراف' : 'Cancel',
                            isDestructive: true,
                          });
                          if (conf) deleteCreature(c.id);
                        }}
                        className="text-zinc-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-zinc-800"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-base font-bold text-zinc-100">{c.name}</h3>
                      {renderDangerStars(c.dangerLevel)}
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">{c.loreDescription}</p>
                  </div>

                  {/* Tactics */}
                  <div className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-2xl text-xs space-y-1">
                    <span className="text-[11px] font-bold text-red-400 block">
                      ⚔️ {isPersian ? 'تاکتیک‌های نبرد و رفتار:' : 'Combat Tactics & Behavior:'}
                    </span>
                    <p className="text-zinc-300 leading-relaxed">{c.behavioralTactics}</p>
                  </div>

                  {/* Weaknesses & Resistances */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-2xl bg-zinc-950/40 border border-zinc-800 space-y-1">
                      <span className="text-[10.5px] font-bold text-rose-400 block">
                        🎯 {isPersian ? 'نقاط ضعف:' : 'Weaknesses:'}
                      </span>
                      <ul className="space-y-0.5 text-zinc-300 text-[11px]">
                        {c.weaknesses.map((w, idx) => (
                          <li key={idx}>• {w}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-2.5 rounded-2xl bg-zinc-950/40 border border-zinc-800 space-y-1">
                      <span className="text-[10.5px] font-bold text-sky-400 block">
                        🛡️ {isPersian ? 'مقاومت‌ها:' : 'Resistances:'}
                      </span>
                      <ul className="space-y-0.5 text-zinc-300 text-[11px]">
                        {c.resistances.length ? (
                          c.resistances.map((r, idx) => <li key={idx}>• {r}</li>)
                        ) : (
                          <li className="text-zinc-500 italic">{isPersian ? 'بدون مقاومت ویژه' : 'None'}</li>
                        )}
                      </ul>
                    </div>
                  </div>

                  {/* Plan 05: Ecology & Alchemical Reagents Drawer */}
                  <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-2xl overflow-hidden">
                    <div
                      onClick={() => toggleEcologyExpand(c.id)}
                      className="p-3 flex items-center justify-between cursor-pointer hover:bg-zinc-900/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Leaf className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold text-zinc-200">
                          {isPersian ? 'اکولوژی و مواد کیمیاگری' : 'Ecology & Alchemical Yields'}
                        </span>
                        {c.alchemicalYields && c.alchemicalYields.length > 0 && (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-lg font-mono">
                            {c.alchemicalYields.length} {isPersian ? 'ماده' : 'reagents'}
                          </span>
                        )}
                      </div>
                      {isEcologyExpanded ? (
                        <ChevronUp className="w-4 h-4 text-zinc-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-zinc-400" />
                      )}
                    </div>

                    {isEcologyExpanded && (
                      <div className="p-3.5 pt-0 space-y-2.5 text-xs border-t border-zinc-900 animate-fadeIn">
                        {c.predatorPreyNiche && (
                          <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-[11px]">
                            <span className="text-[10px] text-zinc-500 block">
                              🦁 {isPersian ? 'جایگاه در زنجیره غذایی:' : 'Ecological Niche:'}
                            </span>
                            <p className="text-zinc-300 mt-0.5">{c.predatorPreyNiche}</p>
                          </div>
                        )}

                        {c.nonCombatPacificationMethod && (
                          <div className="p-2 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-[11px] text-emerald-300/90">
                            <span className="text-[10px] text-emerald-400 font-bold block">
                              🤝 {isPersian ? 'روش رام‌سازی بدون خون‌ریزی:' : 'Non-Combat Pacification:'}
                            </span>
                            <p className="mt-0.5">{c.nonCombatPacificationMethod}</p>
                          </div>
                        )}

                        {c.alchemicalYields && c.alchemicalYields.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[10px] text-zinc-500 block">
                              🧪 {isPersian ? 'مواد قابل استخراج کیمیاگری و ساخت:' : 'Alchemical Harvest Yields:'}
                            </span>
                            {c.alchemicalYields.map((yieldItem, yIdx) => (
                              <div
                                key={yIdx}
                                className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-[11px] flex items-start justify-between gap-2"
                              >
                                <div>
                                  <strong className="text-zinc-200 block">{yieldItem.reagentName}</strong>
                                  <p className="text-[10px] text-zinc-400 mt-0.5">{yieldItem.craftingUse}</p>
                                </div>
                                <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-amber-300 font-mono text-[9px] uppercase shrink-0">
                                  {yieldItem.rarity}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {!c.predatorPreyNiche && !c.nonCombatPacificationMethod && (!c.alchemicalYields || c.alchemicalYields.length === 0) && (
                          <div className="text-center py-3 text-zinc-500 text-xs space-y-1">
                            <p>{isPersian ? 'اکولوژی برای این موجود تعریف نشده است.' : 'No ecology data recorded.'}</p>
                            <button
                              type="button"
                              onClick={() => handleGenerateCreatureEcology(c)}
                              className="text-emerald-400 font-bold hover:underline"
                            >
                              {isPersian ? 'اکنون با هوش مصنوعی تولید کنید' : 'Generate with AI now'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Habitats */}
                <div className="pt-3 border-t border-zinc-800 text-[11px] text-zinc-400 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-red-400" />
                    {c.habitatLocationIds && c.habitatLocationIds.length > 0
                      ? `${c.habitatLocationIds.length} ${isPersian ? 'زیستگاه ثبت‌شده' : 'habitats'}`
                      : isPersian
                      ? 'زیستگاه ناشناخته'
                      : 'Unknown habitat'}
                  </span>
                  <span className="font-mono text-zinc-500 text-[10px]">ID: {c.id}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Plan 05: Creature Ecology Preview Modal */}
      {ecologyPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Leaf className="w-5 h-5 text-emerald-400" />
                {isPersian ? 'پیش‌نمایش اکولوژی و مواد کیمیاگری' : 'Creature Ecology Preview'}
              </h3>
              <button
                onClick={() => setEcologyPreview(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800">
                <span className="text-[10px] text-zinc-500 block">{isPersian ? 'موجود:' : 'Creature:'}</span>
                <strong className="text-zinc-100 text-sm">{ecologyPreview.targetCreature.name}</strong>
              </div>

              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                <span className="text-[10px] text-zinc-500 font-bold block">
                  🦁 {isPersian ? 'جایگاه در زنجیره غذایی:' : 'Ecological Niche:'}
                </span>
                <p className="text-zinc-300">{ecologyPreview.payload.predatorPreyNiche}</p>
              </div>

              <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 space-y-1 text-emerald-300/90">
                <span className="text-[10px] text-emerald-400 font-bold block">
                  🤝 {isPersian ? 'روش رام‌سازی بدون مبارزه:' : 'Non-Combat Pacification:'}
                </span>
                <p>{ecologyPreview.payload.nonCombatPacificationMethod}</p>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] text-zinc-400 font-bold block">
                  🧪 {isPersian ? 'مواد کیمیاگری و ساخت:' : 'Harvestable Reagents:'}
                </span>
                {ecologyPreview.payload.alchemicalYields.map((yieldItem, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-start justify-between gap-2"
                  >
                    <div>
                      <strong className="text-zinc-200">{yieldItem.reagentName}</strong>
                      <p className="text-[10.5px] text-zinc-400 mt-0.5">{yieldItem.craftingUse}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-zinc-800 text-amber-300 font-mono text-[10px] uppercase shrink-0">
                      {yieldItem.rarity}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setEcologyPreview(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700"
              >
                {isPersian ? 'انصراف' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleCommitEcology}
                className="px-5 py-2 rounded-xl bg-emerald-500 text-zinc-950 text-xs font-bold shadow-lg shadow-emerald-500/20 flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{isPersian ? '📥 ثبت اکولوژی' : '📥 Save Ecology'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Creature Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Skull className="w-5 h-5 text-red-400" />
                {editingCreatureId
                  ? isPersian
                    ? 'ویرایش گونه جانوری'
                    : 'Edit Creature'
                  : isPersian
                  ? 'ثبت گونه جدید در زیست‌بوم'
                  : 'Add New Creature'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCreature} className="space-y-4">
              <AiFillSection type="creature" onFilled={applyAiFill} />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'نام موجود:' : 'Creature Name:'}
                  </label>
                  <input
                    type="text"
                    value={cName}
                    onChange={(e) => setCName(e.target.value)}
                    placeholder={isPersian ? 'مثال: گرگ خاکستر' : 'e.g. Ashen Wolf'}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-red-400"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'سطح خطر (۱ تا ۵):' : 'Danger Level (1-5):'}
                  </label>
                  <select
                    value={cDanger}
                    onChange={(e) => setCDanger(Number(e.target.value) as any)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-red-400 font-mono"
                  >
                    <option value={1}>1 - Harmless / Common</option>
                    <option value={2}>2 - Guard / Predator</option>
                    <option value={3}>3 - Deadly Monster</option>
                    <option value={4}>4 - Apex Threat</option>
                    <option value={5}>5 - Calamitous / Boss</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                  {isPersian ? 'رده زیستی:' : 'Species Category:'}
                </label>
                <select
                  value={cCategory}
                  onChange={(e) => setCCategory(e.target.value as any)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-red-400"
                >
                  {Object.entries(SPECIES_CATEGORIES).map(([key, val]) => (
                    <option key={key} value={key}>
                      {isPersian ? val.labelFa : val.labelEn}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                  {isPersian ? 'توضیحات و لور موجود:' : 'Lore & Physiology:'}
                </label>
                <textarea
                  rows={2}
                  value={cDesc}
                  onChange={(e) => setCDesc(e.target.value)}
                  placeholder={isPersian ? 'توصیف ظاهر، خاستگاه و نحوه تعامل...' : 'Physical traits, origin, behavior...'}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-red-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                  {isPersian ? 'رفتار و تاکتیک‌های نبرد:' : 'Combat Tactics:'}
                </label>
                <textarea
                  rows={2}
                  value={cTactics}
                  onChange={(e) => setCTactics(e.target.value)}
                  placeholder={isPersian ? 'الگوی حمله، فریب‌ها و رفتارهای گروهی...' : 'Attack patterns, ambush styles...'}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-red-400"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'نقاط ضعف (هر سطر یک مورد):' : 'Weaknesses (One per line):'}
                  </label>
                  <textarea
                    rows={2}
                    value={cWeaknesses}
                    onChange={(e) => setCWeaknesses(e.target.value)}
                    placeholder="Fire\nSilver weapons"
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-red-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'مقاومت‌ها (هر سطر یک مورد):' : 'Resistances (One per line):'}
                  </label>
                  <textarea
                    rows={2}
                    value={cResistances}
                    onChange={(e) => setCResistances(e.target.value)}
                    placeholder="Poison\nNecrotic"
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-red-400"
                  />
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
                  className="px-5 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-zinc-950 text-xs font-bold shadow-lg shadow-red-500/20"
                >
                  {editingCreatureId
                    ? isPersian
                      ? 'ذخیره تغییرات'
                      : 'Update Creature'
                    : isPersian
                    ? 'ثبت گونه'
                    : 'Save Creature'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
