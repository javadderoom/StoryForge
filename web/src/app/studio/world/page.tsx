'use client';

import React from 'react';
import { useStudioStory } from '@/lib/context/StudioStoryContext';
import { BookOpen, Shield, Users } from 'lucide-react';

export default function WorldBiblePage() {
  const { story, isPersian } = useStudioStory();

  const t = {
    heading: isPersian ? 'انجیل جهان و قوانین ثابت' : 'World Bible & Lore Graph',
    subheading: isPersian
      ? 'حقایق ثابت، قوانین فیزیکی/جادویی و جناح‌های تغییرناپذیر جهان'
      : 'Immutable world rules, physics/magic laws, factions, and geographical codices.',
    worldIdLabel: isPersian ? 'شناسه جهان:' : 'World ID:',
    artisticTone: isPersian ? 'لحن هنری و فضاسازی:' : 'Artistic Tone & Atmosphere:',
    immutableLaws: isPersian ? 'قوانین ثابت و محدودیت‌ها' : 'Immutable World Laws',
    factions: isPersian ? 'جناح‌ها و هم‌پیمانی‌ها' : 'Factions & Allegiances',
    goals: isPersian ? 'اهداف عمومی:' : 'Public Goals:',
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-sm shadow-xl">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <BookOpen className="w-5 h-5 text-amber-400" />
              <h2 className="text-xl md:text-2xl font-bold text-zinc-100">{story.worldBible.worldName}</h2>
            </div>
            <p className="text-sm text-zinc-400 max-w-3xl leading-relaxed">{story.worldBible.summary}</p>
          </div>
          <span className="text-xs bg-zinc-800/90 border border-zinc-700/60 text-zinc-300 px-3.5 py-1.5 rounded-xl font-mono self-start">
            {t.worldIdLabel} {story.worldBible.worldId}
          </span>
        </div>

        <div className="mt-5 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/15 text-xs text-amber-200/90 flex items-start gap-2.5">
          <span className="font-bold text-amber-400 shrink-0">{t.artisticTone}</span>
          <span>{story.worldBible.themeNotes}</span>
        </div>
      </div>

      {/* Laws & Factions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Immutable Laws */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 shadow-xl">
          <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider mb-5 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-rose-400" /> {t.immutableLaws}
            </span>
            <span className="text-xs font-mono bg-rose-500/10 text-rose-300 px-2 py-0.5 rounded-lg border border-rose-500/20">
              {story.worldBible.laws.length}
            </span>
          </h3>
          <div className="space-y-3.5">
            {story.worldBible.laws.map((law) => (
              <div
                key={law.id}
                className="p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800/70 hover:border-zinc-700/80 transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400 px-2.5 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/20">
                    {law.category}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">{law.id}</span>
                </div>
                <h4 className="text-sm font-semibold text-zinc-200">{law.rule}</h4>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{law.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Factions */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 shadow-xl">
          <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider mb-5 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" /> {t.factions}
            </span>
            <span className="text-xs font-mono bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded-lg border border-blue-500/20">
              {story.worldBible.factions.length}
            </span>
          </h3>
          <div className="space-y-3.5">
            {story.worldBible.factions.map((fac) => (
              <div
                key={fac.id}
                className="p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800/70 hover:border-zinc-700/80 transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-zinc-200">{fac.name}</h4>
                  <span className="text-xs text-blue-400 font-medium px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">
                    {fac.alignment}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">{fac.description}</p>
                <div className="mt-3 pt-2.5 border-t border-zinc-800/50 text-xs text-zinc-500">
                  <strong className="text-zinc-400">{t.goals}</strong> {fac.publicGoals}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
