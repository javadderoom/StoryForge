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
  Key,
  Users,
  Compass,
  ChevronDown,
  ChevronUp,
  Check,
  Sword,
} from 'lucide-react';
import { WorldArtifact, ArtifactVaultLore, EnhancedArtifactPayload } from '@/lib/types';
import { notify } from '@/lib/notify';
import AiFillSection from '@/components/studio/AiFillSection';
import { buildWorldContextString } from '@/lib/engines/narrative/worldContext';

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

  // Plan 05 Vault Lore form fields
  const [vaultCreator, setVaultCreator] = useState('');
  const [vaultLocation, setVaultLocation] = useState('');
  const [vaultRitual, setVaultRitual] = useState('');
  const [vaultSeekers, setVaultSeekers] = useState('');

  // Expandable Drawers & AI Generator States
  const [expandedVaultLoreIds, setExpandedVaultLoreIds] = useState<Set<string>>(new Set());
  const [generatingVaultArtifactId, setGeneratingVaultArtifactId] = useState<string | null>(null);
  const [vaultLorePreview, setVaultLorePreview] = useState<{
    targetArtifact: WorldArtifact;
    payload: EnhancedArtifactPayload;
  } | null>(null);

  const artifacts = story.worldBible.artifacts || [];
  const npcs = story.worldBible.npcs || [];
  const locations = story.worldBible.locations || [];
  const factions = story.worldBible.factions || [];

  const filteredArtifacts = artifacts.filter((art) => {
    if (filterRarity === 'all') return true;
    return art.rarity === filterRarity;
  });

  const toggleVaultLoreExpand = (id: string) => {
    setExpandedVaultLoreIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
    setVaultCreator('');
    setVaultLocation('');
    setVaultRitual('');
    setVaultSeekers('');
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
    setVaultCreator(art.vaultLore?.creator || '');
    setVaultLocation(art.vaultLore?.currentVaultLocation || '');
    setVaultRitual(art.vaultLore?.unsealingRitual || '');
    setVaultSeekers(art.vaultLore?.rivalSeekers?.join(', ') || '');
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

    const vaultLorePayload: ArtifactVaultLore | undefined =
      vaultCreator.trim() || vaultLocation.trim() || vaultRitual.trim()
        ? {
            creator: vaultCreator.trim() || (isPersian ? 'استاد افزارمند ناشناس' : 'Unknown Artificer'),
            currentVaultLocation: vaultLocation.trim() || (isPersian ? 'خزانه پنهان' : 'Hidden Vault'),
            unsealingRitual: vaultRitual.trim() || (isPersian ? 'رمزگشایی با رون‌های کهن' : 'Ancient runic deciphering'),
            rivalSeekers: vaultSeekers
              .split(',')
              .map((s) => s.trim())
              .filter((s) => s.length > 0),
          }
        : undefined;

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
      vaultLore: vaultLorePayload,
    };

    if (editingArtifactId) {
      editArtifact(editingArtifactId, payload);
      notify.success(isPersian ? 'یادگار باستانی ویرایش شد' : 'Artifact updated');
    } else {
      addArtifact(payload);
      notify.success(isPersian ? 'یادگار جدید به جهان افزوده شد' : 'Added new relic');
    }

    setShowAddModal(false);
  };

  // ----------------------------------------------------------------
  // Plan 05: AI Vault & Relic Generator
  // ----------------------------------------------------------------
  const handleGenerateVaultLore = async (art: WorldArtifact) => {
    try {
      setGeneratingVaultArtifactId(art.id);
      const worldContext = buildWorldContextString(story);
      const res = await fetch('/api/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'artifact_enhanced',
          prompt: `Generate rich vault quest hooks, unsealing rituals, rival seekers, and balanced powers/curses for "${art.name}" (${art.rarity} tier). Prioritize tangible weapons/armor.`,
          themeContext: story.worldBible.themeNotes,
          rarity: art.rarity,
          worldContext,
          isPersian,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to generate vault lore (${res.status})`);
      }

      const json = await res.json();
      if (json.data && json.data.vaultLore) {
        setVaultLorePreview({
          targetArtifact: art,
          payload: json.data,
        });
      } else {
        notify.error(isPersian ? 'قالب لور خزانه‌داری معتبر نبود' : 'Invalid vault lore format');
      }
    } catch (err: any) {
      notify.error(err.message || 'Error generating vault lore');
    } finally {
      setGeneratingVaultArtifactId(null);
    }
  };

  const handleCommitVaultLore = () => {
    if (!vaultLorePreview) return;
    const { targetArtifact, payload } = vaultLorePreview;
    editArtifact(targetArtifact.id, {
      vaultLore: payload.vaultLore,
      curseOrCost: payload.doubleEdgedCurse || targetArtifact.curseOrCost,
      attunementRules: payload.attunementCost || targetArtifact.attunementRules,
    });
    setExpandedVaultLoreIds((prev) => new Set(prev).add(targetArtifact.id));
    setVaultLorePreview(null);
    notify.success(isPersian ? 'لور خزانه‌داری برای این یادگار ثبت شد' : 'Vault lore updated on artifact');
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
      {/* Header Info */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-sm shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl md:text-2xl font-bold text-zinc-100">
              {isPersian ? 'دست‌سازه‌ها و یادگارهای باستانی' : 'Relics & Arcane Artifacts'}
            </h2>
          </div>
          <p className="text-sm text-zinc-400 max-w-3xl leading-relaxed">
            {isPersian
              ? 'ثبت و مدیریت سلاح‌های کهن، عصاها، زره‌ها و عتیقه‌های نفرین‌شده همراه با لور خزانه‌داری، مراسم آزادسازی، و مدعیان رقیب.'
              : 'Manage mythic weapons, wands, armor, and cursed heirlooms with vault quest hooks, unsealing rituals, and rival seekers.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs bg-amber-500/10 border border-amber-500/20 text-amber-300 px-3.5 py-1.5 rounded-xl font-mono flex items-center gap-1.5">
            <Crown className="w-3.5 h-3.5 text-amber-400" />
            {artifacts.length} {isPersian ? 'یادگار ثبت‌شده' : 'Registered Relics'}
          </span>
          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-zinc-950 text-xs font-bold shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
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
        <button
          onClick={() => setFilterRarity('uncommon')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
            filterRarity === 'uncommon'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-md'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent'
          }`}
        >
          {isPersian ? 'نامعمول' : 'Uncommon'}
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
            const isVaultExpanded = expandedVaultLoreIds.has(art.id);

            return (
              <div
                key={art.id}
                className={`bg-zinc-900/70 border-2 rounded-3xl p-6 backdrop-blur-xl shadow-2xl flex flex-col justify-between transition-all ${meta.borderClass} ${meta.glowClass} space-y-4`}
              >
                <div className="space-y-4">
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-3">
                    <span className={`px-3 py-1 rounded-xl text-xs font-bold border ${meta.badgeClass}`}>
                      {isPersian ? meta.labelFa : meta.labelEn}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleGenerateVaultLore(art)}
                        disabled={generatingVaultArtifactId === art.id}
                        className="px-2.5 py-1 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10.5px] font-bold flex items-center gap-1 transition-all"
                        title="Generate Vault Lore"
                      >
                        <Key className="w-3.5 h-3.5" />
                        <span>
                          {generatingVaultArtifactId === art.id
                            ? isPersian
                              ? 'سنتز...'
                              : 'Synthesizing...'
                            : isPersian
                            ? '🗝️ خزانه‌داری'
                            : '🗝️ Vault'}
                        </span>
                      </button>

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
                    <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                      <Sword className="w-4 h-4 text-amber-400" />
                      {art.name}
                    </h3>
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

                  {/* Attunement Rules */}
                  {art.attunementRules && (
                    <div className="p-3 rounded-2xl bg-zinc-950/40 border border-zinc-800 text-xs text-zinc-300 space-y-1">
                      <span className="text-zinc-400 font-bold block text-[10.5px]">
                        {isPersian ? 'شرایط تسخیر (Attunement):' : 'Attunement Requirements:'}
                      </span>
                      <p className="text-zinc-300">{art.attunementRules}</p>
                    </div>
                  )}

                  {/* Curse or Cost (Legendary / Mythic) */}
                  {art.curseOrCost && (
                    <div className="p-3 rounded-2xl bg-red-950/20 border border-red-500/20 text-xs text-red-300 space-y-1">
                      <span className="text-red-400 font-bold block text-[10.5px]">
                        ☠️ {isPersian ? 'نفرین و بهای تسخیر:' : 'Double-Edged Curse / Dark Cost:'}
                      </span>
                      <p className="text-red-300/90 leading-relaxed">{art.curseOrCost}</p>
                    </div>
                  )}

                  {/* Plan 05: Vault Lore & Quest Hooks Drawer */}
                  <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-2xl overflow-hidden">
                    <div
                      onClick={() => toggleVaultLoreExpand(art.id)}
                      className="p-3 flex items-center justify-between cursor-pointer hover:bg-zinc-900/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Key className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-bold text-zinc-200">
                          {isPersian ? 'لور خزانه‌داری و قلاب‌های مأموریت' : 'Vault Lore & Quest Hooks'}
                        </span>
                        {art.vaultLore ? (
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-lg font-mono">
                            {isPersian ? 'ثبت‌شده' : 'Configured'}
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-500 italic">
                            {isPersian ? '(خالی)' : '(Unset)'}
                          </span>
                        )}
                      </div>
                      {isVaultExpanded ? (
                        <ChevronUp className="w-4 h-4 text-zinc-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-zinc-400" />
                      )}
                    </div>

                    {isVaultExpanded && (
                      <div className="p-3.5 pt-0 space-y-2.5 text-xs border-t border-zinc-900 animate-fadeIn">
                        {art.vaultLore ? (
                          <>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800">
                                <span className="text-[10px] text-zinc-500 block">{isPersian ? 'سازنده کهن:' : 'Creator:'}</span>
                                <strong className="text-zinc-200">{art.vaultLore.creator}</strong>
                              </div>
                              <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800">
                                <span className="text-[10px] text-zinc-500 block">{isPersian ? 'مکان خزانه:' : 'Vault Site:'}</span>
                                <strong className="text-amber-300">{art.vaultLore.currentVaultLocation}</strong>
                              </div>
                            </div>

                            <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1">
                              <span className="text-[10px] text-zinc-500 block">
                                🔮 {isPersian ? 'آیین رمزگشایی و گشودن خزانه:' : 'Unsealing Ritual:'}
                              </span>
                              <p className="text-zinc-300 text-[11px] leading-relaxed">{art.vaultLore.unsealingRitual}</p>
                            </div>

                            {art.vaultLore.rivalSeekers && art.vaultLore.rivalSeekers.length > 0 && (
                              <div>
                                <span className="text-[10px] text-zinc-500 block mb-1">
                                  ⚔️ {isPersian ? 'جویندگان و رقبای مدعی:' : 'Rival Seekers:'}
                                </span>
                                <div className="flex flex-wrap gap-1">
                                  {art.vaultLore.rivalSeekers.map((seek, sIdx) => (
                                    <span
                                      key={sIdx}
                                      className="px-2 py-0.5 rounded-lg bg-zinc-900 text-rose-300 border border-rose-500/20 text-[10px]"
                                    >
                                      {seek}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-center py-3 text-zinc-500 text-xs space-y-1">
                            <p>{isPersian ? 'لور خزانه‌داری برای این یادگار ثبت نشده است.' : 'No vault lore registered.'}</p>
                            <button
                              type="button"
                              onClick={() => handleGenerateVaultLore(art)}
                              className="text-amber-400 font-bold hover:underline"
                            >
                              {isPersian ? 'اکنون با هوش مصنوعی تولید کنید' : 'Generate with AI now'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Holder Tag */}
                <div className="pt-3 border-t border-zinc-800 text-[11px] text-zinc-400 flex items-center justify-between">
                  <span className="flex items-center gap-1 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-amber-400" />
                    {holderText}
                  </span>
                  <span className="font-mono text-zinc-500 text-[10px]" dir="ltr">{art.originEra}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Plan 05: Vault Lore Preview Modal */}
      {vaultLorePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-400" />
                {isPersian ? 'پیش‌نمایش لور خزانه‌داری و نفرین' : 'Vault Lore & Relic Preview'}
              </h3>
              <button
                onClick={() => setVaultLorePreview(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-2xl bg-zinc-950 border border-zinc-800">
                <span className="text-[10px] text-zinc-500 block">{isPersian ? 'یادگار مورد نظر:' : 'Target Relic:'}</span>
                <strong className="text-zinc-100 text-sm">{vaultLorePreview.targetArtifact.name}</strong>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 block">{isPersian ? 'سازنده:' : 'Creator:'}</span>
                  <strong className="text-zinc-200">{vaultLorePreview.payload.vaultLore.creator}</strong>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 block">{isPersian ? 'مکان خزانه:' : 'Vault Site:'}</span>
                  <strong className="text-amber-300">{vaultLorePreview.payload.vaultLore.currentVaultLocation}</strong>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                <span className="text-[10px] text-amber-400 font-bold block">
                  🔮 {isPersian ? 'مراسم گشودن قفل خزانه:' : 'Unsealing Ritual:'}
                </span>
                <p className="text-zinc-300 leading-relaxed">{vaultLorePreview.payload.vaultLore.unsealingRitual}</p>
              </div>

              {vaultLorePreview.payload.doubleEdgedCurse && (
                <div className="p-3 rounded-xl bg-red-950/20 border border-red-500/20 space-y-1 text-red-300">
                  <span className="text-[10px] text-red-400 font-bold block">
                    ☠️ {isPersian ? 'نفرین و بهای تسخیر:' : 'Double-Edged Curse:'}
                  </span>
                  <p className="leading-relaxed">{vaultLorePreview.payload.doubleEdgedCurse}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setVaultLorePreview(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700"
              >
                {isPersian ? 'انصراف' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleCommitVaultLore}
                className="px-5 py-2 rounded-xl bg-amber-500 text-zinc-950 text-xs font-bold shadow-lg shadow-amber-500/20 flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{isPersian ? '📥 ثبت لور خزانه‌داری' : '📥 Save Vault Lore'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Artifact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                {editingArtifactId
                  ? isPersian
                    ? 'ویرایش یادگار باستانی'
                    : 'Edit Ancient Relic'
                  : isPersian
                  ? 'ثبت دست‌سازه و عتیقه جدید'
                  : 'Register New Relic'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveArtifact} className="space-y-4">
              <AiFillSection type="artifact" onFilled={applyAiFill} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'نام عتیقه / دست‌سازه:' : 'Artifact Name:'}
                  </label>
                  <input
                    type="text"
                    value={artName}
                    onChange={(e) => setArtName(e.target.value)}
                    placeholder={isPersian ? 'مثال: چشم پیشگو' : 'e.g. Eye of the Augur'}
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
                    value={artTitle}
                    onChange={(e) => setArtTitle(e.target.value)}
                    placeholder={isPersian ? 'مثال: چشم بلورین کهن' : 'e.g. The First Glass of Scrying'}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'رده نایابی (Rarity):' : 'Rarity Tier:'}
                  </label>
                  <select
                    value={artRarity}
                    onChange={(e) => setArtRarity(e.target.value as any)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                  >
                    <option value="uncommon">{isPersian ? 'نامعمول (Uncommon)' : 'Uncommon'}</option>
                    <option value="rare">{isPersian ? 'کمیاب (Rare)' : 'Rare'}</option>
                    <option value="epic">{isPersian ? 'حماسی (Epic)' : 'Epic'}</option>
                    <option value="legendary">{isPersian ? 'افسانه‌ای (Legendary)' : 'Legendary'}</option>
                    <option value="mythic">{isPersian ? 'اسطوره‌ای / کیهانی (Mythic)' : 'Mythic'}</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'عصر و دوران پیدایش:' : 'Origin Era:'}
                  </label>
                  <input
                    type="text"
                    value={artOriginEra}
                    onChange={(e) => setArtOriginEra(e.target.value)}
                    placeholder={isPersian ? 'مثال: دوران نخستین' : 'e.g. The First Age'}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                  {isPersian ? 'توضیحات ظاهری و حس فیزیکی:' : 'Description & Physical Appearance:'}
                </label>
                <textarea
                  rows={2}
                  value={artDesc}
                  onChange={(e) => setArtDesc(e.target.value)}
                  placeholder={isPersian ? 'شکل ظاهری، سنگینی، جنس و هاله جادویی...' : 'Appearance, material, tactile feel...'}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                  {isPersian ? 'نیروها و اثرات (هر سطر یک قدرت):' : 'Powers & Resonance (One per line):'}
                </label>
                <textarea
                  rows={2}
                  value={artPowers}
                  onChange={(e) => setArtPowers(e.target.value)}
                  placeholder={isPersian ? 'دیدن در تاریکی تا ۳۰ گام\nافزایش مهارت Arcana' : 'True sight\n+2 to Arcana checks'}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Vault Lore Inputs in Modal */}
              <div className="p-3.5 rounded-2xl bg-zinc-950/80 border border-amber-500/20 space-y-3">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5" />
                  {isPersian ? 'قلاب‌های مأموریت و خزانه‌داری (اختیاری):' : 'Vault Lore & Quest Hooks (Optional):'}
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">{isPersian ? 'سازنده کهن:' : 'Creator:'}</label>
                    <input
                      type="text"
                      value={vaultCreator}
                      onChange={(e) => setVaultCreator(e.target.value)}
                      placeholder="e.g. Grand Artificer Kenneth"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">{isPersian ? 'مکان خزانه:' : 'Vault Site:'}</label>
                    <input
                      type="text"
                      value={vaultLocation}
                      onChange={(e) => setVaultLocation(e.target.value)}
                      placeholder="e.g. Sunken Crypt"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">{isPersian ? 'آیین رمزگشایی و گشودن قفل:' : 'Unsealing Ritual:'}</label>
                  <input
                    type="text"
                    value={vaultRitual}
                    onChange={(e) => setVaultRitual(e.target.value)}
                    placeholder="e.g. Submerge in holy water under full moon"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'شرایط تسخیر (Attunement):' : 'Attunement Conditions:'}
                  </label>
                  <input
                    type="text"
                    value={artAttunement}
                    onChange={(e) => setArtAttunement(e.target.value)}
                    placeholder={isPersian ? 'مثال: نیاز به Arcana 3 و سوگند وفاداری' : 'e.g. Requires Arcana 3'}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-red-400 block mb-1.5">
                    {isPersian ? 'نفرین یا بهای جادویی (مخصوص سطوح بالا):' : 'Double-Edged Curse / Cost:'}
                  </label>
                  <input
                    type="text"
                    value={artCurse}
                    onChange={(e) => setArtCurse(e.target.value)}
                    placeholder={isPersian ? 'مثال: سردردهای میگرنی شدید' : 'e.g. Induces memory haze'}
                    className="w-full bg-zinc-950 border border-red-500/30 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-red-400"
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
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold shadow-lg shadow-amber-500/20"
                >
                  {editingArtifactId
                    ? isPersian
                      ? 'ذخیره تغییرات'
                      : 'Update Relic'
                    : isPersian
                    ? 'ثبت در گنجینه'
                    : 'Save Relic'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
