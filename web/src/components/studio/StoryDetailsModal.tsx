'use client';

import React, { useState } from 'react';
import { X, Check, Plus, Tag, Sparkles, Zap, Image as ImageIcon } from 'lucide-react';
import { useStudioStory } from '@/lib/context/StudioStoryContext';
import { GENRE_LABELS, GENRE_PRESETS } from '@/lib/genrePresets';
import { StoryScale, StoryUpdateNotice } from '@/lib/types';
import { ImageUploadField } from '@/components/studio/ImageUploadField';

function StoryDetailsForm({
  onClose,
}: {
  onClose: () => void;
}) {
  const { story, isPersian, updateStoryMeta } = useStudioStory();

  const [title, setTitle] = useState(story.title);
  const [tagline, setTagline] = useState(story.tagline);
  const [synopsis, setSynopsis] = useState(story.synopsis);
  const [storyScale, setStoryScale] = useState<StoryScale>(story.storyScale || 'urban');
  const [engineTier, setEngineTierState] = useState<'normal' | 'plus' | 'advance'>(story.engineTier || 'normal');
  const [coverImageUrl, setCoverImageUrl] = useState(story.coverImageUrl || '');
  const [author, setAuthor] = useState(story.author);
  const [version, setVersion] = useState(story.version);
  const [language, setLanguage] = useState<'en' | 'fa'>(story.language);
  const [selectedGenres, setSelectedGenres] = useState<string[]>(story.genres || []);
  const [customGenre, setCustomGenre] = useState('');

  // Story Update & Revamp Notice State
  const [updateNoticeEnabled, setUpdateNoticeEnabled] = useState(story.updateNotice?.enabled ?? false);
  const [noticeTitle, setNoticeTitle] = useState(story.updateNotice?.title ?? '');
  const [noticeMessage, setNoticeMessage] = useState(story.updateNotice?.message ?? '');
  const [noticeActionLabel, setNoticeActionLabel] = useState(story.updateNotice?.actionLabel ?? '');
  const [noticeAllowRefund, setNoticeAllowRefund] = useState(story.updateNotice?.allowRefund ?? true);
  const [noticeTargetScenes, setNoticeTargetScenes] = useState(
    story.updateNotice?.targetSceneIds?.join(', ') ?? ''
  );

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
    const parsedTargetScenes = noticeTargetScenes
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    updateStoryMeta({
      title: title.trim() || story.title,
      tagline,
      synopsis,
      storyScale,
      engineTier,
      coverImageUrl: coverImageUrl.trim(),
      author: author.trim() || story.author,
      version: version.trim() || story.version,
      language,
      genres: selectedGenres,
      updateNotice: {
        id: story.updateNotice?.id || `notice_${Date.now().toString(36)}`,
        enabled: updateNoticeEnabled,
        title: noticeTitle.trim(),
        message: noticeMessage.trim(),
        actionLabel: noticeActionLabel.trim() || undefined,
        allowRefund: noticeAllowRefund,
        targetSceneIds: parsedTargetScenes,
      },
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
            {isPersian ? 'شعار یا زیرعنوان کوتاه:' : 'Tagline / Hook:'}
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

        {/* Story Scale Setting */}
        <div>
          <label className="block text-xs font-bold text-zinc-300 mb-1.5">
            {isPersian ? 'مقیاس و گستره فیزیکی داستان:' : 'Story Physical Scale & Canvas:'}
          </label>
          <select
            value={storyScale}
            onChange={(e) => setStoryScale(e.target.value as StoryScale)}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="localized">
              {isPersian
                ? '📍 محلی / تک‌مکان (عمارت، صومعه، کشتی، دهکده)'
                : '📍 Localized (Single manor, compound, ship, or village)'}
            </option>
            <option value="urban">
              {isPersian
                ? '🏙️ شهری (یک شهر، محله‌ها، فاضلاب و حومه)'
                : '🏙️ Urban (Single city, districts, sewers, and immediate outskirts)'}
            </option>
            <option value="regional">
              {isPersian
                ? '🌲 منطقه‌ای (یک استان، قلمرو یا پادشاهی)'
                : '🌲 Regional (A province, duchy, or kingdom)'}
            </option>
            <option value="continental">
              {isPersian
                ? '🗺️ قاره‌ای (چندین کشور، سفر طولانی، کارزار جنگی)'
                : '🗺️ Continental (Multiple nations, world-spanning campaigns)'}
            </option>
            <option value="mythic">
              {isPersian
                ? '🌌 اسطوره‌ای / کیهانی (چندبعدی، قلمرو خدایان، نیروهای کیهانی)'
                : '🌌 Mythic (Planar, cosmic, gods, or epoch-shaping scale)'}
            </option>
          </select>
          <p className="text-[11px] text-zinc-500 mt-1">
            {isPersian
              ? 'هوش مصنوعی صحنه‌ها و چالش‌ها را متناسب با گستره فیزیکی انتخابی شما تنظیم می‌کند.'
              : 'The AI adapts scene generation boundaries and travel stakes to this physical canvas.'}
          </p>
        </div>

        {/* Cover Image URL */}
        <ImageUploadField
          value={coverImageUrl}
          onChange={setCoverImageUrl}
          label={isPersian ? 'تصویر کاور داستان:' : 'Story Cover Image:'}
          placeholder="https://... or upload file"
          folder="covers"
          isPersian={isPersian}
          resizeFit="inside"
          resizeWidth={1600}
          resizeHeight={1600}
        />

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

        {/* Engine Quality & Credit Tier */}
        <div className="rounded-2xl border border-zinc-700/80 bg-zinc-950/70 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-zinc-100">
                  {isPersian ? 'کیفیت و سطح پردازش صحنه‌ها' : 'Scene Engine Quality & Tier'}
                </h4>
                <p className="text-[11px] text-zinc-400">
                  {isPersian
                    ? 'تعیین کیفیت هوش مصنوعی روایی و هزینهٔ اعتبار هر نوبت'
                    : 'Configure storytelling AI tier and credit cost per scene.'}
                </p>
              </div>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                engineTier === 'advance'
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                  : engineTier === 'plus'
                    ? 'bg-sky-500/15 border-sky-500/40 text-sky-300'
                    : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              }`}
            >
              {engineTier === 'advance'
                ? isPersian
                  ? 'فوق‌پیشرفته ۵x • ۵ اعتبار'
                  : 'Advance 5x • 5 Credits'
                : engineTier === 'plus'
                  ? isPersian
                    ? 'پیشرفته ۲x • ۲ اعتبار'
                    : 'Plus 2x • 2 Credits'
                  : isPersian
                    ? 'معمولی • ۱ اعتبار'
                    : 'Normal • 1 Credit'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => setEngineTierState('normal')}
              className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between ${
                engineTier === 'normal'
                  ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-200 shadow-md shadow-emerald-950/30'
                  : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <span className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  {isPersian ? 'Normal (معمولی)' : 'Normal'}
                </span>
                {engineTier === 'normal' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed mb-2">
                {isPersian
                  ? 'پردازش استاندارد و روان روایت با سرعت بالا'
                  : 'Fast, reliable standard narrative generation'}
              </p>
              <div className="inline-block text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-zinc-800/80 text-emerald-300 border border-emerald-500/20 w-fit">
                {isPersian ? '۱ اعتبار در هر صحنه' : '1 Credit per scene'}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setEngineTierState('plus')}
              className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between ${
                engineTier === 'plus'
                  ? 'bg-sky-500/10 border-sky-500/50 text-sky-200 shadow-md shadow-sky-950/30'
                  : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <span className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-sky-400" />
                  {isPersian ? 'Plus (پیشرفته ۲x)' : 'Plus 2x'}
                </span>
                {engineTier === 'plus' && <Check className="w-3.5 h-3.5 text-sky-400" />}
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed mb-2">
                {isPersian
                  ? 'روایت غنی‌تر با جزئیات ادراکی و انتخاب‌های دراماتیک‌تر'
                  : 'Richer scene prose, sensory depth & tactical variety'}
              </p>
              <div className="inline-block text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-zinc-800/80 text-sky-300 border border-sky-500/20 w-fit">
                {isPersian ? '۲ اعتبار در هر صحنه (2x)' : '2 Credits per scene (2x)'}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setEngineTierState('advance')}
              className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between ${
                engineTier === 'advance'
                  ? 'bg-amber-500/10 border-amber-500/50 text-amber-200 shadow-md shadow-amber-950/30'
                  : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <span className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  {isPersian ? 'Advance (فوق‌پیشرفته)' : 'Advance'}
                </span>
                {engineTier === 'advance' && <Check className="w-3.5 h-3.5 text-amber-400" />}
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed mb-2">
                {isPersian
                  ? 'هوش مصنوعی عمیق با قدرت تحلیل تماتیک و استدلال روایی'
                  : 'Deep narrative reasoning and richer literary atmosphere'}
              </p>
              <div className="inline-block text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-zinc-800/80 text-amber-300 border border-amber-500/20 w-fit">
                {isPersian ? '۵ اعتبار در هر صحنه (5x)' : '5 Credits per scene (5x)'}
              </div>
            </button>
          </div>
        </div>

        {/* Story Update & Revamp Notice */}
        <div className="rounded-2xl border border-amber-500/30 bg-zinc-950/70 p-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-zinc-100">
                  {isPersian ? 'اعلان بازنویسی / به‌روزرسانی داستان' : 'Story Revamp / Update Notice'}
                </h4>
                <p className="text-[10px] text-zinc-400">
                  {isPersian
                    ? 'نمایش بنر اطلاع‌رسانی به بازیکنان در صورت بازنویسی پرده‌ها یا تغییرات ماجراجویی'
                    : 'Broadcast an update/revamp banner to active players when chapters are rewritten'}
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={updateNoticeEnabled}
                onChange={(e) => setUpdateNoticeEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          {updateNoticeEnabled && (
            <div className="space-y-3 pt-2 border-t border-zinc-800/80 animate-fadeIn">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                  {isPersian ? 'عنوان اعلان:' : 'Notice Title:'}
                </label>
                <input
                  type="text"
                  value={noticeTitle}
                  onChange={(e) => setNoticeTitle(e.target.value)}
                  placeholder={isPersian ? 'مثال: به‌روزرسانی پردهٔ اول داستان' : 'e.g. Act 1 Story Revamp'}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                  {isPersian ? 'متن پیام اعلان:' : 'Notice Message:'}
                </label>
                <textarea
                  value={noticeMessage}
                  onChange={(e) => setNoticeMessage(e.target.value)}
                  rows={3}
                  placeholder={
                    isPersian
                      ? 'توضیحات مربوط به تغییرات یا بازنویسی بخش‌های داستان...'
                      : 'Explanation of changes made to the story or instructions for the reader...'
                  }
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                    {isPersian ? 'عنوان دکمه اقدام (اختیاری):' : 'Action Button Label (Optional):'}
                  </label>
                  <input
                    type="text"
                    value={noticeActionLabel}
                    onChange={(e) => setNoticeActionLabel(e.target.value)}
                    placeholder={isPersian ? 'پیش‌فرض: بازنشانی و بازگشت اعتبار' : 'Default: Reset & Refund'}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="flex items-center gap-2 pt-4">
                  <input
                    type="checkbox"
                    id="noticeAllowRefund"
                    checked={noticeAllowRefund}
                    onChange={(e) => setNoticeAllowRefund(e.target.checked)}
                    className="rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  />
                  <label htmlFor="noticeAllowRefund" className="text-xs text-zinc-300 cursor-pointer select-none">
                    {isPersian ? 'امکان بازنشانی با استرداد اعتبار' : 'Allow Reset & Refund'}
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                  {isPersian ? 'شناسه صحنه‌های هدف (اختیاری، با کاما جدا کنید):' : 'Target Scene IDs (Optional, comma-separated):'}
                </label>
                <input
                  type="text"
                  value={noticeTargetScenes}
                  onChange={(e) => setNoticeTargetScenes(e.target.value)}
                  placeholder={isPersian ? 'خالی بگذارید تا برای تمام جلسات فعال نمایش داده شود' : 'Leave empty to display for all active playthroughs'}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                />
                <p className="text-[10px] text-zinc-500 mt-1">
                  {isPersian
                    ? 'اگر پرده یا صحنه‌ای خاص بازنویسی شده، می‌توانید شناسه آن صحنه‌ها را وارد کنید تا فقط بازیکنان همان صحنه‌ها اعلان را ببینند.'
                    : 'If only specific scenes were rewritten, enter their scene IDs so only players at those scenes see the banner.'}
                </p>
              </div>
            </div>
          )}
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
