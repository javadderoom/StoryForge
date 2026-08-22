'use client';

import React, { useState } from 'react';
import { useStudioStory } from '@/lib/context/StudioStoryContext';
import {
  Sparkles,
  Plus,
  Trash2,
  Edit2,
  Shield,
  MapPin,
  User,
  Zap,
  Lock,
  Eye,
  X,
  Flame,
  Layers,
  Award,
  Crown,
} from 'lucide-react';
import { WorldArtifact } from '@/lib/types';
import { notify } from '@/lib/notify';
import AiFillSection from '@/components/studio/AiFillSection';

const RARITY_MAP = {
  mythic: {
    labelEn: 'Mythic',
    labelFa: 'اسطوره‌ای / کیهانی',
    badgeClass: 'text-amber-300 bg-gradient-to-r from-amber-500/20 to-red-500/20 border-amber-500/40 shadow-lg shadow-amber-500/10',
    borderClass: 'border-amber-500/40 hover:border-amber-400',
    glowClass: 'shadow-amber-500/10',
  },
  legendary: {
    labelEn: 'Legendary',
    labelFa: 'افسانه‌ای',
    badgeClass: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    borderClass: 'border-orange-500/40 hover:border-orange-400',
    glowClass: 'shadow-orange-500/10',
  },
  epic: {
    labelEn: 'Epic',
    labelFa: 'حماسی',
    badgeClass: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    borderClass: 'border-purple-500/40 hover:border-purple-400',
    glowClass: 'shadow-purple-500/10',
  },
  rare: {
    labelEn: 'Rare',
    labelFa: 'کمیاب',
    badgeClass: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
    borderClass: 'border-sky-500/40 hover:border-sky-400',
    glowClass: 'shadow-sky-500/10',
  },
  uncommon: {
    labelEn: 'Uncommon',
    labelFa: 'نامعمول',
    badgeClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    borderClass: 'border-emerald-500/40 hover:border-emerald-400',
    glowClass: 'shadow-emerald-500/10',
  },
};

export default function ArtifactsStudioPage() {
  const { story, isPersian, addArtifact, editArtifact, deleteArtifact } = useStudioStory();

  const [filterRarity, setFilterRarity] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingArtifactId, setEditingArtifactId] = useState<string | null>(null);

  // Form states
  const [artName, setArtName] = useState('');
  const [artTitle, setArtTitle] = useState('');
  const [artOriginEra, setArtOriginEra] = useState('');
  const [artRarity, setArtRarity] = useState<'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic'>('rare');
  const [artDesc, setArtDesc] = useState('');
  const [artPowers, setArtPowers] = useState('');
  const [artCurse, setArtCurse] = useState('');
  const [artAttunement, setArtAttunement] = useState('');
  const [artHolderType, setArtHolderType] = useState<'npc' | 'location' | 'faction' | 'vault' | 'unknown'>('vault');
  const [artHolderId, setArtHolderId] = useState('');
  const [artSecretLore, setArtSecretLore] = useState('');

  const artifacts = story.worldBible.artifacts || [];
  const npcs = story.worldBible.npcs || [];
  const locations = story.worldBible.locations || [];
  const factions = story.worldBible.factions || [];

  const filteredArtifacts = artifacts.filter((art) => {
    if (filterRarity === 'all') return true;
    return art.rarity === filterRarity;
  });

  const handleOpenAddModal = () => {
    setEditingArtifactId(null);
    setArtName('');
    setArtTitle('');
    setArtOriginEra('');
    setArtRarity('rare');
    setArtDesc('');
    setArtPowers('');
    setArtCurse('');
    setArtAttunement('');
    setArtHolderType('vault');
    setArtHolderId('');
    setArtSecretLore('');
    setShowAddModal(true);
  };

  const handleOpenEditModal = (art: WorldArtifact) => {
    setEditingArtifactId(art.id);
    setArtName(art.name);
    setArtTitle(art.title);
    setArtOriginEra(art.originEra);
    setArtRarity(art.rarity);
    setArtDesc(art.description);
    setArtPowers(art.powers.join('\n'));
    setArtCurse(art.curseOrCost || '');
    setArtAttunement(art.attunementRules || '');
    setArtHolderType(art.currentHolderType);
    setArtHolderId(art.currentHolderId);
    setArtSecretLore(art.secretLore || '');
    setShowAddModal(true);
  };

  const handleSaveArtifact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!artName.trim()) {
      notify.error(isPersian ? 'نام عتیقه الزامی است' : 'Artifact name is required');
      return;
    }

    const powersArray = artPowers
      .split('\n')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    const payload: WorldArtifact = {
      id: editingArtifactId || `art_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      name: artName.trim(),
      title: artTitle.trim(),
      originEra: artOriginEra.trim() || (isPersian ? 'عصر باستان' : 'Ancient Era'),
      rarity: artRarity,
      description: artDesc.trim(),
      powers: powersArray.length > 0 ? powersArray : [isPersian ? 'نیروی جادویی پنهان' : 'Latent mystical resonance'],
      curseOrCost: artCurse.trim() || undefined,
      attunementRules: artAttunement.trim() || undefined,
      currentHolderType: artHolderType,
      currentHolderId: artHolderId.trim() || 'unknown',
      secretLore: artSecretLore.trim() || undefined,
    };

    if (editingArtifactId) {
      editArtifact(editingArtifactId, payload);
    } else {
      addArtifact(payload);
    }

    setShowAddModal(false);
  };

  const getHolderDisplayName = (type: string, id: string) => {
    if (type === 'npc') {
      const npc = npcs.find((n) => n.id === id);
      return npc ? `${isPersian ? 'در دست:' : 'Held by:'} ${npc.name}` : id;
    }
    if (type === 'location') {
      const loc = locations.find((l) => l.id === id);
      return loc ? `${isPersian ? 'مقر:' : 'Location:'} ${loc.name}` : id;
    }
    if (type === 'faction') {
      const fac = factions.find((f) => f.id === id);
      return fac ? `${isPersian ? 'مالکیت جناح:' : 'Faction Vault:'} ${fac.name}` : id;
    }
    return isPersian ? 'در خزانه ناشناخته / مفقود' : 'Sealed in Unknown Vault';
  };

  const applyAiFill = (data: Record<string, unknown>) => {
    if (!artName && data.name) setArtName(data.name as string);
    if (!artTitle && data.title) setArtTitle(data.title as string);
    if (!artOriginEra && data.originEra) setArtOriginEra(data.originEra as string);
    if (data.rarity) setArtRarity(data.rarity as typeof artRarity);
    if (!artDesc && data.description) setArtDesc(data.description as string);
    if (!artPowers && Array.isArray(data.powers) && (data.powers as string[]).length)
      setArtPowers((data.powers as string[]).join('\n'));
    if (!artCurse && data.curseOrCost) setArtCurse(data.curseOrCost as string);
    if (!artAttunement && data.attunementRules) setArtAttunement(data.attunementRules as string);
    if (!artSecretLore && data.secretLore) setArtSecretLore(data.secretLore as string);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-sm shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl md:text-2xl font-bold text-zinc-100">
              {isPersian ? 'خزانه عتیقه‌ها و یادگارهای باستانی' : 'Mythic Relics & Ancient Artifacts'}
            </h2>
          </div>
          <p className="text-sm text-zinc-400 max-w-3xl leading-relaxed">
            {isPersian
              ? 'ثبت و مدیریت دست‌سازه‌های جادویی، سلاح‌های باستانی، طلسم‌ها و عتیقه‌های نفرین‌شده همراه با شروط تسخیر (Attunement) و بهای جادویی.'
              : 'Manage mythic relics, ancient artifacts, and cursed heirlooms with attunement rules, holders, and dark costs.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs bg-amber-500/10 border border-amber-500/20 text-amber-300 px-3.5 py-1.5 rounded-xl font-mono flex items-center gap-1.5">
            <Crown className="w-3.5 h-3.5 text-amber-400" />
            {artifacts.length} {isPersian ? 'یادگار ثبت‌شده' : 'Registered Relics'}
          </span>
          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-zinc-950 text-xs font-bold shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>{isPersian ? '+ ثبت یادگار جدید' : '+ Add Mythic Relic'}</span>
          </button>
        </div>
      </div>

      {/* Rarity Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-3 overflow-x-auto">
        <button
          onClick={() => setFilterRarity('all')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
            filterRarity === 'all'
              ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-md'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent'
          }`}
        >
          {isPersian ? 'همه یادگارها' : 'All Relics'} ({artifacts.length})
        </button>
        <button
          onClick={() => setFilterRarity('mythic')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
            filterRarity === 'mythic'
              ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-md'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent'
          }`}
        >
          {isPersian ? 'اسطوره‌ای / کیهانی' : 'Mythic'}
        </button>
        <button
          onClick={() => setFilterRarity('legendary')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
            filterRarity === 'legendary'
              ? 'bg-orange-500/10 border border-orange-500/30 text-orange-400 shadow-md'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent'
          }`}
        >
          {isPersian ? 'افسانه‌ای' : 'Legendary'}
        </button>
        <button
          onClick={() => setFilterRarity('epic')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
            filterRarity === 'epic'
              ? 'bg-purple-500/10 border border-purple-500/30 text-purple-400 shadow-md'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent'
          }`}
        >
          {isPersian ? 'حماسی' : 'Epic'}
        </button>
        <button
          onClick={() => setFilterRarity('rare')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
            filterRarity === 'rare'
              ? 'bg-sky-500/10 border border-sky-500/30 text-sky-400 shadow-md'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent'
          }`}
        >
          {isPersian ? 'کمیاب' : 'Rare'}
        </button>
      </div>

      {/* Artifact Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredArtifacts.length === 0 ? (
          <div className="col-span-full text-center py-16 bg-zinc-900/40 border border-zinc-800/60 rounded-3xl p-8">
            <Sparkles className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-zinc-300">
              {isPersian ? 'یادگاری در این رده یافت نشد' : 'No relics found in this category'}
            </h4>
            <p className="text-xs text-zinc-500 mt-1">
              {isPersian ? 'برای ثبت عتیقه روی دکمه ثبت یادگار جدید کلیک کنید.' : 'Click "+ Add Mythic Relic" to forge ancient heirlooms.'}
            </p>
          </div>
        ) : (
          filteredArtifacts.map((art) => {
            const meta = RARITY_MAP[art.rarity] || RARITY_MAP.rare;
            const holderText = getHolderDisplayName(art.currentHolderType, art.currentHolderId);

            return (
              <div
                key={art.id}
                className={`bg-zinc-900/70 border-2 rounded-3xl p-6 backdrop-blur-xl shadow-2xl flex flex-col justify-between transition-all ${meta.borderClass} ${meta.glowClass}`}
              >
                <div className="space-y-4">
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-3">
                    <span className={`px-3 py-1 rounded-xl text-xs font-bold border ${meta.badgeClass}`}>
                      {isPersian ? meta.labelFa : meta.labelEn}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEditModal(art)}
                        className="text-zinc-400 hover:text-amber-300 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={async () => {
                          const conf = await notify.confirm({
                            title: isPersian ? 'حذف یادگار باستانی' : 'Delete Relic',
                            message: isPersian
                              ? `آیا از حذف عتیقه "${art.name}" از جهان مطمئن هستید؟`
                              : `Are you sure you want to remove "${art.name}" from the world?`,
                            confirmText: isPersian ? 'بله، حذف شود' : 'Delete',
                            cancelText: isPersian ? 'انصراف' : 'Cancel',
                            isDestructive: true,
                          });
                          if (conf) deleteArtifact(art.id);
                        }}
                        className="text-zinc-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-zinc-100">{art.name}</h3>
                    {art.title && <p className="text-xs text-amber-400/90 font-medium mt-0.5">{art.title}</p>}
                    <p className="text-xs text-zinc-400 leading-relaxed mt-2">{art.description}</p>
                  </div>

                  {/* Powers */}
                  {art.powers && art.powers.length > 0 && (
                    <div className="space-y-1.5 bg-zinc-950/60 border border-zinc-800/80 rounded-2xl p-3.5">
                      <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5" />
                        {isPersian ? 'نیروها و اثرات ماورایی:' : 'Powers & Resonance:'}
                      </span>
                      <ul className="space-y-1 text-xs text-zinc-300">
                        {art.powers.map((p, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Curse or Cost */}
                  {art.curseOrCost && (
                    <div className="bg-red-950/20 border border-red-500/30 rounded-2xl p-3 text-xs text-red-300">
                      <span className="text-red-400 font-bold flex items-center gap-1 mb-1">
                        <Flame className="w-3.5 h-3.5" />
                        {isPersian ? 'نفرین یا بهای تسخیر:' : 'Curse / Dark Cost:'}
                      </span>
                      <p>{art.curseOrCost}</p>
                    </div>
                  )}

                  {/* Attunement */}
                  {art.attunementRules && (
                    <div className="text-[11.5px] text-zinc-400 bg-zinc-950/40 border border-zinc-800/80 rounded-xl px-3 py-2">
                      <span className="text-zinc-300 font-bold">{isPersian ? 'شرط تسخیر:' : 'Attunement:'} </span>
                      {art.attunementRules}
                    </div>
                  )}
                </div>

                {/* Card Footer: Holder & Origin */}
                <div className="pt-4 mt-4 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
                  <span className="bg-zinc-800/80 px-2.5 py-1 rounded-xl text-zinc-300 font-medium">
                    {holderText}
                  </span>
                  <span className="text-[11px] font-mono text-zinc-500">{art.originEra}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Artifact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <span className="text-sm font-bold text-amber-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                {editingArtifactId
                  ? isPersian
                    ? 'ویرایش یادگار باستانی'
                    : 'Edit Mythic Relic'
                  : isPersian
                  ? 'ثبت عتیقه و یادگار باستانی جدید'
                  : 'Add New Mythic Relic'}
              </span>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveArtifact} className="space-y-4">
              <AiFillSection type="artifact" onFilled={applyAiFill} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'نام یادگار:' : 'Artifact Name:'}
                  </label>
                  <input
                    type="text"
                    value={artName}
                    onChange={(e) => setArtName(e.target.value)}
                    placeholder={isPersian ? 'مثال: تاج خاکستر و آتش کهن' : 'e.g. The Crown of Cinders'}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'عنوان اسطوره‌ای / لقب:' : 'Mythic Epithet / Title:'}
                  </label>
                  <input
                    type="text"
                    value={artTitle}
                    onChange={(e) => setArtTitle(e.target.value)}
                    placeholder={isPersian ? 'مثال: یادگار پادشاه نخستین' : 'e.g. Heirloom of the First Sovereign'}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'درجه کمیابی (Rarity):' : 'Rarity Tier:'}
                  </label>
                  <select
                    value={artRarity}
                    onChange={(e) => setArtRarity(e.target.value as any)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                  >
                    <option value="mythic">{isPersian ? 'اسطوره‌ای / کیهانی (Mythic)' : 'Mythic'}</option>
                    <option value="legendary">{isPersian ? 'افسانه‌ای (Legendary)' : 'Legendary'}</option>
                    <option value="epic">{isPersian ? 'حماسی (Epic)' : 'Epic'}</option>
                    <option value="rare">{isPersian ? 'کمیاب (Rare)' : 'Rare'}</option>
                    <option value="uncommon">{isPersian ? 'نامعمول (Uncommon)' : 'Uncommon'}</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'عصر تاریخی پیدایش:' : 'Origin Epoch / Era:'}
                  </label>
                  <input
                    type="text"
                    value={artOriginEra}
                    onChange={(e) => setArtOriginEra(e.target.value)}
                    placeholder={isPersian ? 'مثال: ۳۰۰ سال پیش (عصر خاکستر)' : 'e.g. 300 Years Ago'}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                  {isPersian ? 'شرح افسانه و ظاهر یادگار:' : 'Description & Lore:'}
                </label>
                <textarea
                  rows={2}
                  value={artDesc}
                  onChange={(e) => setArtDesc(e.target.value)}
                  placeholder={isPersian ? 'ظاهر، متریال ساخت و افسانه‌های پیرامون آن...' : 'Visual details and legends...'}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                  {isPersian ? 'نیروها و اثرات ماورایی (هر خط یک اثر):' : 'Powers & Properties (One per line):'}
                </label>
                <textarea
                  rows={2}
                  value={artPowers}
                  onChange={(e) => setArtPowers(e.target.value)}
                  placeholder={isPersian ? 'کنترل ذهن سربازان کم‌اراده\nمقاومت در برابر آتش' : 'Mind control over weak sentries\nFire immunity'}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-red-400 block mb-1.5">
                    {isPersian ? 'نفرین یا بهای استفاده (اختیاری):' : 'Curse / Dark Cost (Optional):'}
                  </label>
                  <input
                    type="text"
                    value={artCurse}
                    onChange={(e) => setArtCurse(e.target.value)}
                    placeholder={isPersian ? 'مثال: جنون تدریجی شعله' : 'e.g. Gradual pyromania'}
                    className="w-full bg-zinc-950 border border-red-500/30 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-red-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'شرط تسخیر / نیازهای مهارت:' : 'Attunement Requirements:'}
                  </label>
                  <input
                    type="text"
                    value={artAttunement}
                    onChange={(e) => setArtAttunement(e.target.value)}
                    placeholder={isPersian ? 'مثال: نیازمند دانش کهن ۱۲+' : 'e.g. Requires Arcana 12+'}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'نوع دارنده / محل فعلی:' : 'Holder Entity Type:'}
                  </label>
                  <select
                    value={artHolderType}
                    onChange={(e) => setArtHolderType(e.target.value as any)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                  >
                    <option value="vault">{isPersian ? 'خزانه مخفی / نامعلوم' : 'Secret Vault / Unknown'}</option>
                    <option value="npc">{isPersian ? 'در دست شخصیت (NPC)' : 'Held by NPC'}</option>
                    <option value="location">{isPersian ? 'در مکان خاص (Location)' : 'Stationed at Location'}</option>
                    <option value="faction">{isPersian ? 'در تصاحب جناح (Faction)' : 'Owned by Faction'}</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'انتخاب دارنده مشخص:' : 'Select Specific Holder:'}
                  </label>
                  <select
                    value={artHolderId}
                    onChange={(e) => setArtHolderId(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                  >
                    <option value="unknown">{isPersian ? '-- نامعلوم / مهروموم شده --' : '-- Unknown / Sealed --'}</option>
                    {artHolderType === 'npc' &&
                      npcs.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.name} ({n.title})
                        </option>
                      ))}
                    {artHolderType === 'location' &&
                      locations.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    {artHolderType === 'faction' &&
                      factions.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                  </select>
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
                  {editingArtifactId
                    ? isPersian
                      ? 'ذخیره تغییرات'
                      : 'Update Artifact'
                    : isPersian
                    ? 'ثبت در خزانه'
                    : 'Save to Vault'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
