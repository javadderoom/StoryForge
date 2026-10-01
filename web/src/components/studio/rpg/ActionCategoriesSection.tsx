'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Tag,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit2,
  Check,
  X,
  RefreshCw,
  Layers,
  Shield,
  Swords,
  MessageSquare,
  Compass,
  EyeOff,
  SearchCode,
  Flame,
  Wrench,
  Sparkles,
} from 'lucide-react';
import { ActionCategory, ActionCategoryDomain } from '@/lib/types/actionCategory';
import { notify } from '@/lib/notify';

interface ActionCategoriesSectionProps {
  isPersian?: boolean;
  worldId?: string;
}

const DOMAINS: {
  id: string;
  labelEn: string;
  labelFa: string;
  icon: any;
  color: string;
}[] = [
  { id: 'all', labelEn: 'All Domains', labelFa: 'همهٔ حوزه‌ها', icon: Layers, color: 'text-zinc-400 bg-zinc-800/60' },
  { id: 'combat_defense', labelEn: 'Combat Defense', labelFa: 'پدافند و مهار تهدید', icon: Shield, color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
  { id: 'combat_offense', labelEn: 'Combat Offense', labelFa: 'تهاجم و رزم', icon: Swords, color: 'text-red-400 bg-red-500/10 border-red-500/30' },
  { id: 'social', labelEn: 'Social & Friction', labelFa: 'مذاکره و تعاملات', icon: MessageSquare, color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
  { id: 'wilderness', labelEn: 'Wilderness & Survival', labelFa: 'بقا و دشت‌نوردی', icon: Compass, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  { id: 'stealth', labelEn: 'Stealth & Infiltration', labelFa: 'پنهان‌کاری و نفوذ', icon: EyeOff, color: 'text-zinc-300 bg-zinc-700/30 border-zinc-600/40' },
  { id: 'investigation', labelEn: 'Investigation', labelFa: 'تفتیش و بازرسی', icon: SearchCode, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' },
  { id: 'occult', labelEn: 'Occult & Supernatural', labelFa: 'ماوراء و افسون', icon: Flame, color: 'text-violet-400 bg-violet-500/10 border-violet-500/30' },
  { id: 'crafting', labelEn: 'Crafting & Trade', labelFa: 'صنعتگری و فنون', icon: Wrench, color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  { id: 'general', labelEn: 'General Feats', labelFa: 'فنون عمومی', icon: Sparkles, color: 'text-teal-400 bg-teal-500/10 border-teal-500/30' },
];

export function ActionCategoriesSection({
  isPersian = false,
  worldId,
}: ActionCategoriesSectionProps) {
  const [categories, setCategories] = useState<ActionCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ActionCategory | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    nameFa: '',
    nameEn: '',
    domain: 'combat_defense' as ActionCategoryDomain,
    description: '',
    tagsString: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      setIsLoading(true);
      const url = worldId
        ? `/api/studio/action-categories?worldId=${encodeURIComponent(worldId)}`
        : '/api/studio/action-categories';
      const res = await fetch(url);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setCategories(json.data);
      } else {
        notify.error(json.error || 'Failed to fetch categories');
      }
    } catch (err: any) {
      notify.error(err?.message || 'Error loading action categories');
    } finally {
      setIsLoading(false);
    }
  }, [worldId]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const openCreateModal = () => {
    setEditingCategory(null);
    setFormData({
      code: '',
      nameFa: '',
      nameEn: '',
      domain: (selectedDomain !== 'all' ? selectedDomain : 'combat_defense') as ActionCategoryDomain,
      description: '',
      tagsString: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (cat: ActionCategory) => {
    setEditingCategory(cat);
    setFormData({
      code: cat.code,
      nameFa: cat.nameFa,
      nameEn: cat.nameEn,
      domain: cat.domain as ActionCategoryDomain,
      description: cat.description || '',
      tagsString: (cat.tags || []).join(', '),
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim() || !formData.nameFa.trim() || !formData.nameEn.trim()) {
      notify.info(isPersian ? 'لطفاً نام فارسی، انگلیسی و شناسهٔ یکتا را وارد کنید' : 'Please fill code, English name and Persian name');
      return;
    }

    try {
      setIsSubmitting(true);
      const tags = formData.tagsString
        .split(/[,،]/)
        .map((t) => t.trim())
        .filter(Boolean);

      const payload = {
        code: formData.code.trim().toLowerCase(),
        nameFa: formData.nameFa.trim(),
        nameEn: formData.nameEn.trim(),
        domain: formData.domain,
        description: formData.description.trim() || null,
        tags,
        worldId: worldId || null,
      };

      if (editingCategory) {
        const res = await fetch(`/api/studio/action-categories/${editingCategory.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || 'Update failed');
        }
        notify.success(isPersian ? 'دسته‌بندی با موفقیت به‌روزرسانی شد' : 'Category updated successfully');
      } else {
        const res = await fetch('/api/studio/action-categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || 'Create failed');
        }
        notify.success(isPersian ? 'دسته‌بندی جدید به پایگاه داده اضافه شد' : 'Category created successfully');
      }

      setIsModalOpen(false);
      fetchCategories();
    } catch (err: any) {
      notify.error(err?.message || 'Failed to save category');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (cat: ActionCategory) => {
    const confirmed = await notify.confirm({
      title: isPersian ? 'حذف دسته‌بندی' : 'Delete Category',
      message: isPersian
        ? `آیا از حذف دسته‌بندی «${cat.nameFa}» (${cat.code}) از پایگاه داده اطمینان دارید؟`
        : `Are you sure you want to permanently delete category "${cat.nameEn}" (${cat.code})?`,
      confirmText: isPersian ? 'حذف قطعی' : 'Delete Permanently',
      cancelText: isPersian ? 'انصراف' : 'Cancel',
      isDestructive: true,
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/studio/action-categories/${cat.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to delete category');
      }
      notify.success(isPersian ? 'دسته‌بندی حذف شد' : 'Category deleted');
      fetchCategories();
    } catch (err: any) {
      notify.error(err?.message || 'Error deleting category');
    }
  };

  // Filtered list
  const filteredCategories = useMemo(() => {
    return categories.filter((c) => {
      const matchDomain = selectedDomain === 'all' || c.domain === selectedDomain;
      if (!matchDomain) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      const matchText =
        c.code.toLowerCase().includes(q) ||
        c.nameFa.toLowerCase().includes(q) ||
        c.nameEn.toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q) ||
        (c.tags || []).some((t) => t.toLowerCase().includes(q));
      return matchText;
    });
  }, [categories, selectedDomain, searchQuery]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header & Controls */}
      <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-3xl p-6 shadow-xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <Tag className="w-5 h-5 text-amber-400" />
              <span>{isPersian ? 'بانک دسته‌بندی‌ها و محرک‌های عملیاتی (Action Categories)' : 'Action Categories & Trigger Database'}</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              {isPersian
                ? 'دسته‌بندی‌های استاندارد پایگاه داده برای تطبیق قطعی و بدون ریجکسِ محرک‌ها، شرایط دفاعی، باران پرتابه‌ها و اصطکاک اجتماعی'
                : 'Deterministic condition taxonomy stored in PostgreSQL for strict, non-regex matching of triggers, defensive stances, and modifiers'}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={fetchCategories}
              disabled={isLoading}
              title={isPersian ? 'تازه‌سازی' : 'Refresh'}
              className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isPersian ? 'افزودن دسته‌بندی جدید' : 'New Category'}</span>
            </button>
          </div>
        </div>

        {/* Domain Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-zinc-800/60 scrollbar-none">
          {DOMAINS.map((dom) => {
            const Icon = dom.icon;
            const isSelected = selectedDomain === dom.id;
            const count =
              dom.id === 'all'
                ? categories.length
                : categories.filter((c) => c.domain === dom.id).length;
            return (
              <button
                key={dom.id}
                onClick={() => setSelectedDomain(dom.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{isPersian ? dom.labelFa : dom.labelEn}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-zinc-800/80 text-zinc-300">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              isPersian
                ? 'جستجو در نام، شناسهٔ یکتا، برچسب‌ها و توضیحات دسته‌بندی...'
                : 'Search categories by code, name, tags, or description...'
            }
            className="w-full bg-zinc-950/70 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/50"
          />
        </div>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCategories.map((cat) => {
          const domainMeta = DOMAINS.find((d) => d.id === cat.domain) || DOMAINS[0];
          const Icon = domainMeta.icon;
          return (
            <div
              key={cat.id}
              className="bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700/90 rounded-2xl p-4 transition-all flex flex-col justify-between space-y-3 group shadow-lg shadow-black/20"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`p-1.5 rounded-lg border text-xs ${domainMeta.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-xs font-bold text-zinc-100">
                      {isPersian ? cat.nameFa : cat.nameEn}
                    </span>
                  </div>
                  {cat.isSystem && (
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 border border-zinc-700/50">
                      System
                    </span>
                  )}
                </div>

                <div className="font-mono text-[11px] text-amber-400/90 bg-zinc-950/60 px-2 py-1 rounded-md border border-zinc-800/60 inline-block mb-2">
                  {cat.code}
                </div>

                {cat.description && (
                  <p className="text-xs text-zinc-400 line-clamp-2 mb-2 leading-relaxed">
                    {cat.description}
                  </p>
                )}

                {/* Tags preview */}
                {cat.tags && cat.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {cat.tags.slice(0, 4).map((tag, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800/70 text-zinc-300 font-mono"
                      >
                        #{tag}
                      </span>
                    ))}
                    {cat.tags.length > 4 && (
                      <span className="text-[10px] text-zinc-500 font-mono">
                        +{cat.tags.length - 4}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Actions footer */}
              <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-500">
                <span className="text-[10px]">
                  {isPersian ? domainMeta.labelFa : domainMeta.labelEn}
                </span>
                <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEditModal(cat)}
                    title={isPersian ? 'ویرایش' : 'Edit'}
                    className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(cat)}
                    title={isPersian ? 'حذف' : 'Delete'}
                    className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredCategories.length === 0 && !isLoading && (
        <div className="text-center py-12 border border-dashed border-zinc-800 rounded-3xl bg-zinc-900/30">
          <Tag className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
          <p className="text-sm font-bold text-zinc-300">
            {isPersian ? 'دسته‌بندی‌ای یافت نشد' : 'No Action Categories Found'}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            {searchQuery
              ? isPersian
                ? 'نتیجه‌ای برای جستجوی شما یافت نشد.'
                : 'No categories match your search criteria.'
              : isPersian
              ? 'هیچ دسته‌بندی‌ای در این حوزه تعریف نشده است.'
              : 'No categories defined in this domain.'}
          </p>
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <Tag className="w-4 h-4 text-amber-400" />
                <span>
                  {editingCategory
                    ? isPersian
                      ? 'ویرایش دسته‌بندی عملیاتی'
                      : 'Edit Action Category'
                    : isPersian
                    ? 'تعریف دسته‌بندی جدید'
                    : 'Create New Action Category'}
                </span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  {isPersian ? 'شناسهٔ یکتا (Unique Code Slug)' : 'Code Slug'}
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g. incoming_light_projectile"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 font-mono text-xs focus:outline-none focus:border-amber-500/50"
                  required
                />
                <span className="text-[10px] text-zinc-500 mt-1 block">
                  {isPersian
                    ? 'حروف کوچک انگلیسی با زیرخط (مانند incoming_light_projectile)'
                    : 'Lowercase letters and underscores only'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">
                    {isPersian ? 'عنوان فارسی' : 'Persian Name'}
                  </label>
                  <input
                    type="text"
                    value={formData.nameFa}
                    onChange={(e) => setFormData({ ...formData, nameFa: e.target.value })}
                    placeholder="مثال: دفاع در برابر پرتابه‌های سبک"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 text-xs focus:outline-none focus:border-amber-500/50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">
                    {isPersian ? 'عنوان انگلیسی' : 'English Name'}
                  </label>
                  <input
                    type="text"
                    value={formData.nameEn}
                    onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                    placeholder="e.g. Light Projectile Defense"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 text-xs focus:outline-none focus:border-amber-500/50"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  {isPersian ? 'حوزهٔ عملکرد (Domain)' : 'Domain'}
                </label>
                <select
                  value={formData.domain}
                  onChange={(e) =>
                    setFormData({ ...formData, domain: e.target.value as ActionCategoryDomain })
                  }
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 text-xs focus:outline-none focus:border-amber-500/50 cursor-pointer"
                >
                  {DOMAINS.filter((d) => d.id !== 'all').map((dom) => (
                    <option key={dom.id} value={dom.id}>
                      {isPersian ? dom.labelFa : dom.labelEn}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  {isPersian ? 'توضیحات و شرایط فعال‌سازی' : 'Description & Trigger Context'}
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={
                    isPersian
                      ? 'دقیقاً مشخص کنید این شرط تحت چه شرایطی فعال می‌شود...'
                      : 'Define exactly under what narrative/combat conditions this triggers...'
                  }
                  rows={3}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 text-xs focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  {isPersian ? 'برچسب‌ها و کلمات کلیدی (با کاما جدا کنید)' : 'Keywords & Synonyms (comma-separated)'}
                </label>
                <input
                  type="text"
                  value={formData.tagsString}
                  onChange={(e) => setFormData({ ...formData, tagsString: e.target.value })}
                  placeholder="e.g. تیر, کمان, پرتابه, arrow, projectile"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 text-xs focus:outline-none focus:border-amber-500/50 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 text-xs font-bold transition-all cursor-pointer"
                >
                  {isPersian ? 'انصراف' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition-all shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting
                    ? isPersian
                      ? 'در حال ذخیره...'
                      : 'Saving...'
                    : editingCategory
                    ? isPersian
                      ? 'ذخیرهٔ تغییرات'
                      : 'Save Changes'
                    : isPersian
                    ? 'ثبت دسته‌بندی'
                    : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
