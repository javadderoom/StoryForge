'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { StudioStoryProvider, useStudioStory } from '@/lib/context/StudioStoryContext';
import { Toaster } from '@/lib/notify';
import { StoryDetailsModal } from '@/components/studio/StoryDetailsModal';
import {
  BookOpen,
  Sword,
  User,
  Sparkles,
  LayoutGrid,
  Languages,
  ArrowLeft,
  ArrowRight,
  Scroll,
  Share2,
  GitBranch,
  Download,
  RotateCcw,
  CheckCircle2,
  CloudUpload,
  Tag,
  Clock,
  Skull,
  Sun,
  MapPin,
  Edit2,
  MessageSquare,
  ChevronRight,
} from 'lucide-react';

function StudioShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    isPersian,
    isRtl,
    story,
    selectedStoryId,
    storiesList,
    toggleLanguage,
    hasLocalDraft,
    lastSaved,
    isSyncing,
    lastServerSynced,
    saveToServer,
    exportStoryJson,
    resetToDefault,
  } = useStudioStory();

  const navItems = [
    {
      href: '/studio/stories',
      label: isPersian ? 'کتابخانه داستان‌ها' : 'Story Library',
      shortLabel: isPersian ? 'داستان‌ها' : 'Stories',
      icon: LayoutGrid,
      count: undefined as number | undefined,
      isSpecial: true,
    },
    {
      href: '/studio/world',
      label: isPersian ? 'انجیل جهان' : 'World Bible',
      shortLabel: isPersian ? 'جهان' : 'World',
      icon: BookOpen,
      count: story.worldBible.laws.length,
    },
    {
      href: '/studio/locations',
      label: isPersian ? 'جغرافیای جهان' : 'World Geography',
      shortLabel: isPersian ? 'مکان‌ها' : 'Locations',
      icon: MapPin,
      count: story.worldBible.locations?.length || 0,
    },
    {
      href: '/studio/lore-graph',
      label: isPersian ? 'گراف شبکه جهان' : 'Lore Graph',
      shortLabel: isPersian ? 'گراف' : 'Graph',
      icon: Share2,
      isSpecial: true,
    },
    {
      href: '/studio/timeline',
      label: isPersian ? 'گاه‌شمار تاریخی' : 'Chronicle & Eras',
      shortLabel: isPersian ? 'تاریخ' : 'Timeline',
      icon: Clock,
      count: story.worldBible.timeline?.length || 0,
    },
    {
      href: '/studio/artifacts',
      label: isPersian ? 'خزانه عتیقه‌ها' : 'Mythic Relics',
      shortLabel: isPersian ? 'عتیقه‌ها' : 'Relics',
      icon: Sparkles,
      count: story.worldBible.artifacts?.length || 0,
    },
    {
      href: '/studio/bestiary',
      label: isPersian ? 'دانشنامه موجودات' : 'Bestiary',
      shortLabel: isPersian ? 'هیولاها' : 'Bestiary',
      icon: Skull,
      count: story.worldBible.bestiary?.length || 0,
    },
    {
      href: '/studio/religions',
      label: isPersian ? 'پانتئون و ادیان' : 'Pantheons & Faith',
      shortLabel: isPersian ? 'ادیان' : 'Faith',
      icon: Sun,
      count: story.worldBible.religions?.length || 0,
    },
    {
      href: '/studio/types',
      label: isPersian ? 'گونه‌ها و هستی‌شناسی' : 'Taxonomy & Types',
      shortLabel: isPersian ? 'گونه‌ها' : 'Types',
      icon: Tag,
      count:
        (story.worldBible.ontology?.relationTypes?.length || 0) +
        (story.worldBible.ontology?.placeCategories?.length || 0),
    },
    {
      href: '/studio/beats',
      label: isPersian ? 'درخت سناریو و شاخه‌ها' : 'Story Beats Tree',
      shortLabel: isPersian ? 'سناریو' : 'Beats',
      icon: GitBranch,
      count: story.initialStoryBeats?.length || 1,
    },
    {
      href: '/studio/rpg',
      label: isPersian ? 'مکانیک‌های RPG' : 'RPG Mechanics',
      shortLabel: isPersian ? 'قوانین' : 'RPG',
      icon: Sword,
      count: story.rpgSystem.stats.length,
    },
    {
      href: '/studio/npcs',
      label: isPersian ? 'پرونده‌های NPC' : 'NPC Dossiers',
      shortLabel: isPersian ? 'شخصیت‌ها' : 'NPCs',
      icon: User,
      count: story.worldBible.npcs.length,
    },
    {
      href: '/studio/sandbox',
      label: isPersian ? 'شبیه‌ساز هوش مصنوعی' : 'AI Sandbox',
      shortLabel: isPersian ? 'سندباکس' : 'Sandbox',
      icon: Sparkles,
      isSpecial: true,
    },
    {
      href: '/studio/chat',
      label: isPersian ? 'مشاور هوش مصنوعی' : 'AI Oracle',
      shortLabel: isPersian ? 'مشاور' : 'Oracle',
      icon: MessageSquare,
      isSpecial: true,
    },
  ];

  const NAV_SECTIONS = [
    { key: 'library', label: isPersian ? 'کتابخانه' : 'Library' },
    { key: 'world', label: isPersian ? 'جهان‌سازی' : 'World Building' },
    { key: 'entities', label: isPersian ? 'موجودیت‌ها' : 'Entities' },
    { key: 'story', label: isPersian ? 'روایت و سیستم‌ها' : 'Narrative & Systems' },
    { key: 'ai', label: isPersian ? 'استودیو هوش مصنوعی' : 'AI Studio' },
  ] as const;

  const SECTION_OF: Record<string, string> = {
    '/studio/stories': 'library',
    '/studio/world': 'world',
    '/studio/locations': 'world',
    '/studio/lore-graph': 'world',
    '/studio/timeline': 'world',
    '/studio/religions': 'world',
    '/studio/types': 'world',
    '/studio/artifacts': 'entities',
    '/studio/bestiary': 'entities',
    '/studio/npcs': 'entities',
    '/studio/beats': 'story',
    '/studio/rpg': 'story',
    '/studio/sandbox': 'ai',
    '/studio/chat': 'ai',
  };

  const isCurrentActive = (href: string) => {
    if (pathname === '/studio' && href === '/studio/stories') return true;
    return pathname.startsWith(href);
  };

  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const toggleSection = (key: string) =>
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="min-h-screen bg-[#090a0f] text-zinc-100 flex flex-col md:flex-row antialiased selection:bg-amber-500/30 selection:text-amber-200">
      <Toaster />

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-72 bg-[#0c0d14] border-r border-zinc-800/80 p-5 shrink-0 justify-between sticky top-0 h-screen z-40">
        <div className="flex-1 min-h-0 flex flex-col">
          {/* Header Branding */}
          <div className="flex items-center gap-3 pb-5 border-b border-zinc-800/80">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center shadow-lg shadow-amber-500/20 font-black text-white text-lg shrink-0">
              ⚡
            </div>
            <div>
              <h1 className="font-bold text-base text-zinc-100 tracking-tight flex items-center gap-2">
                {isPersian ? 'استودیو داستان‌ساز' : 'StoryForge Studio'}
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                {isPersian ? 'محیط نویسندگی تعاملی' : 'Interactive Authoring'}
              </span>
            </div>
          </div>

          {/* Story Selector & Language Switch */}
          <div className="mt-4 p-3.5 rounded-2xl bg-zinc-900/70 border border-zinc-800/80 space-y-2.5">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-medium">{isPersian ? 'داستان فعال:' : 'Active Story:'}</span>
              <div className="flex items-center gap-1.5">
                {selectedStoryId && (
                  <button
                    onClick={() => setIsDetailsOpen(true)}
                    className="flex items-center gap-1 text-[11px] bg-zinc-800 hover:bg-zinc-700 text-amber-400 px-2.5 py-1 rounded-lg border border-zinc-700/80 transition-all font-semibold cursor-pointer"
                    title={isPersian ? 'ویرایش جزئیات داستان' : 'Edit Story Details'}
                  >
                    <Edit2 className="w-3 h-3" />
                    {isPersian ? 'ویرایش' : 'Edit'}
                  </button>
                )}
                <button
                  onClick={toggleLanguage}
                  className="flex items-center gap-1 text-[11px] bg-zinc-800 hover:bg-zinc-700 text-amber-400 px-2.5 py-1 rounded-lg border border-zinc-700/80 transition-all font-semibold cursor-pointer"
                >
                  <Languages className="w-3 h-3" />
                  {isPersian ? 'English' : 'فارسی'}
                </button>
              </div>
            </div>
            <div className="text-sm font-bold text-zinc-200 truncate">
              {selectedStoryId ? story.title : isPersian ? 'داستان فعالی انتخاب نشده' : 'No active story'}
            </div>
            <div className="text-[11px] text-zinc-500 truncate">
              {selectedStoryId
                ? story.tagline
                : isPersian
                  ? 'از کتابخانه داستانی انتخاب کنید'
                  : 'Select a story from the library'}
            </div>

            {/* Local & Server Sync Status */}
            <div className="pt-2 border-t border-zinc-800/60 space-y-2 text-[10px]">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                  {isSyncing ? (
                    <span className="flex items-center gap-1 text-amber-400">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                      {isPersian ? 'در حال ارسال به سرور...' : 'Syncing to Server...'}
                    </span>
                  ) : lastServerSynced ? (
                    <span className="flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 className="w-3 h-3" />
                      {isPersian ? 'همگام با پایگاه‌داده' : 'Synced to DB'}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-zinc-400">
                      <CheckCircle2 className="w-3 h-3 text-zinc-500" />
                      {hasLocalDraft
                        ? isPersian
                          ? 'پیش‌نویس ذخیره شد'
                          : 'Draft Auto-Saved'
                        : isPersian
                          ? 'در پایگاه‌داده ذخیره شد'
                          : 'Saved to DB'}
                    </span>
                  )}
                </span>
                {hasLocalDraft && (
                  <button
                    onClick={resetToDefault}
                    className="text-zinc-500 hover:text-rose-400 flex items-center gap-1 transition-colors cursor-pointer"
                    title={
                      isPersian
                        ? 'حذف پیش‌نویس محلی و بارگذاری از سرور'
                        : 'Discard local draft & reload from server'
                    }
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    {isPersian ? 'حذف پیش‌نویس' : 'Discard Draft'}
                  </button>
                )}
              </div>

              {/* Save to Server Button */}
              <button
                onClick={() => saveToServer()}
                disabled={isSyncing}
                className="w-full py-1.5 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-amber-400 hover:text-amber-300 font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
              >
                <CloudUpload className="w-3 h-3" />
                <span>{isPersian ? 'ذخیره در سرور (Postgres)' : 'Save to DB Server'}</span>
              </button>
            </div>
          </div>

          {/* Navigation Links (grouped) */}
          <div className="mt-5 flex-1 min-h-0 overflow-y-auto pr-1 space-y-4">
            {NAV_SECTIONS.map((section) => {
              const items = navItems.filter((it) => SECTION_OF[it.href] === section.key);
              if (!items.length) return null;
              const hasActive = items.some((it) => isCurrentActive(it.href));
              const open = hasActive || !collapsedSections[section.key];
              return (
                <div key={section.key}>
                  <button
                    type="button"
                    onClick={() => toggleSection(section.key)}
                    className="w-full flex items-center justify-between px-3 py-1.5 mb-1 text-[10px] font-bold text-zinc-500 uppercase tracking-wider hover:text-zinc-300 transition-colors"
                  >
                    <span>{section.label}</span>
                    <ChevronRight
                      className={`w-3 h-3 transition-transform ${open ? 'rotate-90' : ''}`}
                    />
                  </button>
                  {open && (
                    <nav className="space-y-1.5">
                      {items.map((item) => {
                        const active = isCurrentActive(item.href);
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                              active
                                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-sm shadow-amber-500/10'
                                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <Icon className={`w-4 h-4 ${active ? 'text-amber-400' : 'text-zinc-500'}`} />
                              <span>{item.label}</span>
                            </div>
                            {item.count !== undefined && (
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-md font-mono ${
                                  active ? 'bg-amber-500/20 text-amber-300' : 'bg-zinc-800/80 text-zinc-500'
                                }`}
                              >
                                {item.count}
                              </span>
                            )}
                            {item.isSpecial && (
                              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                            )}
                          </Link>
                        );
                      })}
                    </nav>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-zinc-800/80 space-y-2.5">
          <button
            onClick={exportStoryJson}
            className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/20 transition-all cursor-pointer shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            {isPersian ? 'خروجی فایل داستان (JSON)' : 'Export Story JSON'}
          </button>
          <Link
            href="/"
            className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold border border-zinc-800 transition-all"
          >
            {isRtl ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
            {isPersian ? 'بازگشت به کتاب‌خوان' : 'Back to Game Reader'}
          </Link>
          <div className="text-[10px] text-zinc-600 text-center">StoryForge Engine © 2026</div>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 pb-28 md:pb-8">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-5 py-3.5 bg-[#0d0e15]/90 border-b border-zinc-800/80 sticky top-0 z-40 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center text-white font-black text-sm">
              ⚡
            </div>
            <div>
              <div className="font-bold text-sm text-zinc-100">{isPersian ? 'استودیو' : 'Studio'}</div>
              <div className="text-[10px] text-zinc-400 truncate max-w-[140px]">{story.title}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportStoryJson}
              className="p-1.5 bg-zinc-800 text-amber-400 rounded-lg border border-zinc-700"
              title="Export JSON"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1 text-xs bg-zinc-800 text-amber-400 px-2.5 py-1 rounded-lg border border-zinc-700"
            >
              <Languages className="w-3.5 h-3.5" />
              {isPersian ? 'EN' : 'فا'}
            </button>
            <Link
              href="/"
              className="p-1.5 bg-zinc-800 text-zinc-300 rounded-lg border border-zinc-700"
              title="Reader"
            >
              <Scroll className="w-4 h-4" />
            </Link>
          </div>
        </header>

        {/* Page Content Body */}
        <main className="max-w-7xl w-full mx-auto px-4 md:px-8 py-6 md:py-8 flex-1">
          {!selectedStoryId && (
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-200">
              <BookOpen className="w-5 h-5 shrink-0" />
        <div className="flex-1 min-h-0 flex flex-col">
                <p className="font-semibold">
                  {isPersian ? 'هنوز داستانی انتخاب نشده' : 'No story selected'}
                </p>
                <p className="text-amber-200/80 text-xs mt-0.5">
                  {isPersian
                    ? 'از کتابخانه داستان‌ها، داستانی ایجاد یا انتخاب کنید.'
                    : 'Create or pick a story from the Story Library to start authoring.'}
                </p>
              </div>
              <Link
                href="/studio/stories"
                className="ml-auto shrink-0 px-3 py-1.5 rounded-xl bg-amber-500 text-zinc-950 text-xs font-bold hover:bg-amber-400 cursor-pointer"
              >
                {isPersian ? 'برو به کتابخانه' : 'Go to Library'}
              </Link>
            </div>
          )}
          {children}
        </main>
      </div>

      {/* Mobile Floating Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-3 left-4 right-4 z-50">
        <div className="bg-[#10121c]/95 border border-zinc-800/90 backdrop-blur-2xl rounded-3xl py-2 px-1 shadow-2xl shadow-black relative grid grid-cols-5 items-center">
          {/* Tab 1: World Bible */}
          <Link
            href="/studio/world"
            className={`flex flex-col items-center justify-center gap-1 py-1 transition-all ${
              isCurrentActive('/studio/world')
                ? 'text-amber-400 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <BookOpen className="w-4 h-4 shrink-0" />
            <span className="text-[10px] truncate max-w-[65px] text-center">{navItems[0].shortLabel}</span>
          </Link>

          {/* Tab 2: RPG Rules */}
          <Link
            href="/studio/rpg"
            className={`flex flex-col items-center justify-center gap-1 py-1 transition-all ${
              isCurrentActive('/studio/rpg')
                ? 'text-amber-400 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sword className="w-4 h-4 shrink-0" />
            <span className="text-[10px] truncate max-w-[65px] text-center">{navItems[3].shortLabel}</span>
          </Link>

          {/* Center Column Spacer for Grid */}
          <div className="flex justify-center items-center pointer-events-none">
            <span className="w-12 h-6" />
          </div>

          {/* Absolute Dead-Center Elevated Action Button */}
          <div className="absolute left-1/2 -translate-x-1/2 -top-5 flex justify-center items-center z-10">
            <Link
              href="/studio/sandbox"
              className="w-13 h-13 rounded-full bg-gradient-to-tr from-emerald-400 via-teal-300 to-emerald-200 text-zinc-950 flex items-center justify-center shadow-lg shadow-emerald-500/40 border-4 border-[#090a0f] hover:scale-105 active:scale-95 transition-all shrink-0"
              title={isPersian ? 'سندباکس و هوش مصنوعی' : 'AI Sandbox Simulator'}
            >
              <LayoutGrid className="w-6 h-6 stroke-[2.5]" />
            </Link>
          </div>

          {/* Tab 3: NPCs */}
          <Link
            href="/studio/npcs"
            className={`flex flex-col items-center justify-center gap-1 py-1 transition-all ${
              isCurrentActive('/studio/npcs')
                ? 'text-amber-400 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <User className="w-4 h-4 shrink-0" />
            <span className="text-[10px] truncate max-w-[65px] text-center">{navItems[4].shortLabel}</span>
          </Link>

          {/* Tab 4: Beats */}
          <Link
            href="/studio/beats"
            className={`flex flex-col items-center justify-center gap-1 py-1 transition-all ${
              isCurrentActive('/studio/beats')
                ? 'text-amber-400 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <GitBranch className="w-4 h-4 shrink-0" />
            <span className="text-[10px] truncate max-w-[65px] text-center">{navItems[2].shortLabel}</span>
          </Link>
        </div>
      </nav>

      <StoryDetailsModal isOpen={isDetailsOpen} onClose={() => setIsDetailsOpen(false)} />
    </div>
  );
}

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <StudioStoryProvider>
      <StudioShell>{children}</StudioShell>
    </StudioStoryProvider>
  );
}
