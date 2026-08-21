'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { StudioStoryProvider, useStudioStory } from '@/lib/context/StudioStoryContext';
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
} from 'lucide-react';

function StudioShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isPersian, isRtl, story, toggleLanguage } = useStudioStory();

  const navItems = [
    {
      href: '/studio/world',
      label: isPersian ? 'انجیل جهان' : 'World Bible',
      shortLabel: isPersian ? 'جهان' : 'World',
      icon: BookOpen,
      count: story.worldBible.laws.length,
    },
    {
      href: '/studio/lore-graph',
      label: isPersian ? 'گراف شبکه جهان' : 'Lore Graph',
      shortLabel: isPersian ? 'گراف' : 'Graph',
      icon: Share2,
      isSpecial: true,
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
  ];

  const isCurrentActive = (href: string) => {
    if (pathname === '/studio' && href === '/studio/world') return true;
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-zinc-100 flex flex-col md:flex-row antialiased selection:bg-amber-500/30 selection:text-amber-200">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-72 bg-[#0c0d14] border-r border-zinc-800/80 p-5 shrink-0 justify-between sticky top-0 h-screen z-40">
        <div>
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
                {isPersian ? 'نسخه ۱.۰ نویسندگی' : 'V1.0 Authoring Suite'}
              </span>
            </div>
          </div>

          {/* Story Selector & Language Switch */}
          <div className="mt-5 p-3 rounded-2xl bg-zinc-900/70 border border-zinc-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-medium">{isPersian ? 'داستان فعال:' : 'Active Story:'}</span>
              <button
                onClick={toggleLanguage}
                className="flex items-center gap-1 text-[11px] bg-zinc-800 hover:bg-zinc-700 text-amber-400 px-2 py-0.5 rounded-lg border border-zinc-700/80 transition-all font-semibold"
              >
                <Languages className="w-3 h-3" />
                {isPersian ? 'English' : 'فارسی'}
              </button>
            </div>
            <div className="text-sm font-bold text-zinc-200 truncate">{story.title}</div>
            <div className="text-[11px] text-zinc-500 truncate">{story.tagline}</div>
          </div>

          {/* Navigation Links */}
          <nav className="mt-6 space-y-1.5">
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-3 mb-2">
              {isPersian ? 'بخش‌های استودیو' : 'Studio Modules'}
            </div>
            {navItems.map((item) => {
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
                        active
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-zinc-800/80 text-zinc-500'
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
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-zinc-800/80 space-y-3">
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
          {children}
        </main>
      </div>

      {/* Mobile Floating Bottom Navigation Bar (Styled after user reference image) */}
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
            <span className="text-[10px] truncate max-w-[65px] text-center">{navItems[1].shortLabel}</span>
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
            <span className="text-[10px] truncate max-w-[65px] text-center">{navItems[2].shortLabel}</span>
          </Link>

          {/* Tab 4: AI Sandbox */}
          <Link
            href="/studio/sandbox"
            className={`flex flex-col items-center justify-center gap-1 py-1 transition-all ${
              isCurrentActive('/studio/sandbox')
                ? 'text-amber-400 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            <span className="text-[10px] truncate max-w-[65px] text-center">{navItems[3].shortLabel}</span>
          </Link>
        </div>
      </nav>
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
