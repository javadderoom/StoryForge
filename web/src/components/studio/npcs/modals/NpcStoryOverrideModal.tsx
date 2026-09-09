'use client';

import React, { useState, useEffect } from 'react';
import { Layers, X } from 'lucide-react';
import { NPCDossier, StoryNpcOverride, StoryManifest } from '@/lib/types';

export interface NpcStoryOverrideModalProps {
  open: boolean;
  targetNpc: NPCDossier | null;
  story?: StoryManifest;
  existingOverride?: StoryNpcOverride;
  isPersian: boolean;
  onClose: () => void;
  onSave: (override: Partial<StoryNpcOverride>) => void;
}

export function NpcStoryOverrideModal({
  open,
  targetNpc,
  story,
  existingOverride,
  isPersian,
  onClose,
  onSave,
}: NpcStoryOverrideModalProps) {
  const [overrideForm, setOverrideForm] = useState<{
    storyRole: string;
    relationshipToProtagonist: string;
    storyGoal: string;
    storySecret: string;
    customInitialTrust?: number;
    narrativeImportance: 'central' | 'supporting' | 'incidental';
    firstAppearanceChapter?: number;
  }>({
    storyRole: '',
    relationshipToProtagonist: '',
    storyGoal: '',
    storySecret: '',
    customInitialTrust: undefined,
    narrativeImportance: 'supporting',
    firstAppearanceChapter: undefined,
  });

  useEffect(() => {
    if (targetNpc) {
      const activeOverride = existingOverride || (story?.storyNpcOverrides?.[targetNpc.id]);
      setOverrideForm({
        storyRole: activeOverride?.storyRole || '',
        relationshipToProtagonist: activeOverride?.relationshipToProtagonist || '',
        storyGoal: activeOverride?.storyGoal || '',
        storySecret: activeOverride?.storySecret || '',
        customInitialTrust: activeOverride?.customInitialTrust,
        narrativeImportance: activeOverride?.narrativeImportance || 'supporting',
        firstAppearanceChapter: activeOverride?.firstAppearanceChapter,
      });
    }
  }, [targetNpc, existingOverride, story, open]);

  if (!open || !targetNpc) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      storyRole: (overrideForm.storyRole || '').trim() || undefined,
      relationshipToProtagonist: (overrideForm.relationshipToProtagonist || '').trim() || undefined,
      storyGoal: (overrideForm.storyGoal || '').trim() || undefined,
      storySecret: (overrideForm.storySecret || '').trim() || undefined,
      customInitialTrust:
        typeof overrideForm.customInitialTrust === 'number' && !isNaN(overrideForm.customInitialTrust)
          ? overrideForm.customInitialTrust
          : undefined,
      narrativeImportance: overrideForm.narrativeImportance,
      firstAppearanceChapter: overrideForm.firstAppearanceChapter,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              {isPersian ? 'نقش اختصاصی در این داستان' : 'Story-Specific Role Override'}
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              {targetNpc.name} ({targetNpc.title || targetNpc.role || 'NPC'})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-indigo-300/80 bg-indigo-950/30 border border-indigo-500/20 rounded-xl p-3 leading-relaxed">
          {isPersian
            ? 'این تنظیمات بدون دستکاری پرونده اصلی شخصیت در جهان، لنز روایت و نقش شخصیت را منحصراً در این داستان بازتعریف می‌کنند.'
            : 'These settings redefine the narrative lens and function of this NPC specifically for this story without modifying the shared World Bible.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              {isPersian ? 'نقش در این داستان (Story Role)' : 'Role in this Story'}
            </label>
            <input
              type="text"
              value={overrideForm.storyRole}
              onChange={(e) => setOverrideForm((prev) => ({ ...prev, storyRole: e.target.value }))}
              placeholder={isPersian ? 'مثال: مظنون اصلی پرونده، هدف سرقت، مربی خیانت‌دیده...' : 'e.g. Prime Suspect, Heist Target, Reluctant Mentor...'}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              {isPersian ? 'ارتباط با شخصیت اصلی / قهرمان' : 'Relationship to Protagonist'}
            </label>
            <input
              type="text"
              value={overrideForm.relationshipToProtagonist}
              onChange={(e) => setOverrideForm((prev) => ({ ...prev, relationshipToProtagonist: e.target.value }))}
              placeholder={isPersian ? 'مثال: شریک قدیمی که از گذشته شما باخبر است...' : 'e.g. Former partner who knows your dark secret...'}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              {isPersian ? 'انگیزه و هدف در این داستان' : 'Goal / Agenda in this Story'}
            </label>
            <input
              type="text"
              value={overrideForm.storyGoal}
              onChange={(e) => setOverrideForm((prev) => ({ ...prev, storyGoal: e.target.value }))}
              placeholder={isPersian ? 'مثال: تلاش برای امحای مدارک قبل از بازجویی...' : 'e.g. Trying to destroy the evidence before interrogation...'}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              {isPersian ? 'راز داستانی منحصربه‌فرد' : 'Story-Specific Secret'}
            </label>
            <textarea
              rows={2}
              value={overrideForm.storySecret}
              onChange={(e) => setOverrideForm((prev) => ({ ...prev, storySecret: e.target.value }))}
              placeholder={isPersian ? 'رازی که فقط در این پی‌رنگ و سناریو اهمیت پیدا می‌کند...' : 'A secret relevant specifically to this plot arc...'}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                {isPersian ? 'میزان اعتماد اولیه' : 'Custom Initial Trust'}
              </label>
              <input
                type="number"
                min={-100}
                max={100}
                value={overrideForm.customInitialTrust !== undefined ? overrideForm.customInitialTrust : ''}
                onChange={(e) =>
                  setOverrideForm((prev) => ({
                    ...prev,
                    customInitialTrust: e.target.value === '' ? undefined : parseInt(e.target.value, 10),
                  }))
                }
                placeholder={`Def: ${targetNpc.initialTrust ?? 0}`}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                {isPersian ? 'اهمیت روایی' : 'Importance'}
              </label>
              <select
                value={overrideForm.narrativeImportance}
                onChange={(e) =>
                  setOverrideForm((prev) => ({
                    ...prev,
                    narrativeImportance: e.target.value as 'central' | 'supporting' | 'incidental',
                  }))
                }
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="central">{isPersian ? 'محوری (پین‌شده)' : 'Central'}</option>
                <option value="supporting">{isPersian ? 'مکمل (Supporting)' : 'Supporting'}</option>
                <option value="incidental">{isPersian ? 'فرعی (Incidental)' : 'Incidental'}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                {isPersian ? 'ورود به داستان' : 'First Entrance'}
              </label>
              <select
                value={overrideForm.firstAppearanceChapter !== undefined ? overrideForm.firstAppearanceChapter : ''}
                onChange={(e) =>
                  setOverrideForm((prev) => ({
                    ...prev,
                    firstAppearanceChapter: e.target.value === '' ? undefined : parseInt(e.target.value, 10),
                  }))
                }
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="">{isPersian ? 'در هر فصلی' : 'Any Chapter'}</option>
                {story?.saga?.chapters?.length ? (
                  story.saga.chapters.map((ch) => (
                    <option key={ch.chapterNumber} value={ch.chapterNumber}>
                      {isPersian
                        ? `فصل ${ch.chapterNumber}: ${ch.title || `فصل ${ch.chapterNumber}`}`
                        : `Ch ${ch.chapterNumber}: ${ch.title || `Ch ${ch.chapterNumber}`}`}
                    </option>
                  ))
                ) : (
                  [1, 2, 3, 4, 5].map((num) => (
                    <option key={num} value={num}>
                      {isPersian ? `فصل ${num}` : `Chapter ${num}`}
                    </option>
                  ))
                )}
              </select>
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
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 cursor-pointer shadow-lg shadow-indigo-600/30"
            >
              {isPersian ? 'ذخیره نقش اختصاصی' : 'Save Override'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default NpcStoryOverrideModal;
