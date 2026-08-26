'use client';

import React, { useState } from 'react';
import { BookOpen, X, Swords, Globe, Check } from 'lucide-react';
import { CatalogStory, getCoverUrl } from '@/lib/play/api';
import { audioService } from '@/lib/play/audioService';

interface StoryCatalogModalProps {
  isOpen: boolean;
  activeStoryId: string;
  isPersian?: boolean;
  stories: CatalogStory[];
  onSelectStory: (story: CatalogStory) => void;
  onClose: () => void;
}

export function StoryCatalogModal({
  isOpen,
  activeStoryId,
  isPersian = false,
  stories,
  onSelectStory,
  onClose,
}: StoryCatalogModalProps) {
  const [imgError, setImgError] = useState<Record<string, boolean>>({});

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-zinc-800/90 bg-[#10121c] p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-400">
              <BookOpen className="h-4 w-4 text-amber-400" />
              {isPersian ? 'کتابخانه داستان‌ها و دنیاها' : 'StoryForge World Library'}
            </span>
            <p className="mt-1 text-xs text-zinc-400">
              {isPersian ? 'ماجراجویی مورد نظر خود را برای تجربه انتخاب کنید' : 'Select an interactive adventure to begin your journey'}
            </p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 grid flex-1 grid-cols-1 gap-4 overflow-y-auto pr-1 md:grid-cols-2">
          {stories.length === 0 && (
            <div className="col-span-2 py-12 text-center text-sm text-zinc-500">
              {isPersian ? 'هنوز داستانی منتشر نشده است.' : 'No published stories yet.'}
            </div>
          )}
          {stories.map((story) => {
            const isCurrent = story.id === activeStoryId;
            const cover = getCoverUrl(story.id, story.coverImageUrl);
            const showCover = cover && !imgError[story.id];
            return (
              <div
                key={story.id}
                className={`overflow-hidden rounded-2xl border transition-all ${isCurrent ? 'border-amber-500/60 bg-amber-500/10 shadow-lg shadow-amber-500/10' : 'border-zinc-800/90 bg-zinc-900/80 hover:border-zinc-700'}`}
              >
                <div className="relative h-32 w-full overflow-hidden" style={{ background: 'linear-gradient(135deg,#1a1530,#0a0a14)' }}>
                  {showCover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cover!}
                      alt={story.title}
                      className="h-full w-full object-cover"
                      onError={() => setImgError((e) => ({ ...e, [story.id]: true }))}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-4xl opacity-30">📖</div>
                  )}
                  <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-zinc-200">
                    <Globe className="h-2.5 w-2.5" />
                    {story.language.toUpperCase()}
                  </div>
                  {isCurrent && (
                    <div className="absolute left-2 top-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-zinc-950">
                      <Check className="mr-0.5 inline h-2.5 w-2.5" />
                      {isPersian ? 'جاری' : 'Active'}
                    </div>
                  )}
                </div>

                <div className="space-y-2.5 p-4">
                  <h3 className="text-sm font-bold leading-snug text-zinc-100">{story.title}</h3>
                  <p className="text-xs text-amber-400/90">{story.tagline}</p>
                  <p className="line-clamp-3 text-[11px] leading-relaxed text-zinc-400">{story.synopsis}</p>
                  <div className="flex flex-wrap gap-1">
                    {(story.genres ?? []).map((g) => (
                      <span key={g} className="rounded bg-zinc-800/90 px-1.5 py-0.5 text-[9px] font-mono text-zinc-400">#{g}</span>
                    ))}
                  </div>
                  {story.statsPreview && story.statsPreview.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {story.statsPreview.slice(0, 4).map((s) => (
                        <span key={s} className="rounded bg-zinc-800/60 px-1.5 py-0.5 text-[9px] text-zinc-500">{s}</span>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => {
                      audioService.playSfx('buttonClick');
                      onSelectStory(story);
                      onClose();
                    }}
                    className={`mt-1 w-full rounded-xl py-2 text-xs font-bold transition-colors ${isCurrent ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30' : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'}`}
                  >
                    <Swords className="mr-1 inline h-3.5 w-3.5" />
                    {isCurrent ? (isPersian ? 'ادامه' : 'Continue') : isPersian ? 'بازی این داستان' : 'Play Story'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
