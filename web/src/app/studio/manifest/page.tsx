'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useStudioStory } from '@/lib/context/StudioStoryContext';
import { notify } from '@/lib/notify';
import { FileJson, Save, Download, Copy, RotateCcw, AlertTriangle } from 'lucide-react';
import type { StoryManifest } from '@/lib/types';

const pretty = (s: StoryManifest) => JSON.stringify(s, null, 2);

export default function StoryManifestPage() {
  const { story, isPersian, importStoryJson, exportStoryJson } = useStudioStory();

  const [text, setText] = useState('');
  const [savedText, setSavedText] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const loadedId = useRef<string | null>(null);

  // Load (or reload) the editor when switching stories — never clobber in-progress edits.
  useEffect(() => {
    if (story?.id && loadedId.current !== story.id) {
      loadedId.current = story.id;
      const initial = pretty(story);
      setText(initial);
      setSavedText(initial);
      setParseError(null);
    }
  }, [story]);

  const dirty = text !== savedText;

  const handleSave = () => {
    try {
      const parsed = JSON.parse(text);
      setParseError(null);
      importStoryJson(parsed);
      const repr = pretty(parsed);
      setText(repr);
      setSavedText(repr);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setParseError(message);
      notify.error(isPersian ? 'JSON نامعتبر است' : 'Invalid JSON');
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      notify.success(isPersian ? 'در حافظه کپی شد' : 'Copied to clipboard');
    } catch {
      notify.error(isPersian ? 'کپی ناموفق بود' : 'Copy failed');
    }
  };

  const handleReset = () => {
    setText(pretty(story));
    setSavedText(pretty(story));
    setParseError(null);
    notify.info(isPersian ? 'به نسخهٔ ذخیره‌شده برگردانده شد' : 'Reverted to saved manifest');
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-sm shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <FileJson className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl md:text-2xl font-bold text-zinc-100">
              {isPersian ? 'مانیفست داستان (JSON)' : 'Story Manifest (JSON)'}
            </h2>
            {dirty && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300">
                {isPersian ? 'ویرایش‌شده • ذخیره نشده' : 'Edited • Unsaved'}
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-400 max-w-3xl leading-relaxed">
            {isPersian
              ? 'مشاهده و ویرایش مستقیم مانیفست کامل داستان. ذخیره، اعتبارسنجی و در حافظهٔ استودیو ثبت می‌کند.'
              : 'View and directly edit the full story manifest. Saving validates and persists it to the studio store.'}
          </p>
          <p className="text-[11px] text-zinc-500 font-mono mt-1" dir="ltr">
            {story?.id} • {(text.length / 1024).toFixed(1)} KB
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleReset}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isPersian ? 'بازنشانی' : 'Reset'}</span>
          </button>
          <button
            onClick={handleCopy}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{isPersian ? 'کپی' : 'Copy'}</span>
          </button>
          <button
            onClick={exportStoryJson}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isPersian ? 'دانلود فایل' : 'Download'}</span>
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold shadow-lg shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isPersian ? 'ذخیره تغییرات' : 'Save Changes'}</span>
          </button>
        </div>
      </div>

      {parseError && (
        <div className="p-3.5 rounded-2xl bg-red-950/40 border border-red-500/40 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-red-300">
              {isPersian ? 'خطای تجزیه JSON:' : 'JSON parse error:'}
            </p>
            <p className="text-[11px] text-red-200/90 font-mono mt-0.5" dir="ltr">{parseError}</p>
          </div>
        </div>
      )}

      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-4 shadow-xl">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          dir="ltr"
          rows={30}
          className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 font-mono text-[11px] leading-relaxed text-zinc-200 focus:outline-none focus:border-amber-500/60 whitespace-pre"
          placeholder='{"id": "..."}'
        />
      </div>
    </div>
  );
}
