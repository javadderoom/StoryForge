'use client';

import React, { useState } from 'react';
import { useStudioStory } from '@/lib/context/StudioStoryContext';
import {
  Tag,
  Share2,
  MapPin,
  Scale,
  Users,
  Plus,
  Trash2,
  Edit2,
  X,
  Sparkles,
  Layers,
  ArrowRight,
  Crown,
} from 'lucide-react';
import { CustomRelationType, CustomPlaceCategory, CustomLawCategory, CustomNPCRole, CustomDomain } from '@/lib/types';
import { notify } from '@/lib/notify';

const QUICK_COLORS = [
  '#38BDF8', // Sky
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#A855F7', // Purple
  '#EF4444', // Red
  '#EC4899', // Pink
  '#14B8A6', // Teal
  '#6366F1', // Indigo
  '#F97316', // Orange
  '#FB7185', // Rose
];

type EntityCategory = 'location' | 'npc' | 'faction' | 'law' | 'any';

export default function TypesStudioPage() {
  const {
    story,
    isPersian,
    addCustomRelationType,
    editCustomRelationType,
    deleteCustomRelationType,
    addPlaceCategory,
    editPlaceCategory,
    deletePlaceCategory,
    addLawCategory,
    editLawCategory,
    deleteLawCategory,
    addNpcRole,
    editNpcRole,
    deleteNpcRole,
    addDomain,
    editDomain,
    deleteDomain,
  } = useStudioStory();

  const [activeTab, setActiveTab] = useState<'relations' | 'places' | 'laws' | 'roles' | 'domains'>('relations');

  // Form states
  const [showAddRelation, setShowAddRelation] = useState(false);
  const [editingRel, setEditingRel] = useState<CustomRelationType | null>(null);
  const [newRelName, setNewRelName] = useState('');
  const [newRelId, setNewRelId] = useState('');
  const [newRelDesc, setNewRelDesc] = useState('');
  const [newRelSource, setNewRelSource] = useState<'location' | 'npc' | 'faction' | 'law' | 'any'>('any');
  const [newRelTarget, setNewRelTarget] = useState<'location' | 'npc' | 'faction' | 'law' | 'any'>('any');
  const [newRelColor, setNewRelColor] = useState('#38BDF8');
  const [newRelDirected, setNewRelDirected] = useState(true);

  const [showAddPlace, setShowAddPlace] = useState(false);
  const [editingPlace, setEditingPlace] = useState<CustomPlaceCategory | null>(null);
  const [newPlaceName, setNewPlaceName] = useState('');
  const [newPlaceId, setNewPlaceId] = useState('');
  const [newPlaceDesc, setNewPlaceDesc] = useState('');
  const [newPlaceColor, setNewPlaceColor] = useState('#6366F1');
  const [newPlaceDanger, setNewPlaceDanger] = useState<1 | 2 | 3 | 4 | 5>(3);

  const [showAddLaw, setShowAddLaw] = useState(false);
  const [editingLaw, setEditingLaw] = useState<CustomLawCategory | null>(null);
  const [newLawName, setNewLawName] = useState('');
  const [newLawId, setNewLawId] = useState('');
  const [newLawDesc, setNewLawDesc] = useState('');
  const [newLawColor, setNewLawColor] = useState('#A855F7');

  const [showAddRole, setShowAddRole] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomNPCRole | null>(null);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleId, setNewRoleId] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [newRoleColor, setNewRoleColor] = useState('#F59E0B');

  const [showAddDomain, setShowAddDomain] = useState(false);
  const [editingDomain, setEditingDomain] = useState<CustomDomain | null>(null);
  const [newDomainName, setNewDomainName] = useState('');
  const [newDomainId, setNewDomainId] = useState('');
  const [newDomainDesc, setNewDomainDesc] = useState('');
  const [newDomainColor, setNewDomainColor] = useState('#F59E0B');

  const ontology = story.worldBible.ontology || {
    relationTypes: [],
    placeCategories: [],
    lawCategories: [],
    npcRoles: [],
    domains: [],
  };

  // How many world entities reference a given type (used to warn before deletion)
  const relationUsage = (id: string) =>
    (story.worldBible.customRelations ?? []).filter((r) => r.relationTypeId === id).length;
  const placeUsage = (id: string) => story.worldBible.locations.filter((l) => l.category === id).length;
  const lawUsage = (id: string) => story.worldBible.laws.filter((l) => l.category === id).length;
  const roleUsage = (id: string) => story.worldBible.npcs.filter((n) => n.role === id).length;
  const domainUsage = (id: string) => story.worldBible.religions?.filter((d) => d.domain === id).length || 0;

  const confirmDelete = async (opts: {
    name: string;
    title: string;
    isDefault?: boolean;
    used: number;
    onConfirm: () => void;
  }) => {
    const def = opts.isDefault
      ? isPersian
        ? ' (این یک نوع پیش‌فرضِ بذر شده است)'
        : ' (This is a seeded default type)'
      : '';
    const use = opts.used > 0
      ? isPersian
        ? ` توجه: ${opts.used} مورد از این نوع استفاده می‌کنند.`
        : ` Note: ${opts.used} item(s) currently reference this type.`
      : '';
    const conf = await notify.confirm({
      title: opts.title,
      message:
        (isPersian ? `آیا از حذف "${opts.name}" مطمئن هستید؟` : `Are you sure you want to remove "${opts.name}"?`) +
        def +
        use,
      confirmText: isPersian ? 'بله، حذف شود' : 'Delete',
      cancelText: isPersian ? 'انصراف' : 'Cancel',
      isDestructive: true,
    });
    if (conf) opts.onConfirm();
  };

  const resetRelForm = () => {
    setNewRelName('');
    setNewRelId('');
    setNewRelDesc('');
    setNewRelSource('any');
    setNewRelTarget('any');
    setNewRelColor('#38BDF8');
    setNewRelDirected(true);
    setEditingRel(null);
  };
  const openRelAdd = () => {
    resetRelForm();
    setShowAddRelation(true);
  };
  const openRelEdit = (rel: CustomRelationType) => {
    setNewRelName(rel.name);
    setNewRelId(rel.id);
    setNewRelDesc(rel.description);
    setNewRelSource(rel.sourceCategory);
    setNewRelTarget(rel.targetCategory);
    setNewRelColor(rel.color);
    setNewRelDirected(rel.isDirected);
    setEditingRel(rel);
    setShowAddRelation(true);
  };

  const handleCreateRelation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRelName.trim()) {
      notify.error(isPersian ? 'نام پیوند الزامی است' : 'Relation name is required');
      return;
    }
    const finalId = editingRel ? editingRel.id : newRelId.trim() || `rel_${Date.now().toString(36)}`;
    const payload: CustomRelationType = {
      id: finalId,
      name: newRelName.trim(),
      description: newRelDesc.trim(),
      sourceCategory: newRelSource,
      targetCategory: newRelTarget,
      color: newRelColor,
      isDirected: newRelDirected,
    };
    if (editingRel) editCustomRelationType(editingRel.id, payload);
    else addCustomRelationType(payload);
    setShowAddRelation(false);
    resetRelForm();
  };

  const resetPlaceForm = () => {
    setNewPlaceName('');
    setNewPlaceId('');
    setNewPlaceDesc('');
    setNewPlaceColor('#6366F1');
    setNewPlaceDanger(3);
    setEditingPlace(null);
  };
  const openPlaceAdd = () => {
    resetPlaceForm();
    setShowAddPlace(true);
  };
  const openPlaceEdit = (cat: CustomPlaceCategory) => {
    setNewPlaceName(cat.name);
    setNewPlaceId(cat.id);
    setNewPlaceDesc(cat.description);
    setNewPlaceColor(cat.color);
    setNewPlaceDanger(cat.defaultDangerLevel || 3);
    setEditingPlace(cat);
    setShowAddPlace(true);
  };

  const handleCreatePlace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaceName.trim()) {
      notify.error(isPersian ? 'نام دسته‌بندی مکان الزامی است' : 'Place category name is required');
      return;
    }
    const finalId = editingPlace ? editingPlace.id : newPlaceId.trim() || `place_${Date.now().toString(36)}`;
    const payload: CustomPlaceCategory = {
      id: finalId,
      name: newPlaceName.trim(),
      description: newPlaceDesc.trim(),
      color: newPlaceColor,
      defaultDangerLevel: newPlaceDanger,
    };
    if (editingPlace) editPlaceCategory(editingPlace.id, payload);
    else addPlaceCategory(payload);
    setShowAddPlace(false);
    resetPlaceForm();
  };

  const resetLawForm = () => {
    setNewLawName('');
    setNewLawId('');
    setNewLawDesc('');
    setNewLawColor('#A855F7');
    setEditingLaw(null);
  };
  const openLawAdd = () => {
    resetLawForm();
    setShowAddLaw(true);
  };
  const openLawEdit = (lawCat: CustomLawCategory) => {
    setNewLawName(lawCat.name);
    setNewLawId(lawCat.id);
    setNewLawDesc(lawCat.description);
    setNewLawColor(lawCat.color);
    setEditingLaw(lawCat);
    setShowAddLaw(true);
  };

  const handleCreateLaw = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLawName.trim()) {
      notify.error(isPersian ? 'نام دسته‌بندی قانون الزامی است' : 'Law category name is required');
      return;
    }
    const finalId = editingLaw ? editingLaw.id : newLawId.trim() || `law_${Date.now().toString(36)}`;
    const payload: CustomLawCategory = {
      id: finalId,
      name: newLawName.trim(),
      description: newLawDesc.trim(),
      color: newLawColor,
    };
    if (editingLaw) editLawCategory(editingLaw.id, payload);
    else addLawCategory(payload);
    setShowAddLaw(false);
    resetLawForm();
  };

  const resetRoleForm = () => {
    setNewRoleName('');
    setNewRoleId('');
    setNewRoleDesc('');
    setNewRoleColor('#F59E0B');
    setEditingRole(null);
  };
  const openRoleAdd = () => {
    resetRoleForm();
    setShowAddRole(true);
  };
  const openRoleEdit = (role: CustomNPCRole) => {
    setNewRoleName(role.name);
    setNewRoleId(role.id);
    setNewRoleDesc(role.description);
    setNewRoleColor(role.color);
    setEditingRole(role);
    setShowAddRole(true);
  };

  const handleCreateRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) {
      notify.error(isPersian ? 'نام نقش الزامی است' : 'Role name is required');
      return;
    }
    const finalId = editingRole ? editingRole.id : newRoleId.trim() || `role_${Date.now().toString(36)}`;
    const payload: CustomNPCRole = {
      id: finalId,
      name: newRoleName.trim(),
      description: newRoleDesc.trim(),
      color: newRoleColor,
    };
    if (editingRole) editNpcRole(editingRole.id, payload);
    else addNpcRole(payload);
    setShowAddRole(false);
    resetRoleForm();
  };

  const resetDomainForm = () => {
    setNewDomainName('');
    setNewDomainId('');
    setNewDomainDesc('');
    setNewDomainColor('#F59E0B');
    setEditingDomain(null);
  };
  const openDomainAdd = () => {
    resetDomainForm();
    setShowAddDomain(true);
  };
  const openDomainEdit = (domain: CustomDomain) => {
    setNewDomainName(domain.name);
    setNewDomainId(domain.id);
    setNewDomainDesc(domain.description);
    setNewDomainColor(domain.color);
    setEditingDomain(domain);
    setShowAddDomain(true);
  };

  const handleCreateDomain = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDomainName.trim()) {
      notify.error(isPersian ? 'نام حوزه کیهانی الزامی است' : 'Domain name is required');
      return;
    }
    const finalId = editingDomain ? editingDomain.id : newDomainId.trim() || `domain_${Date.now().toString(36)}`;
    const payload: CustomDomain = {
      id: finalId,
      name: newDomainName.trim(),
      description: newDomainDesc.trim(),
      color: newDomainColor,
    };
    if (editingDomain) editDomain(editingDomain.id, payload);
    else addDomain(payload);
    setShowAddDomain(false);
    resetDomainForm();
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-sm shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <Tag className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl md:text-2xl font-bold text-zinc-100">
              {isPersian ? 'مدیریت گونه‌ها و هستی‌شناسی جهان' : 'World Taxonomy & Type Registry'}
            </h2>
          </div>
          <p className="text-sm text-zinc-400 max-w-3xl leading-relaxed">
            {isPersian
              ? 'تعریف گونه‌های سفارشی پیوندها، زیست‌بوم‌های مکانی، دسته‌های قوانین و نقش‌های اجتماعی شخصیت‌ها برای استفاده در گراف بصری و سند جهان.'
              : 'Define custom relation types, location biomes, law categories, and NPC roles used across the visual Lore Graph and World Bible.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-amber-500/10 border border-amber-500/20 text-amber-300 px-3.5 py-1.5 rounded-xl font-mono flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            {(ontology.relationTypes?.length || 0) +
              (ontology.placeCategories?.length || 0) +
              (ontology.lawCategories?.length || 0) +
              (ontology.npcRoles?.length || 0) +
              (ontology.domains?.length || 0)}{' '}
            {isPersian ? 'نوع ثبت‌شده' : 'Registered Types'}
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab('relations')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs md:text-sm font-bold transition-all ${
            activeTab === 'relations'
              ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-lg shadow-amber-500/10'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent'
          }`}
        >
          <Share2 className="w-4 h-4" />
          <span>{isPersian ? 'انواع پیوندها (Relations)' : 'Relation Types'}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-mono">
            {ontology.relationTypes?.length || 0}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('places')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs md:text-sm font-bold transition-all ${
            activeTab === 'places'
              ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-lg shadow-amber-500/10'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>{isPersian ? 'زیست‌بوم‌ها و گونه‌های مکان (Places)' : 'Place Categories'}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-mono">
            {ontology.placeCategories?.length || 0}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('laws')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs md:text-sm font-bold transition-all ${
            activeTab === 'laws'
              ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-lg shadow-amber-500/10'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent'
          }`}
        >
          <Scale className="w-4 h-4" />
          <span>{isPersian ? 'دسته‌بندی قوانین (Laws)' : 'Law Categories'}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-mono">
            {ontology.lawCategories?.length || 0}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('roles')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs md:text-sm font-bold transition-all ${
            activeTab === 'roles'
              ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-lg shadow-amber-500/10'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>{isPersian ? 'نقش‌های شخصیت‌ها (NPC Roles)' : 'NPC Roles'}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-mono">
            {ontology.npcRoles?.length || 0}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('domains')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs md:text-sm font-bold transition-all ${
            activeTab === 'domains'
              ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-lg shadow-amber-500/10'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent'
          }`}
        >
          <Crown className="w-4 h-4" />
          <span>{isPersian ? 'حوزه‌های ایزدان (Domains)' : 'Domains of Gods'}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-mono">
            {ontology.domains?.length || 0}
          </span>
        </button>
      </div>

      {/* TAB 1: RELATION TYPES */}
      {activeTab === 'relations' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <Share2 className="w-4 h-4 text-sky-400" />
              <span>{isPersian ? 'انواع پیوند و اتصالات بین موجودیت‌ها' : 'Entity Relation Taxonomy'}</span>
            </h3>
            <button
              onClick={openRelAdd}
              className="px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-zinc-950 text-xs font-bold shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>{isPersian ? '+ ثبت نوع پیوند جدید' : '+ Add Relation Type'}</span>
            </button>
          </div>

          {/* Add Relation Form Modal / Drawer */}
          {showAddRelation && (
            <form
              onSubmit={handleCreateRelation}
              className="bg-zinc-900/90 border border-amber-500/40 rounded-3xl p-6 backdrop-blur-xl shadow-2xl space-y-4 animate-fadeIn"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <span className="text-sm font-bold text-amber-400 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  {editingRel
                    ? isPersian
                      ? 'ویرایش نوع پیوند'
                      : 'Edit Relation Type'
                    : isPersian
                      ? 'تعریف نوع پیوند سفارشی جدید'
                      : 'New Custom Relation Type'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddRelation(false);
                    resetRelForm();
                  }}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'نام پیوند (فارسی / انگلیسی):' : 'Relation Name:'}
                  </label>
                  <input
                    type="text"
                    value={newRelName}
                    onChange={(e) => setNewRelName(e.target.value)}
                    placeholder={isPersian ? 'مثال: بدهکار خونی، شاگرد و استاد، مسیر قاچاق' : 'e.g. Blood Debt, Mentor & Apprentice'}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'شناسه یکتا (اختیاری):' : 'Unique ID (Optional):'}
                  </label>
                  {editingRel ? (
                    <div className="w-full bg-zinc-800/60 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-400 font-mono">
                      {editingRel.id}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={newRelId}
                      onChange={(e) => setNewRelId(e.target.value)}
                      placeholder="e.g. blood_debt, mentor_apprentice"
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 font-mono focus:outline-none focus:border-amber-400"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                  {isPersian ? 'توضیحات و مفهوم داستانی پیوند:' : 'Lore Description & Semantic Meaning:'}
                </label>
                <textarea
                  rows={2}
                  value={newRelDesc}
                  onChange={(e) => setNewRelDesc(e.target.value)}
                  placeholder={isPersian ? 'این پیوند چه ارتباط یا محدودیتی بین دو موجودیت ایجاد می‌کند...' : 'Describe how this relation impacts lore...'}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'موجودیت مبدا (Source):' : 'Source Entity Category:'}
                  </label>
                  <select
                    value={newRelSource}
                    onChange={(e) => setNewRelSource(e.target.value as EntityCategory)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                  >
                    <option value="any">{isPersian ? 'هر موجودیتی (Any)' : 'Any Entity'}</option>
                    <option value="npc">{isPersian ? 'شخصیت (NPC)' : 'NPC'}</option>
                    <option value="location">{isPersian ? 'مکان (Location)' : 'Location'}</option>
                    <option value="faction">{isPersian ? 'جناح (Faction)' : 'Faction'}</option>
                    <option value="law">{isPersian ? 'قانون (Law)' : 'Law'}</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'موجودیت مقصد (Target):' : 'Target Entity Category:'}
                  </label>
                  <select
                    value={newRelTarget}
                    onChange={(e) => setNewRelTarget(e.target.value as EntityCategory)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                  >
                    <option value="any">{isPersian ? 'هر موجودیتی (Any)' : 'Any Entity'}</option>
                    <option value="npc">{isPersian ? 'شخصیت (NPC)' : 'NPC'}</option>
                    <option value="location">{isPersian ? 'مکان (Location)' : 'Location'}</option>
                    <option value="faction">{isPersian ? 'جناح (Faction)' : 'Faction'}</option>
                    <option value="law">{isPersian ? 'قانون (Law)' : 'Law'}</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'رنگ نمایشی در گراف:' : 'Display Color in Graph:'}
                  </label>
                  <div className="flex items-center gap-1.5">
                    {QUICK_COLORS.slice(0, 6).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewRelColor(c)}
                        style={{ backgroundColor: c }}
                        className={`w-6 h-6 rounded-full border-2 transition-all ${
                          newRelColor === c ? 'border-white scale-110 shadow-md' : 'border-transparent hover:scale-105'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddRelation(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700"
                >
                  {isPersian ? 'انصراف' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold shadow-lg shadow-amber-500/20"
                >
                  {isPersian ? 'ثبت و فعال‌سازی پیوند' : 'Create & Activate Relation'}
                </button>
              </div>
            </form>
          )}

          {/* Relation Types Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ontology.relationTypes?.map((rel) => (
              <div
                key={rel.id}
                className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-5 backdrop-blur-sm shadow-xl hover:border-zinc-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      style={{ backgroundColor: `${rel.color}20`, borderColor: `${rel.color}50`, color: rel.color }}
                      className="px-3 py-1 rounded-xl text-xs font-bold border flex items-center gap-1.5"
                    >
                      <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: rel.color }} />
                      {rel.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => openRelEdit(rel)}
                      className="text-zinc-500 hover:text-amber-400 p-1 transition-colors"
                      title={isPersian ? 'ویرایش' : 'Edit'}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        confirmDelete({
                          name: rel.name,
                          title: isPersian ? 'حذف نوع پیوند' : 'Delete Relation Type',
                          isDefault: rel.isDefault,
                          used: relationUsage(rel.id),
                          onConfirm: () => deleteCustomRelationType(rel.id),
                        })
                      }
                      className="text-zinc-500 hover:text-red-400 p-1 transition-colors"
                      title={isPersian ? 'حذف' : 'Delete'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed min-h-[36px] mb-3">{rel.description}</p>
                </div>

                <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                  <div className="flex items-center gap-1 text-zinc-400">
                    <span className="capitalize">{rel.sourceCategory}</span>
                    <ArrowRight className="w-3 h-3 text-zinc-600" />
                    <span className="capitalize">{rel.targetCategory}</span>
                  </div>
                  <span>{rel.id}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: PLACE CATEGORIES */}
      {activeTab === 'places' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-400" />
              <span>{isPersian ? 'دسته‌بندی‌ها و زیست‌بوم‌های جغرافیایی' : 'Place Categories & Biomes'}</span>
            </h3>
            <button
              onClick={openPlaceAdd}
              className="px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-zinc-950 text-xs font-bold shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>{isPersian ? '+ ثبت دسته مکان جدید' : '+ Add Place Category'}</span>
            </button>
          </div>

          {/* Add Place Category Form Modal */}
          {showAddPlace && (
            <form
              onSubmit={handleCreatePlace}
              className="bg-zinc-900/90 border border-amber-500/40 rounded-3xl p-6 backdrop-blur-xl shadow-2xl space-y-4 animate-fadeIn"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <span className="text-sm font-bold text-amber-400 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  {editingPlace
                    ? isPersian
                      ? 'ویرایش دسته مکان'
                      : 'Edit Place Category'
                    : isPersian
                      ? 'ثبت زیست‌بوم یا دسته مکانی جدید'
                      : 'New Place Category / Biome'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddPlace(false);
                    resetPlaceForm();
                  }}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'نام دسته (فارسی / انگلیسی):' : 'Category Name:'}
                  </label>
                  <input
                    type="text"
                    value={newPlaceName}
                    onChange={(e) => setNewPlaceName(e.target.value)}
                    placeholder={isPersian ? 'مثال: آرامگاه باستانی، غار کریستالی، بندر تجاری' : 'e.g. Crystal Cavern, Trading Port'}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'شناسه یکتا (اختیاری):' : 'Unique ID (Optional):'}
                  </label>
                  {editingPlace ? (
                    <div className="w-full bg-zinc-800/60 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-400 font-mono">
                      {editingPlace.id}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={newPlaceId}
                      onChange={(e) => setNewPlaceId(e.target.value)}
                      placeholder="e.g. crystal_caverns, trading_port"
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 font-mono focus:outline-none focus:border-amber-400"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                  {isPersian ? 'شرح ویژگی‌های زیست‌بوم و فضا:' : 'Biome & Environmental Atmosphere:'}
                </label>
                <textarea
                  rows={2}
                  value={newPlaceDesc}
                  onChange={(e) => setNewPlaceDesc(e.target.value)}
                  placeholder={isPersian ? 'توصیف اتمسفر و شرایط مکانی...' : 'Atmospheric conditions and environmental tone...'}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'سطح خطر پیش‌فرض (۱ تا ۵):' : 'Default Danger Level (1-5):'}
                  </label>
                  <select
                    value={newPlaceDanger}
                    onChange={(e) => setNewPlaceDanger(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                  >
                    <option value={1}>1 - {isPersian ? 'بسیار امن (Safe)' : 'Safe'}</option>
                    <option value={2}>2 - {isPersian ? 'کم‌خطر (Low)' : 'Low'}</option>
                    <option value={3}>3 - {isPersian ? 'متوسط (Moderate)' : 'Moderate'}</option>
                    <option value={4}>4 - {isPersian ? 'خطرناک (High)' : 'High'}</option>
                    <option value={5}>5 - {isPersian ? 'مرگبار (Deadly)' : 'Deadly'}</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'رنگ شاخص:' : 'Theme Color:'}
                  </label>
                  <div className="flex items-center gap-1.5">
                    {QUICK_COLORS.slice(0, 6).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewPlaceColor(c)}
                        style={{ backgroundColor: c }}
                        className={`w-6 h-6 rounded-full border-2 transition-all ${
                          newPlaceColor === c ? 'border-white scale-110 shadow-md' : 'border-transparent hover:scale-105'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddPlace(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700"
                >
                  {isPersian ? 'انصراف' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold shadow-lg shadow-amber-500/20"
                >
                  {isPersian ? 'ثبت دسته مکان' : 'Save Place Category'}
                </button>
              </div>
            </form>
          )}

          {/* Place Categories Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ontology.placeCategories?.map((cat) => (
              <div
                key={cat.id}
                className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-5 backdrop-blur-sm shadow-xl hover:border-zinc-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      style={{ backgroundColor: `${cat.color}20`, borderColor: `${cat.color}50`, color: cat.color }}
                      className="px-3 py-1 rounded-xl text-xs font-bold border flex items-center gap-1.5"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      {cat.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => openPlaceEdit(cat)}
                      className="text-zinc-500 hover:text-amber-400 p-1 transition-colors"
                      title={isPersian ? 'ویرایش' : 'Edit'}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        confirmDelete({
                          name: cat.name,
                          title: isPersian ? 'حذف دسته مکان' : 'Delete Place Category',
                          isDefault: cat.isDefault,
                          used: placeUsage(cat.id),
                          onConfirm: () => deletePlaceCategory(cat.id),
                        })
                      }
                      className="text-zinc-500 hover:text-red-400 p-1 transition-colors"
                      title={isPersian ? 'حذف' : 'Delete'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed min-h-[36px] mb-3">{cat.description}</p>
                </div>

                <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                  <span className="text-amber-400 font-bold">
                    {isPersian ? `خطر: ${cat.defaultDangerLevel || 1}/5` : `Danger: ${cat.defaultDangerLevel || 1}/5`}
                  </span>
                  <span>{cat.id}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: LAW CATEGORIES */}
      {activeTab === 'laws' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <Scale className="w-4 h-4 text-purple-400" />
              <span>{isPersian ? 'دسته‌بندی قوانین ثابت جهان' : 'Immutable World Law Categories'}</span>
            </h3>
            <button
              onClick={openLawAdd}
              className="px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-zinc-950 text-xs font-bold shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>{isPersian ? '+ ثبت دسته قانون جدید' : '+ Add Law Category'}</span>
            </button>
          </div>

          {/* Add Law Category Form */}
          {showAddLaw && (
            <form
              onSubmit={handleCreateLaw}
              className="bg-zinc-900/90 border border-amber-500/40 rounded-3xl p-6 backdrop-blur-xl shadow-2xl space-y-4 animate-fadeIn"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <span className="text-sm font-bold text-amber-400 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  {editingLaw
                    ? isPersian
                      ? 'ویرایش دسته قانون'
                      : 'Edit Law Category'
                    : isPersian
                      ? 'دسته‌بندی قانون جدید'
                      : 'New World Law Category'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddLaw(false);
                    resetLawForm();
                  }}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'نام دسته قانون:' : 'Category Name:'}
                  </label>
                  <input
                    type="text"
                    value={newLawName}
                    onChange={(e) => setNewLawName(e.target.value)}
                    placeholder={isPersian ? 'مثال: نفرین‌ها و قراردادهای روحی، اخترشناسی' : 'e.g. Soul Curses, Astral Cosmology'}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'شناسه یکتا (اختیاری):' : 'Unique ID (Optional):'}
                  </label>
                  {editingLaw ? (
                    <div className="w-full bg-zinc-800/60 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-400 font-mono">
                      {editingLaw.id}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={newLawId}
                      onChange={(e) => setNewLawId(e.target.value)}
                      placeholder="e.g. curses, astrology"
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 font-mono focus:outline-none focus:border-amber-400"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                  {isPersian ? 'دامنه شمول و توضیحات دسته:' : 'Scope & Domain Description:'}
                </label>
                <textarea
                  rows={2}
                  value={newLawDesc}
                  onChange={(e) => setNewLawDesc(e.target.value)}
                  placeholder={isPersian ? 'این دسته چه نوع حقایق ثابتی را شامل می‌شود...' : 'What immutable truths fall under this category...'}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddLaw(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700"
                >
                  {isPersian ? 'انصراف' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold shadow-lg shadow-amber-500/20"
                >
                  {isPersian ? 'ثبت دسته قانون' : 'Save Law Category'}
                </button>
              </div>
            </form>
          )}

          {/* Law Categories Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ontology.lawCategories?.map((lawCat) => (
              <div
                key={lawCat.id}
                className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-5 backdrop-blur-sm shadow-xl hover:border-zinc-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      style={{ backgroundColor: `${lawCat.color}20`, borderColor: `${lawCat.color}50`, color: lawCat.color }}
                      className="px-3 py-1 rounded-xl text-xs font-bold border flex items-center gap-1.5"
                    >
                      <Scale className="w-3.5 h-3.5" />
                      {lawCat.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => openLawEdit(lawCat)}
                      className="text-zinc-500 hover:text-amber-400 p-1 transition-colors"
                      title={isPersian ? 'ویرایش' : 'Edit'}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        confirmDelete({
                          name: lawCat.name,
                          title: isPersian ? 'حذف دسته قانون' : 'Delete Law Category',
                          isDefault: lawCat.isDefault,
                          used: lawUsage(lawCat.id),
                          onConfirm: () => deleteLawCategory(lawCat.id),
                        })
                      }
                      className="text-zinc-500 hover:text-red-400 p-1 transition-colors"
                      title={isPersian ? 'حذف' : 'Delete'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed min-h-[36px] mb-3">{lawCat.description}</p>
                </div>

                <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                  <span className="text-zinc-400 font-mono">{lawCat.id}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: NPC ROLES */}
      {activeTab === 'roles' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" />
              <span>{isPersian ? 'نقش‌ها و پیشه‌های اجتماعی شخصیت‌ها' : 'NPC Roles & Social Archetypes'}</span>
            </h3>
            <button
              onClick={openRoleAdd}
              className="px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-zinc-950 text-xs font-bold shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>{isPersian ? '+ ثبت نقش شخصیتی جدید' : '+ Add NPC Role'}</span>
            </button>
          </div>

          {/* Add NPC Role Form */}
          {showAddRole && (
            <form
              onSubmit={handleCreateRole}
              className="bg-zinc-900/90 border border-amber-500/40 rounded-3xl p-6 backdrop-blur-xl shadow-2xl space-y-4 animate-fadeIn"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <span className="text-sm font-bold text-amber-400 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  {editingRole
                    ? isPersian
                      ? 'ویرایش نقش شخصیتی'
                      : 'Edit NPC Role'
                    : isPersian
                      ? 'تعریف نقش شخصیتی جدید'
                      : 'New NPC Social Role'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddRole(false);
                    resetRoleForm();
                  }}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'عنوان نقش (فارسی / انگلیسی):' : 'Role Title:'}
                  </label>
                  <input
                    type="text"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    placeholder={isPersian ? 'مثال: تفتیش‌عقاید، کاپیتان کشتی، جادوگر دربار' : 'e.g. Inquisitor, Ship Captain, Court Mage'}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'شناسه یکتا (اختیاری):' : 'Unique ID (Optional):'}
                  </label>
                  {editingRole ? (
                    <div className="w-full bg-zinc-800/60 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-400 font-mono">
                      {editingRole.id}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={newRoleId}
                      onChange={(e) => setNewRoleId(e.target.value)}
                      placeholder="e.g. inquisitor, court_mage"
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 font-mono focus:outline-none focus:border-amber-400"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                  {isPersian ? 'شرح وظایف و ویژگی‌های رفتاری پیش‌فرض:' : 'Role Description & Behavioral Guidelines:'}
                </label>
                <textarea
                  rows={2}
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  placeholder={isPersian ? 'این نقش در جامعه چه کارکرد و رفتاری دارد...' : 'How this role functions in society...'}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddRole(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700"
                >
                  {isPersian ? 'انصراف' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold shadow-lg shadow-amber-500/20"
                >
                  {isPersian ? 'ثبت نقش' : 'Save Role'}
                </button>
              </div>
            </form>
          )}

          {/* NPC Roles Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ontology.npcRoles?.map((role) => (
              <div
                key={role.id}
                className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-5 backdrop-blur-sm shadow-xl hover:border-zinc-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      style={{ backgroundColor: `${role.color}20`, borderColor: `${role.color}50`, color: role.color }}
                      className="px-3 py-1 rounded-xl text-xs font-bold border flex items-center gap-1.5"
                    >
                      <Users className="w-3.5 h-3.5" />
                      {role.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => openRoleEdit(role)}
                      className="text-zinc-500 hover:text-amber-400 p-1 transition-colors"
                      title={isPersian ? 'ویرایش' : 'Edit'}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        confirmDelete({
                          name: role.name,
                          title: isPersian ? 'حذف نقش شخصیتی' : 'Delete NPC Role',
                          isDefault: role.isDefault,
                          used: roleUsage(role.id),
                          onConfirm: () => deleteNpcRole(role.id),
                        })
                      }
                      className="text-zinc-500 hover:text-red-400 p-1 transition-colors"
                      title={isPersian ? 'حذف' : 'Delete'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed min-h-[36px] mb-3">{role.description}</p>
                </div>

                <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                  <span className="text-zinc-400 font-mono">{role.id}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: DOMAINS OF GODS */}
      {activeTab === 'domains' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-400" />
              <span>{isPersian ? 'حوزه‌های کیهانی و قلمروهای ایزدان' : 'Divine Domains & Godly Spheres'}</span>
            </h3>
            <button
              onClick={openDomainAdd}
              className="px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-zinc-950 text-xs font-bold shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>{isPersian ? '+ ثبت حوزه کیهانی جدید' : '+ Add Divine Domain'}</span>
            </button>
          </div>

          {/* Add Divine Domain Form */}
          {showAddDomain && (
            <form
              onSubmit={handleCreateDomain}
              className="bg-zinc-900/90 border border-amber-500/40 rounded-3xl p-6 backdrop-blur-xl shadow-2xl space-y-4 animate-fadeIn"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <span className="text-sm font-bold text-amber-400 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  {editingDomain
                    ? isPersian
                      ? 'ویرایش حوزه کیهانی'
                      : 'Edit Divine Domain'
                    : isPersian
                      ? 'تعریف حوزه کیهانی جدید'
                      : 'New Divine Domain'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddDomain(false);
                    resetDomainForm();
                  }}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'نام حوزه (فارسی / انگلیسی):' : 'Domain Name:'}
                  </label>
                  <input
                    type="text"
                    value={newDomainName}
                    onChange={(e) => setNewDomainName(e.target.value)}
                    placeholder={isPersian ? 'مثال: نور و داوری، جنگ و افتخار، دریای بیکران' : 'e.g. Light & Order, War & Conquest, The Vast Sea'}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'شناسه یکتا (اختیاری):' : 'Unique ID (Optional):'}
                  </label>
                  {editingDomain ? (
                    <div className="w-full bg-zinc-800/60 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-400 font-mono">
                      {editingDomain.id}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={newDomainId}
                      onChange={(e) => setNewDomainId(e.target.value)}
                      placeholder="e.g. light, war, sea"
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 font-mono focus:outline-none focus:border-amber-400"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                  {isPersian ? 'ماهیت و قلمرو کیهانی حوزه:' : 'Sphere & Cosmic Nature:'}
                </label>
                <textarea
                  rows={2}
                  value={newDomainDesc}
                  onChange={(e) => setNewDomainDesc(e.target.value)}
                  placeholder={isPersian ? 'این حوزه چه نیروها و مفاهیمی را پوشش می‌دهد...' : 'What forces and concepts fall under this domain...'}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddDomain(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700"
                >
                  {isPersian ? 'انصراف' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold shadow-lg shadow-amber-500/20"
                >
                  {isPersian ? 'ثبت حوزه' : 'Save Domain'}
                </button>
              </div>
            </form>
          )}

          {/* Divine Domains Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ontology.domains?.map((domain) => (
              <div
                key={domain.id}
                className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-5 backdrop-blur-sm shadow-xl hover:border-zinc-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      style={{ backgroundColor: `${domain.color}20`, borderColor: `${domain.color}50`, color: domain.color }}
                      className="px-3 py-1 rounded-xl text-xs font-bold border flex items-center gap-1.5"
                    >
                      <Crown className="w-3.5 h-3.5" />
                      {domain.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => openDomainEdit(domain)}
                      className="text-zinc-500 hover:text-amber-400 p-1 transition-colors"
                      title={isPersian ? 'ویرایش' : 'Edit'}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        confirmDelete({
                          name: domain.name,
                          title: isPersian ? 'حذف حوزه کیهانی' : 'Delete Divine Domain',
                          isDefault: domain.isDefault,
                          used: domainUsage(domain.id),
                          onConfirm: () => deleteDomain(domain.id),
                        })
                      }
                      className="text-zinc-500 hover:text-red-400 p-1 transition-colors"
                      title={isPersian ? 'حذف' : 'Delete'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed min-h-[36px] mb-3">{domain.description}</p>
                </div>

                <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                  <span className="text-amber-400 font-bold">
                    {isPersian ? `ایزد: ${domainUsage(domain.id)}` : `Deities: ${domainUsage(domain.id)}`}
                  </span>
                  <span>{domain.id}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
