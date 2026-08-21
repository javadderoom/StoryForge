'use client';

import React from 'react';
import { useStudioStory } from '@/lib/context/StudioStoryContext';
import { StoryTreeCanvas } from '@/components/studio/StoryTreeCanvas';
import { GitBranch, Sparkles, BookOpen, Layers } from 'lucide-react';

export default function StoryBeatsStudioPage() {
  const { story, isPersian } = useStudioStory();

  const t = {
    heading: isPersian ? 'درخت روایی و شاخه‌بندی صحنه‌ها' : 'Branching Story Beats Tree',
    subheading: isPersian
      ? 'طراحی جریان سناریو، شرایط موفقیت/شکست تاس و ساختار تصمیم‌گیری داستان'
      : 'Visual narrative flowchart editor to map scenes, decision branches, and RPG skill check checkpoints.',
    totalBeats: isPersian ? 'صحنه‌های تعریف‌شده:' : 'Defined Story Beats:',
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-sm shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <GitBranch className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl md:text-2xl font-bold text-zinc-100">{t.heading}</h2>
          </div>
          <p className="text-sm text-zinc-400 max-w-3xl leading-relaxed">{t.subheading}</p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          <span className="text-xs bg-amber-500/10 border border-amber-500/20 text-amber-300 px-3.5 py-1.5 rounded-xl font-mono flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            {story.initialStoryBeats?.length || 1} {isPersian ? 'صحنه' : 'Beats'}
          </span>
        </div>
      </div>

      {/* Interactive Story Tree Canvas */}
      <StoryTreeCanvas story={story} isPersian={isPersian} />
    </div>
  );
}
