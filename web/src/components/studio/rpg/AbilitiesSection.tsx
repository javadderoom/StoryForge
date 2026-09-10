'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import {
  Sparkles,
  Plus,
  Edit2,
  Trash2,
  X,
  Lock,
  Globe,
  Zap,
  Clock,
  Flame,
  Search,
} from 'lucide-react';
import {
  AbilityDefinition,
  AbilityType,
  StatDefinition,
  ResourceDefinition,
  ArchetypeDefinition,
} from '@/lib/types';
import { notify } from '@/lib/notify';

interface AbilitiesSectionProps {
  abilities: AbilityDefinition[];
  stats: StatDefinition[];
  resources: ResourceDefinition[];
  archetypes: ArchetypeDefinition[];
  isPersian: boolean;
  updateRpgSystem: (updater: (prev: any) => any) => void;
}

const ABILITY_TYPE_CONFIG: Record<
  AbilityType,
  { labelEn: string; labelFa: string; color: string; bg: string; border: string; icon: string }
> = {
  active_spell: {
    labelEn: 'Active Spell',
    labelFa: 'طلسم فعال',
    color: 'text-cyan-300',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    icon: '✨',
  },
  active_technique: {
    labelEn: 'Combat Technique',
    labelFa: 'تکنیک مبارزه',
    color: 'text-amber-300',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    icon: '⚔️',
  },
  passive_skill: {
    labelEn: 'Passive Skill',
    labelFa: 'مهارت غیرفعال',
    color: 'text-emerald-300',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    icon: '🛡️',
  },
  passive_feat: {
    labelEn: 'Talent / Feat',
    labelFa: 'استعداد ویژه',
    color: 'text-purple-300',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    icon: '🌟',
  },
};

export function AbilitiesSection({
  abilities = [],
  stats = [],
  resources = [],
  archetypes = [],
  isPersian,
  updateRpgSystem,
}: AbilitiesSectionProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAbilityId, setEditingAbilityId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterArchetype, setFilterArchetype] = useState<string>('all');

  const [form, setForm] = useState<AbilityDefinition>({
    id: '',
    name: '',
    description: '',
    type: 'active_spell',
    icon: '✨',
    tier: 1,
    linkedStatId: '',
    cost: undefined,
    cooldownTurns: 0,
    effectSummary: '',
    allowedArchetypeIds: [],
    tags: [],
  });

  const openModal = (ability?: AbilityDefinition) => {
    if (ability) {
      setEditingAbilityId(ability.id);
      setForm({
        ...ability,
        cost: ability.cost ? { ...ability.cost } : undefined,
        allowedArchetypeIds: ability.allowedArchetypeIds ? [...ability.allowedArchetypeIds] : [],
        tags: ability.tags ? [...ability.tags] : [],
      });
    } else {
      setEditingAbilityId(null);
      setForm({
        id: `ab_${Date.now().toString(36)}`,
        name: '',
        description: '',
        type: 'active_spell',
        icon: '✨',
        tier: 1,
        linkedStatId: stats[0]?.id || '',
        cost: resources[0] ? { targetResourceId: resources[0].id, amount: 10 } : undefined,
        cooldownTurns: 0,
        effectSummary: '',
        allowedArchetypeIds: [],
        tags: [],
      });
    }
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      notify.error(isPersian ? 'نام توانایی الزامی است' : 'Ability name is required');
      return;
    }

    const payload: AbilityDefinition = {
      ...form,
      name: form.name.trim(),
      description: form.description.trim(),
      effectSummary: form.effectSummary?.trim() || undefined,
      linkedStatId: form.linkedStatId || undefined,
      cost:
        form.cost && form.cost.amount > 0 && form.cost.targetResourceId
          ? { targetResourceId: form.cost.targetResourceId, amount: Number(form.cost.amount) }
          : undefined,
      cooldownTurns: form.cooldownTurns && form.cooldownTurns > 0 ? Number(form.cooldownTurns) : 0,
      allowedArchetypeIds:
        form.allowedArchetypeIds && form.allowedArchetypeIds.length > 0
          ? form.allowedArchetypeIds
          : undefined,
    };

    updateRpgSystem((prev: any) => {
      const currentAbilities: AbilityDefinition[] = prev.abilities || [];
      const updated = editingAbilityId
        ? currentAbilities.map((a) => (a.id === editingAbilityId ? payload : a))
        : [...currentAbilities, payload];

      return {
        ...prev,
        abilities: updated,
      };
    });

    setModalOpen(false);
    notify.success(isPersian ? 'توانایی با موفقیت ذخیره شد' : 'Ability saved successfully');
  };

  const handleDelete = async (ability: AbilityDefinition) => {
    const confirmed = await notify.confirm({
      title: isPersian ? 'حذف توانایی' : 'Delete Ability',
      message: isPersian
        ? `آیا از حذف توانایی یا طلسم "${ability.name}" اطمینان دارید؟`
        : `Are you sure you want to delete the ability "${ability.name}"?`,
      confirmText: isPersian ? 'حذف شود' : 'Delete',
      cancelText: isPersian ? 'انصراف' : 'Cancel',
      isDestructive: true,
    });

    if (confirmed) {
      updateRpgSystem((prev: any) => ({
        ...prev,
        abilities: (prev.abilities || []).filter((a: any) => a.id !== ability.id),
      }));
      notify.info(isPersian ? 'توانایی حذف شد' : 'Ability deleted');
    }
  };

  // Filtered view
  const filteredAbilities = abilities.filter((ab) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = ab.name.toLowerCase().includes(q);
      const matchDesc = ab.description?.toLowerCase().includes(q);
      const matchEffect = ab.effectSummary?.toLowerCase().includes(q);
      if (!matchName && !matchDesc && !matchEffect) return false;
    }
    if (filterType !== 'all' && ab.type !== filterType) return false;
    if (filterArchetype !== 'all') {
      if (filterArchetype === 'universal') {
        if (ab.allowedArchetypeIds && ab.allowedArchetypeIds.length > 0) return false;
      } else {
        if (!ab.allowedArchetypeIds || !ab.allowedArchetypeIds.includes(filterArchetype)) {
          return false;
        }
      }
    }
    return true;
  });

  return (
    <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 shadow-xl space-y-6">
      {/* Header & Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-5">
        <div>
          <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>{isPersian ? 'کتاب طلسم‌ها و توانایی‌ها (Grimoire)' : 'Abilities, Spells & Techniques'}</span>
            <span className="text-xs font-mono bg-cyan-500/10 text-cyan-300 px-2 py-0.5 rounded-lg border border-cyan-500/20">
              {abilities.length}
            </span>
          </h3>
          <p className="text-[11px] text-zinc-400 mt-1">
            {isPersian
              ? 'جادوها، فنون مبارزه و مهارت‌های ویژه با هزینه منابع و قفل‌گذاری کلاسی'
              : 'Active spells, combat techniques, and passive talents with resource costs and archetype restrictions'}
          </p>
        </div>

        <button
          onClick={() => openModal()}
          className="text-xs flex items-center gap-1.5 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 px-4 py-2 rounded-xl border border-cyan-500/30 transition-all font-semibold cursor-pointer shrink-0 self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{isPersian ? '+ توانایی / طلسم جدید' : '+ Add Ability / Spell'}</span>
        </button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isPersian ? 'جستجوی نام یا اثر توانایی...' : 'Search ability or effect...'}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Type Filter */}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-cyan-500"
        >
          <option value="all">{isPersian ? 'همه انواع توانایی' : 'All Ability Types'}</option>
          <option value="active_spell">{isPersian ? '✨ طلسم‌های فعال' : '✨ Active Spells'}</option>
          <option value="active_technique">{isPersian ? '⚔️ تکنیک‌های مبارزه' : '⚔️ Combat Techniques'}</option>
          <option value="passive_skill">{isPersian ? '🛡️ مهارت‌های غیرفعال' : '🛡️ Passive Skills'}</option>
          <option value="passive_feat">{isPersian ? '🌟 استعدادهای ویژه' : '🌟 Talents & Feats'}</option>
        </select>

        {/* Archetype Filter */}
        <select
          value={filterArchetype}
          onChange={(e) => setFilterArchetype(e.target.value)}
          className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-cyan-500"
        >
          <option value="all">{isPersian ? 'همه کلاس‌ها' : 'All Archetypes'}</option>
          <option value="universal">{isPersian ? '🌐 فراگیر (همه کلاس‌ها)' : '🌐 Universal Only'}</option>
          {archetypes.map((a) => (
            <option key={a.id} value={a.id}>
              🔒 {a.name}
            </option>
          ))}
        </select>
      </div>

      {/* Grid of Abilities */}
      {filteredAbilities.length === 0 ? (
        <div className="text-center py-12 text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-2xl p-6">
          <Sparkles className="w-8 h-8 text-zinc-600 mx-auto mb-2 opacity-50" />
          <p className="font-medium">
            {isPersian
              ? 'هیچ توانایی یا طلسمی مطابق با فیلترها یافت نشد.'
              : 'No abilities or spells match your filter criteria.'}
          </p>
          <p className="text-[11px] text-zinc-600 mt-1">
            {isPersian
              ? 'روی «+ توانایی / طلسم جدید» کلیک کنید تا اولین جادو یا مهارت را ثبت نمایید.'
              : 'Click "+ Add Ability / Spell" to create your first spell or technique.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAbilities.map((ab) => {
            const typeCfg = ABILITY_TYPE_CONFIG[ab.type] || ABILITY_TYPE_CONFIG.active_spell;
            const resCost = ab.cost?.targetResourceId
              ? resources.find((r) => r.id === ab.cost?.targetResourceId)
              : null;
            const linkedStat = ab.linkedStatId
              ? stats.find((s) => s.id === ab.linkedStatId)
              : null;
            const isUniversal = !ab.allowedArchetypeIds || ab.allowedArchetypeIds.length === 0;

            return (
              <div
                key={ab.id}
                className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800/80 hover:border-cyan-500/40 transition-all flex flex-col justify-between space-y-3 group"
              >
                <div className="space-y-2">
                  {/* Top row: Icon, Name & Actions */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{ab.icon || typeCfg.icon}</span>
                      <div>
                        <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5">
                          <span>{ab.name}</span>
                          {ab.tier && ab.tier > 1 && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
                              T{ab.tier}
                            </span>
                          )}
                        </h4>
                        <span className="text-[10px] font-mono text-zinc-500">{ab.id}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => openModal(ab)}
                        className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-cyan-300 transition-all"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(ab)}
                        className="p-1 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Badges Row: Type & Archetype Restriction */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${typeCfg.bg} ${typeCfg.color} ${typeCfg.border}`}
                    >
                      {isPersian ? typeCfg.labelFa : typeCfg.labelEn}
                    </span>

                    {isUniversal ? (
                      <span className="text-[10px] bg-zinc-800/80 text-zinc-300 px-2 py-0.5 rounded-md border border-zinc-700/60 flex items-center gap-1">
                        <Globe className="w-2.5 h-2.5 text-zinc-400" />
                        <span>{isPersian ? 'فراگیر (همه)' : 'Universal'}</span>
                      </span>
                    ) : (
                      <span className="text-[10px] bg-purple-500/10 text-purple-300 px-2 py-0.5 rounded-md border border-purple-500/20 flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5 text-purple-400" />
                        <span>
                          {ab.allowedArchetypeIds
                            ?.map((archId) => archetypes.find((a) => a.id === archId)?.name || archId)
                            .join(', ')}
                        </span>
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  {ab.description && (
                    <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
                      {ab.description}
                    </p>
                  )}

                  {/* Mechanical Effect Summary */}
                  {ab.effectSummary && (
                    <div className="p-2 rounded-xl bg-zinc-900/90 border border-zinc-800 text-[11px] text-zinc-300 flex items-start gap-1.5">
                      <Zap className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                      <span className="leading-snug">{ab.effectSummary}</span>
                    </div>
                  )}
                </div>

                {/* Bottom Row: Cost, Cooldown, Linked Stat */}
                <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-zinc-900 text-[11px]">
                  <div className="flex items-center gap-2">
                    {ab.cost && ab.cost.amount > 0 ? (
                      <span
                        className="font-mono font-bold px-2 py-0.5 rounded-md border flex items-center gap-1"
                        style={{
                          backgroundColor: `${resCost?.color || '#3b82f6'}15`,
                          borderColor: `${resCost?.color || '#3b82f6'}40`,
                          color: resCost?.color || '#60a5fa',
                        }}
                      >
                        <Flame className="w-3 h-3" />
                        <span>
                          {ab.cost.amount} {resCost?.name || ab.cost.targetResourceId}
                        </span>
                      </span>
                    ) : (
                      <span className="text-zinc-500 text-[10px]">
                        {isPersian ? 'رایگان / بدون هزینه' : 'Free / Passive'}
                      </span>
                    )}

                    {ab.cooldownTurns && ab.cooldownTurns > 0 ? (
                      <span className="text-zinc-400 font-mono text-[10px] flex items-center gap-1">
                        <Clock className="w-3 h-3 text-zinc-500" />
                        <span>{ab.cooldownTurns}T CD</span>
                      </span>
                    ) : null}
                  </div>

                  {linkedStat && (
                    <span className="text-[10px] text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                      {linkedStat.name}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Add / Edit Ability */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>
                  {editingAbilityId
                    ? isPersian
                      ? 'ویرایش توانایی / طلسم'
                      : 'Edit Ability / Spell'
                    : isPersian
                      ? 'افزودن توانایی یا طلسم جدید'
                      : 'Add New Ability / Spell'}
                </span>
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Name, Icon, Type */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-2 space-y-1">
                  <label className="block text-xs font-bold text-zinc-300">
                    {isPersian ? 'آیکون' : 'Icon'}
                  </label>
                  <input
                    type="text"
                    value={form.icon || '✨'}
                    onChange={(e) => setForm({ ...form, icon: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2 py-2 text-center text-lg focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="md:col-span-6 space-y-1">
                  <label className="block text-xs font-bold text-zinc-300">
                    {isPersian ? 'نام توانایی / طلسم' : 'Ability / Spell Name'} *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder={isPersian ? 'مانند: گلوله آتشین، پرش سایه' : 'e.g. Fireball, Shadow Step'}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="md:col-span-4 space-y-1">
                  <label className="block text-xs font-bold text-zinc-300">
                    {isPersian ? 'نوع قابلیت' : 'Ability Type'}
                  </label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as AbilityType })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="active_spell">
                      {isPersian ? '✨ طلسم فعال (Active Spell)' : '✨ Active Spell'}
                    </option>
                    <option value="active_technique">
                      {isPersian ? '⚔️ تکنیک مبارزه (Technique)' : '⚔️ Combat Technique'}
                    </option>
                    <option value="passive_skill">
                      {isPersian ? '🛡️ مهارت غیرفعال (Skill)' : '🛡️ Passive Skill'}
                    </option>
                    <option value="passive_feat">
                      {isPersian ? '🌟 استعداد ویژه (Feat)' : '🌟 Talent / Feat'}
                    </option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-zinc-300">
                  {isPersian ? 'توضیحات روایی' : 'Narrative Description'}
                </label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder={
                    isPersian
                      ? 'توصیف بصری و چگونگی جریان یافتن انرژی یا اجرای این تکنیک...'
                      : 'Visual and sensory description of how this power manifests...'
                  }
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-100 focus:outline-none focus:border-cyan-500 leading-relaxed"
                />
              </div>

              {/* Effect Summary */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" />
                  <span>{isPersian ? 'خلاصه اثر مکانیکی' : 'Mechanical Effect Summary'}</span>
                </label>
                <input
                  type="text"
                  value={form.effectSummary || ''}
                  onChange={(e) => setForm({ ...form, effectSummary: e.target.value })}
                  placeholder={
                    isPersian
                      ? 'مانند: ۲۵ آسیب آتش به یک منطقه یا +۲ پاداش در مخفی‌کاری'
                      : 'e.g. 25 Fire damage in an area, or +2 bonus to stealth checks'
                  }
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Cost & Cooldown & Linked Stat */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-2xl bg-zinc-950 border border-zinc-800">
                {/* Resource Cost */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-cyan-400">
                    ⚡ {isPersian ? 'هزینه مصرف منبع' : 'Resource Cost'}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      value={form.cost?.amount ?? 0}
                      onChange={(e) => {
                        const amt = Number(e.target.value);
                        setForm({
                          ...form,
                          cost:
                            amt > 0
                              ? {
                                  targetResourceId: form.cost?.targetResourceId || resources[0]?.id || 'mana',
                                  amount: amt,
                                }
                              : undefined,
                        });
                      }}
                      className="w-20 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-center font-mono text-cyan-300"
                      dir="ltr"
                    />
                    <select
                      value={form.cost?.targetResourceId || resources[0]?.id || ''}
                      onChange={(e) => {
                        const targetId = e.target.value;
                        setForm({
                          ...form,
                          cost: form.cost ? { ...form.cost, targetResourceId: targetId } : { targetResourceId: targetId, amount: 10 },
                        });
                      }}
                      className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-300"
                    >
                      {resources.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Cooldown */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-zinc-400">
                    ⏳ {isPersian ? 'زمان خنک‌شدن (نوبت)' : 'Cooldown (Turns)'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.cooldownTurns ?? 0}
                    onChange={(e) => setForm({ ...form, cooldownTurns: Number(e.target.value) })}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-center font-mono text-zinc-300"
                    dir="ltr"
                  />
                </div>

                {/* Linked Stat */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-zinc-400">
                    🎲 {isPersian ? 'ویژگی مرتبط (Stat)' : 'Linked Attribute'}
                  </label>
                  <select
                    value={form.linkedStatId || ''}
                    onChange={(e) => setForm({ ...form, linkedStatId: e.target.value || undefined })}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-300"
                  >
                    <option value="">{isPersian ? '— بدون ویژگی —' : '— None / Pure —'}</option>
                    {stats.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Class Gating (Archetype Restriction) */}
              <div className="space-y-2 p-4 rounded-2xl bg-zinc-950 border border-zinc-800">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-purple-400 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    <span>{isPersian ? 'قفل‌گذاری کلاسی (Archetype Gating)' : 'Class / Archetype Gating'}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, allowedArchetypeIds: [] })}
                    className="text-[11px] text-purple-300 hover:underline cursor-pointer"
                  >
                    {isPersian ? 'تبدیل به فراگیر (همگانی)' : 'Make Universal (All Classes)'}
                  </button>
                </div>

                <p className="text-[11px] text-zinc-500">
                  {isPersian
                    ? 'مشخص کنید این قابلیت فقط برای کدام کلاس‌ها مجاز است. در صورت خالی ماندن، همه کلاس‌ها می‌توانند از آن استفاده کنند.'
                    : 'Select which archetypes can learn or cast this ability. Leave all unchecked for universal access.'}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                  {archetypes.map((arch) => {
                    const isChecked = form.allowedArchetypeIds?.includes(arch.id) ?? false;
                    return (
                      <label
                        key={arch.id}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-purple-500/15 border-purple-500/50 text-purple-200'
                            : 'bg-zinc-900/70 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const cur = form.allowedArchetypeIds ? [...form.allowedArchetypeIds] : [];
                            if (e.target.checked) {
                              if (!cur.includes(arch.id)) cur.push(arch.id);
                            } else {
                              const idx = cur.indexOf(arch.id);
                              if (idx !== -1) cur.splice(idx, 1);
                            }
                            setForm({ ...form, allowedArchetypeIds: cur });
                          }}
                          className="rounded border-zinc-700 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-xs font-medium truncate">{arch.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold cursor-pointer"
                >
                  {isPersian ? 'انصراف' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold cursor-pointer"
                >
                  {isPersian ? 'ذخیره توانایی' : 'Save Ability'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
