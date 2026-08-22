'use client';

import React, { useEffect, useState } from 'react';
import { BookOpen, Sparkles, X, Swords, Globe, Check } from 'lucide-react';

interface StorySummary {
  id: string;
  title: string;
  tagline: string;
  synopsis: string;
  genres: string[];
  language: string;
  author: string;
  statsPreview?: string[];
}

interface StoryCatalogModalProps {
  isOpen: boolean;
  activeStoryId: string;
  isPersian?: boolean;
  onSelectStory: (storyId: string) => void;
  onClose: () => void;
}

export function StoryCatalogModal({
  isOpen,
  activeStoryId,
  isPersian = false,
  onSelectStory,
  onClose,
}: StoryCatalogModalProps) {
  const [stories, setStories] = useState<StorySummary[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch the playable catalog when the modal opens.
  // Intentional setState-in-effect: triggers an async fetch (loading + data) on open,
  // which cannot be expressed as a pure render-time derivation.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    fetch('/api/play/stories')
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          setStories(json.data);
        }
      })
      .catch((e) => console.error('Failed to load catalog:', e))
      .finally(() => setLoading(false));
  }, [isOpen]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[#10121c] border border-zinc-800/90 rounded-3xl p-6 shadow-2xl space-y-6 text-zinc-100 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div>
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-amber-400" />
              {isPersian ? 'کتابخانه داستان‌ها و دنیاها' : 'StoryForge World Library'}
            </span>
            <p className="text-xs text-zinc-400 mt-1">
              {isPersian
                ? 'ماجراجویی مورد نظر خود را برای تجربه انتخاب کنید'
                : 'Select an interactive adventure to begin your journey'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Story List */}
        <div className="overflow-y-auto flex-1 space-y-4 pr-1">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-amber-400/80 animate-pulse space-y-2">
              <Sparkles className="w-6 h-6 animate-spin" />
              <p className="text-xs font-medium">
                {isPersian ? 'در حال بارگذاری کتابخانه...' : 'Loading worlds...'}
              </p>
            </div>
          ) : stories.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center text-zinc-500">
              <BookOpen className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">
                {isPersian
                  ? 'هنوز داستانی منتشر نشده است. از استودیو داستانی بسازید و آن را منتشر کنید.'
                  : 'No published stories yet. Create one in the Studio and publish it.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {stories.map((story) => {
                const isCurrent = story.id === activeStoryId;
                return (
                  <div
                    key={story.id}
                    className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                      isCurrent
                        ? 'bg-amber-500/10 border-amber-500/60 shadow-lg shadow-amber-500/10'
                        : 'bg-zinc-900/80 border-zinc-800/90 hover:border-zinc-700'
                    }`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 flex items-center gap-1 border border-zinc-700">
                          <Globe className="w-2.5 h-2.5" />
                          {story.language.toUpperCase()}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-zinc-950 flex items-center gap-1">
                            <Check className="w-2.5 h-2.5" />
                            {isPersian ? 'داستان جاری' : 'Active'}
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-sm text-zinc-100 leading-snug">
                        {story.title}
                      </h3>
                      <p className="text-xs text-amber-400/90 font-medium">
                        {story.tagline}
                      </p>
                      <p className="text-[11px] text-zinc-400 line-clamp-3 leading-relaxed">
                        {story.synopsis}
                      </p>

                      {/* Genre Tags */}
                      <div className="flex flex-wrap gap-1 pt-1">
                        {story.genres?.map((g) => (
                          <span
                            key={g}
                            className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-800/90 text-zinc-400 border border-zinc-700/50"
                          >
                            #{g}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      onClick={() => {
                        onSelectStory(story.id);
                        onClose();
                      }}
                      className={`mt-4 w-full py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        isCurrent
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
                      }`}
                    >
                      <Swords className="w-3.5 h-3.5" />
                      <span>
                        {isCurrent
                          ? isPersian
                            ? 'ادامه ماجراجویی'
                            : 'Continue Story'
                          : isPersian
                          ? 'شروع این ماجراجویی'
                          : 'Play Story'}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
