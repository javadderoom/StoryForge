'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useStudioStory, StoryListItem } from '@/lib/context/StudioStoryContext';
import { StoryManifest, Genre } from '@/lib/types';
import { getEmptyStoryManifest } from '@/lib/storyFactory';
import { GENRE_LABELS } from '@/lib/genrePresets';
import { notify } from '@/lib/notify';
import {
  BookOpen,
  Plus,
  Copy,
  Trash2,
  ChevronRight,
  Languages,
  Shield,
  Upload,
  Sparkles,
  Search,
  X,
  Check,
  Globe,
  Eye,
  EyeOff,
  Layers,
} from 'lucide-react';

export default function StoriesListPage() {
  const router = useRouter();
  const {
    storiesList,
    worldsList,
    selectedStoryId,
    setSelectedStoryId,
    isPersian,
    createStory,
    createStoryInWorld,
    duplicateStory,
    deleteStory,
    setStoryPublished,
    importStoryJson,
  } = useStudioStory();

  const [searchQuery, setSearchQuery] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newLanguage, setNewLanguage] = useState<'en' | 'fa'>('en');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = {
    heading: isPersian ? 'کتابخانه داستان‌ها' : 'Story Library',
    subheading: isPersian
      ? 'مدیریت، ایجاد و ویرایش مجموعه داستان‌ها و جهان‌سازی‌های شما'
      : 'Manage, create, and curate your collection of interactive fiction worlds.',
    createNew: isPersian ? '+ ایجاد داستان جدید' : '+ Create New Story',
    importJson: isPersian ? 'بارگذاری از فایل' : 'Import JSON',
    searchPlaceholder: isPersian ? 'جستجو در داستان‌ها...' : 'Search stories...',
    published: isPersian ? 'منتشر شده' : 'Published',
    draft: isPersian ? 'پیش‌نویس' : 'Draft',
    publish: isPersian ? 'انتشار' : 'Publish',
    unpublish: isPersian ? 'لغو انتشار' : 'Unpublish',
    active: isPersian ? 'فعال' : 'Active',
    open: isPersian ? 'باز کردن' : 'Open',
    duplicate: isPersian ? 'رونوشت' : 'Duplicate',
    delete: isPersian ? 'حذف' : 'Delete',
  };

  const filteredStories = storiesList.filter((s) =>
    searchQuery.trim()
      ? s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.tagline.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  // Group stories by their shared world (legacy stories without a world
  // link each form their own single-story group).
  const worldGroups = (() => {
    const groups = new Map<string, { worldId: string; worldName: string; items: StoryListItem[] }>();
    for (const s of filteredStories) {
      const wid = s.worldId || s.id;
      const known = worldsList.find((w) => w.id === wid);
      const wname = s.worldName || known?.name || s.title;
      let g = groups.get(wid);
      if (!g) {
        g = { worldId: wid, worldName: wname, items: [] };
        groups.set(wid, g);
      }
      g.items.push(s);
    }
    return [...groups.values()];
  })();

  const handleOpenStory = (storyId: string) => {
    setSelectedStoryId(storyId);
    router.push('/studio/world');
  };

  const handleCreateInWorld = (worldId: string) => {
    createStoryInWorld(worldId);
    router.push('/studio/world');
  };

  const handleCreateStory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const manifest = getEmptyStoryManifest(newLanguage);
    manifest.title = newTitle.trim();

    createStory(manifest);
    setCreateModalOpen(false);
    setNewTitle('');
    router.push('/studio/world');
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const manifest = JSON.parse(text) as StoryManifest;
      importStoryJson(manifest);
      router.push('/studio/world');
    } catch {
      notify.error(isPersian ? 'فایل JSON معتبر نیست' : 'Invalid JSON file');
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-sm shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <BookOpen className="w-5 h-5 text-amber-400" />
              <h2 className="text-xl md:text-2xl font-bold text-zinc-100">{t.heading}</h2>
            </div>
            <p className="text-sm text-zinc-400 max-w-2xl leading-relaxed">{t.subheading}</p>
          </div>
          <div className="flex items-center gap-2.5 self-start md:self-auto flex-wrap">
            <button
              onClick={() => setCreateModalOpen(true)}
              className="flex items-center gap-1.5 text-xs bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-zinc-950 px-4 py-2.5 rounded-xl font-bold shadow-lg shadow-amber-500/20 cursor-pointer transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              {t.createNew}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3.5 py-2.5 rounded-xl border border-zinc-700 font-semibold cursor-pointer transition-all"
            >
              <Upload className="w-3.5 h-3.5 text-amber-400" />
              {t.importJson}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportJson}
            />
          </div>
        </div>

        {/* Search */}
        <div className="mt-5 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full bg-zinc-950/80 border border-zinc-700/80 rounded-xl pl-10 pr-10 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-amber-500/60 placeholder:text-zinc-600"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Stories grouped by shared world */}
      {worldGroups.map((group) => (
        <div key={group.worldId} className="space-y-4">
          <div className="flex items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-2 min-w-0">
              <Layers className="w-4 h-4 text-amber-400 shrink-0" />
              <h3 className="text-sm font-bold text-zinc-200 truncate">
                {group.worldName}
              </h3>
              <span className="text-[10px] font-mono text-zinc-500 bg-zinc-800/80 border border-zinc-700/60 rounded-md px-1.5 py-0.5 shrink-0">
                {group.items.length} {group.items.length === 1 ? 'story' : 'stories'}
              </span>
            </div>
            <button
              onClick={() => handleCreateInWorld(group.worldId)}
              className="flex items-center gap-1 text-[11px] font-bold text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer shrink-0"
              title={isPersian ? 'داستان جدید در همین جهان' : 'New story in this world'}
            >
              <Plus className="w-3.5 h-3.5" />
              {isPersian ? 'داستان جدید در این جهان' : 'New story in this world'}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {group.items.map((item) => (
              <StoryCard
                key={item.id}
                item={item}
                isActive={item.id === selectedStoryId}
                isPersian={isPersian}
                t={t}
                onOpen={() => handleOpenStory(item.id)}
                onDuplicate={() => duplicateStory(item.id)}
                onTogglePublish={() => setStoryPublished(item.id, !item.published)}
                onDelete={() => deleteStory(item.id)}
              />
            ))}
          </div>
        </div>
      ))}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filteredStories.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-zinc-500">
            <BookOpen className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-sm">
              {searchQuery.trim()
                ? isPersian
                  ? 'داستانی مطابق جستجو یافت نشد.'
                  : 'No stories match your search.'
                : isPersian
                  ? 'هنوز داستانی نساخته‌اید. اولین جهان خود را ایجاد کنید.'
                  : "You haven't created any stories yet. Create your first world."}
            </p>
          </div>
        )}
      </div>

      {/* Create Story Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-zinc-900 border border-amber-500/30 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-zinc-100">
                  {isPersian ? 'ایجاد داستان جدید' : 'Create New Story'}
                </h3>
              </div>
              <button onClick={() => setCreateModalOpen(false)} className="text-zinc-500 hover:text-zinc-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStory} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                  {isPersian ? 'عنوان داستان:' : 'Story Title:'}
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={isPersian ? 'مثال: اژدهای بال‌سوخته' : 'e.g. The Scorched Dragon Saga'}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                  {isPersian ? 'زبان:' : 'Language:'}
                </label>
                <select
                  value={newLanguage}
                  onChange={(e) => setNewLanguage(e.target.value as 'en' | 'fa')}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="en">English</option>
                  <option value="fa">فارسی (Persian)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700 cursor-pointer"
                >
                  {isPersian ? 'انصراف' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold shadow-lg shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {isPersian ? 'ایجاد و ورود' : 'Create & Open'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StoryCard({
  item,
  isActive,
  isPersian,
  t,
  onOpen,
  onDuplicate,
  onTogglePublish,
  onDelete,
}: {
  item: StoryListItem;
  isActive: boolean;
  isPersian: boolean;
  t: Record<string, string>;
  onOpen: () => void;
  onDuplicate: () => void;
  onTogglePublish: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`group relative bg-zinc-900/50 border rounded-2xl overflow-hidden transition-all hover:shadow-xl hover:shadow-amber-500/5 ${
        isActive
          ? 'border-amber-500/50 ring-1 ring-amber-500/20 shadow-lg shadow-amber-500/10'
          : 'border-zinc-800/80 hover:border-zinc-700'
      }`}
    >
      {/* Cover Image or Gradient */}
      <div className="h-28 bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950 relative overflow-hidden">
        {item.coverImageUrl ? (
          <img
            src={item.coverImageUrl}
            alt={item.title}
            className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen className="w-10 h-10 text-zinc-700/50" />
          </div>
        )}

        {/* Status Badges */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          {item.published ? (
            <span className="text-[10px] font-bold bg-emerald-500/90 text-zinc-950 px-2 py-0.5 rounded-md flex items-center gap-1">
              <Check className="w-3 h-3" /> {t.published}
            </span>
          ) : (
            <span className="text-[10px] font-bold bg-zinc-700/90 text-zinc-100 px-2 py-0.5 rounded-md flex items-center gap-1">
              {t.draft}
            </span>
          )}
          {isActive && (
            <span className="text-[10px] font-bold bg-amber-500/90 text-zinc-950 px-2 py-0.5 rounded-md flex items-center gap-1">
              <Check className="w-3 h-3" /> {t.active}
            </span>
          )}
        </div>

        {/* Language Badge */}
        <div className="absolute top-3 right-3">
          <span className="text-[10px] font-mono bg-zinc-950/70 backdrop-blur-sm text-zinc-300 px-2 py-0.5 rounded-md border border-zinc-700/50 flex items-center gap-1">
            <Globe className="w-3 h-3" />
            {item.language === 'fa' ? 'FA' : 'EN'}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 space-y-3">
        <div>
          <h3 className="text-sm font-bold text-zinc-100 truncate">{item.title}</h3>
          <p className="text-xs text-zinc-400 mt-1 line-clamp-2 leading-relaxed">{item.tagline}</p>
        </div>

        {/* Genre Tags */}
        <div className="flex flex-wrap gap-1.5">
          {item.genres.slice(0, 3).map((g) => {
            const meta = GENRE_LABELS[g as Genre];
            return (
              <span
                key={g}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                  meta ? meta.color : 'bg-zinc-800/80 text-zinc-300 border-zinc-700'
                }`}
              >
                {meta ? (isPersian ? meta.fa : meta.en) : g}
              </span>
            );
          })}
        </div>

        {/* Footer: Author & Version */}
        <div className="flex items-center justify-between pt-3 border-t border-zinc-800/60 text-[11px] text-zinc-500">
          <span className="truncate max-w-[120px]">{item.author}</span>
          <span className="font-mono">v{item.version}</span>
        </div>
      </div>

      {/* Action Bar */}
      <div className="px-5 pb-4 flex items-center gap-2">
        <button
          onClick={onOpen}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 py-2 rounded-xl border border-amber-500/20 font-bold transition-all cursor-pointer"
        >
          <ChevronRight className="w-3.5 h-3.5" />
          {t.open}
        </button>
        <button
          onClick={onDuplicate}
          className="p-2 text-zinc-400 hover:text-amber-300 hover:bg-zinc-800 rounded-xl transition-all cursor-pointer"
          title={t.duplicate}
        >
          <Copy className="w-4 h-4" />
        </button>
        <button
          onClick={onTogglePublish}
          className={`p-2 rounded-xl transition-all cursor-pointer ${
            item.published
              ? 'text-zinc-400 hover:text-amber-300 hover:bg-zinc-800'
              : 'text-emerald-400 hover:text-emerald-300 hover:bg-zinc-800'
          }`}
          title={item.published ? t.unpublish : t.publish}
        >
          {item.published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
        <button
          onClick={onDelete}
          className="p-2 text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 rounded-xl transition-all cursor-pointer"
          title={t.delete}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
