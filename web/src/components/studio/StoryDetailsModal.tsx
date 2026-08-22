'use client';

import React, { useState } from 'react';
import { X, Check, Plus, Tag } from 'lucide-react';
import { useStudioStory } from '@/lib/context/StudioStoryContext';
import { GENRE_LABELS, GENRE_PRESETS } from '@/lib/genrePresets';

function StoryDetailsForm({
  onClose,
}: {
  onClose: () => void;
}) {
  const { story, isPersian, updateStoryMeta } = useStudioStory();

  const [title, setTitle] = useState(story.title);
  const [tagline, setTagline] = useState(story.tagline);
  const [synopsis, setSynopsis] = useState(story.synopsis);
  const [author, setAuthor] = useState(story.author);
  const [version, setVersion] = useState(story.version);
  const [language, setLanguage] = useState<'en' | 'fa'>(story.language);
  const [selectedGenres, setSelectedGenres] = useState<string[]>(story.genres || []);
  const [customGenre, setCustomGenre] = useState('');

  const togglePreset = (g: string) => {
    setSelectedGenres((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );
  };

  const addCustomGenre = () => {
    const value = customGenre.trim();
    if (!value) return;
    setSelectedGenres((prev) => (prev.includes(value) ? prev : [...prev, value]));
    setCustomGenre('');
  };

  const removeGenre = (g: string) => {
    setSelectedGenres((prev) => prev.filter((x) => x !== g));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateStoryMeta({
      title: title.trim() || story.title,
      tagline,
      synopsis,
      author: author.trim() || story.author,
      version: version.trim() || story.version,
      language,
      genres: selectedGenres,
    });
    onClose();
  };

  return (
    <form
      onSubmit={handleSave}
      className="bg-zinc-900 border border-amber-500/30 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-5 max-h-[85vh] overflow-y-auto"
    >
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2.5">
          <Tag className="w-5 h-5 text-amber-400" />
          <h3 className="text-base font-bold text-zinc-100">
            {isPersian ? 'جزئیات داستان' : 'Story Details'}
          </h3>
        </div>
        <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-zinc-300 mb-1.5">
            {isPersian ? 'عنوان داستان:' : 'Story Title:'}
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-zinc-300 mb-1.5">
            {isPersian ? 'شعار / خلاصه کوتاه:' : 'Tagline:'}
          </label>
          <input
            type="text"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-zinc-300 mb-1.5">
            {isPersian ? 'خلاصه داستان:' : 'Synopsis:'}
          </label>
          <textarea
            value={synopsis}
            onChange={(e) => setSynopsis(e.target.value)}
            rows={3}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-amber-500 resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1.5">
              {isPersian ? 'نویسنده:' : 'Author:'}
            </label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1.5">
              {isPersian ? 'نسخه:' : 'Version:'}
            </label>
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-zinc-300 mb-1.5">
            {isPersian ? 'زبان:' : 'Language:'}
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as 'en' | 'fa')}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
          >
            <option value="en">English</option>
            <option value="fa">فارسی (Persian)</option>
          </select>
        </div>

        {/* Genres: multi-select presets + custom */}
        <div>
          <label className="block text-xs font-bold text-zinc-300 mb-1.5">
            {isPersian ? 'ژانرها (چند مورد قابل انتخاب):' : 'Genres (pick any, add your own):'}
          </label>

          <div className="flex flex-wrap gap-1.5 mb-3">
            {selectedGenres.map((g) => {
              const meta = GENRE_LABELS[g as keyof typeof GENRE_LABELS];
              return (
                <span
                  key={g}
                  className={`text-[10px] font-semibold px-2 py-1 rounded-md border flex items-center gap-1 ${
                    meta ? meta.color : 'bg-zinc-800/80 text-zinc-300 border-zinc-700'
                  }`}
                >
                  {meta ? (isPersian ? meta.fa : meta.en) : g}
                  <button
                    type="button"
                    onClick={() => removeGenre(g)}
                    className="hover:text-rose-300 transition-colors cursor-pointer"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              );
            })}
            {selectedGenres.length === 0 && (
              <span className="text-[11px] text-zinc-500">
                {isPersian ? 'هنوز ژانری انتخاب نشده' : 'No genres selected'}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 mb-3">
            {GENRE_PRESETS.map((g) => {
              const meta = GENRE_LABELS[g];
              const active = selectedGenres.includes(g);
              return (
                <button
                  type="button"
                  key={g}
                  onClick={() => togglePreset(g)}
                  className={`text-[10px] font-semibold px-2 py-1 rounded-md border transition-all cursor-pointer ${
                    active
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:border-zinc-500'
                  }`}
                >
                  {active && <Check className="w-2.5 h-2.5 inline mr-1" />}
                  {isPersian ? meta.fa : meta.en}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={customGenre}
              onChange={(e) => setCustomGenre(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustomGenre();
                }
              }}
              placeholder={isPersian ? 'ژانر دلخواه...' : 'Custom genre...'}
              className="flex-1 bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
            />
            <button
              type="button"
              onClick={addCustomGenre}
              className="flex items-center gap-1 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-400 text-xs font-semibold border border-zinc-700 transition-all cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              {isPersian ? 'افزودن' : 'Add'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700 cursor-pointer"
        >
          {isPersian ? 'انصراف' : 'Cancel'}
        </button>
        <button
          type="submit"
          className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold shadow-lg shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer"
        >
          <Check className="w-3.5 h-3.5" />
          {isPersian ? 'ذخیره' : 'Save'}
        </button>
      </div>
    </form>
  );
}

export function StoryDetailsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <StoryDetailsForm onClose={onClose} />
    </div>
  );
}
