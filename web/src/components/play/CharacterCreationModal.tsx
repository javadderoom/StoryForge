'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import { RealmTheme } from '@/lib/play/realmTheme';
import { audioService } from '@/lib/play/audioService';
import { toPersianDigits } from '@/lib/play/persianNumbers';
import { CharacterSetup } from '@/lib/play/api';

interface CharacterCreationModalProps {
  isOpen: boolean;
  story: any;
  isPersian?: boolean;
  theme: RealmTheme;
  onClose: () => void;
  onEmbark: (setup: CharacterSetup) => void;
}

const FALLBACK_ARCHETYPES = [
  { id: 'shadowblade', name: 'سایه‌تیغ', tagline: 'استاد نفوذ بی‌صدا، قفل‌گشایی و ضربات غافلگیرکننده', description: 'در سایه‌های قلعه زاده شده‌ای؛ گام‌هایت بی‌صداست.', iconName: 'colorize', statBonuses: { agility: 2, cunning: 1 } },
  { id: 'iron_vanguard', name: 'سرباز پولادین', tagline: 'مدافع سرسخت با شمشیر سنگین', description: 'آزموده در میدان‌های نبرد.', iconName: 'shield', statBonuses: { might: 3 } },
  { id: 'arcane_scholar', name: 'پژوهشگر کهن', tagline: 'کاشف طلسم‌های ممنوعه', description: 'سال‌ها در کتابخانه‌های ویران اسرار کفرآمیز آموخته‌ای.', iconName: 'auto_awesome', statBonuses: { arcana: 2, cunning: 1 } },
  { id: 'silver_diplomat', name: 'سفیر نقره‌زبان', tagline: 'استاد فریب و مذاکره', description: 'در هزارتوی سیاست قلعه، کلماتت برنده‌تر از هر شمشیری است.', iconName: 'record_voice_over', statBonuses: { cunning: 2, agility: 1 } },
];
const FALLBACK_BACKGROUNDS = [
  { id: 'citadel_outcast', name: 'رانده‌شده از قلعه', description: 'پیش‌تر خادم دژ بوده‌ای اما به سیاهچال افکنده شدی.', trait: 'شناخت گذرگاه‌های مخفی دژ', statBonuses: { agility: 1 } },
  { id: 'guild_infiltrator', name: 'نفوذی انجمن مخفی', description: 'مزدور کارکشته‌ای که به قلعه نفوذ کرده است.', trait: 'مهارت در باز کردن قفل‌ها', statBonuses: { cunning: 1 } },
  { id: 'noble_exile', name: 'اشراف‌زاده تبعیدی', description: 'وارث خاندانی اصیل و سرنگون‌شده.', trait: 'نفوذ کلامی بر نگهبانان', statBonuses: { might: 1 } },
  { id: 'temple_acolyte', name: 'نگهبان معبد کهن', description: 'شاگرد راهبان معبد خاموش.', trait: 'حس ششم در تشخیص دست‌سازه‌های طلسم‌شده', statBonuses: { arcana: 1 } },
];
const FALLBACK_STATS = [
  { id: 'might', name: 'قدرت بدنی', description: 'توان فیزیکی و مبارزه', baseValue: 12 },
  { id: 'agility', name: 'چابکی', description: 'سرعت واکنش و مخفی‌کاری', baseValue: 14 },
  { id: 'cunning', name: 'هوش و ذکاوت', description: 'دقت دیداری و قفل‌گشایی', baseValue: 10 },
  { id: 'arcana', name: 'دانش کهن', description: 'آشنایی با نمادهای باستانی', baseValue: 8 },
];

const TOTAL_FREE_POINTS = 4;

function getStatName(id: string, isPersian: boolean): string {
  const map: Record<string, string> = {
    might: 'قدرت', agility: 'چابکی', cunning: 'ذکاوت', arcana: 'دانش کهن', charm: 'جذابیت',
  };
  return isPersian ? map[id] ?? id : id.toUpperCase();
}

const STEPS = (isPersian: boolean) => [isPersian ? 'نقش' : 'Role', isPersian ? 'پیشینه' : 'Origin', isPersian ? 'ویژگی‌ها' : 'Stats', isPersian ? 'هویت' : 'Identity'];

export function CharacterCreationModal({ isOpen, story, isPersian = false, theme, onClose, onEmbark }: CharacterCreationModalProps) {
  const [step, setStep] = useState(0);
  const [archetypeId, setArchetypeId] = useState('');
  const [backgroundId, setBackgroundId] = useState('');
  const [name, setName] = useState('');
  const [points, setPoints] = useState<Record<string, number>>({});
  const [embarking, setEmbarking] = useState(false);

  const archetypes = (story?.archetypes?.length ? story.archetypes : FALLBACK_ARCHETYPES) as any[];
  const backgrounds = (story?.backgrounds?.length ? story.backgrounds : FALLBACK_BACKGROUNDS) as any[];
  const stats = (story?.stats?.length ? story.stats : FALLBACK_STATS) as any[];

  if (!isOpen) return null;

  const remaining = TOTAL_FREE_POINTS - Object.values(points).reduce((a, b) => a + b, 0);
  const arch = archetypes.find((a) => a.id === archetypeId) ?? archetypes[0];
  const bg = backgrounds.find((b) => b.id === backgroundId) ?? backgrounds[0];

  function totalStat(statId: string): number {
    const base = stats.find((s) => s.id === statId)?.baseValue ?? 10;
    const aBonus = arch?.statBonuses?.[statId] ?? 0;
    const bBonus = bg?.statBonuses?.[statId] ?? 0;
    return base + aBonus + bBonus + (points[statId] ?? 0);
  }
  function finalAllocated(): Record<string, number> {
    const r: Record<string, number> = {};
    for (const s of stats) r[s.id] = totalStat(s.id);
    return r;
  }

  function embark(quick = false) {
    if (embarking) return;
    setEmbarking(true);
    audioService.playSfx('pageTurn');
    onEmbark(
      quick
        ? { archetypeId, backgroundId }
        : { archetypeId, backgroundId, allocatedStats: finalAllocated(), characterName: name.trim() || undefined }
    );
  }

  const accent = theme.primaryAccent;

  return (
    <div className="fixed inset-0 z-[55] flex items-stretch justify-center bg-black/80 p-0 backdrop-blur-md sm:p-4">
      <div
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-none bg-[#0F111D] sm:rounded-3xl"
        style={{ border: `1px solid ${theme.cardBorder}` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: theme.cardBorder, backgroundColor: '#0F111D' }}>
          <div>
            <div className="text-sm font-bold" style={{ color: accent }}>
              {isPersian ? 'آفرینش قهرمان و پیشینه' : 'CHARACTER CREATION'}
            </div>
            <div className="text-[11px] text-zinc-400">{story?.title}</div>
          </div>
          <button onClick={() => { audioService.playSfx('buttonClick'); onClose(); }} className="rounded-lg p-1.5 text-zinc-400 hover:text-white">
            ✕
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex gap-2 px-5 py-3" style={{ backgroundColor: '#111322' }}>
          {STEPS(isPersian).map((label, i) => (
            <button
              key={i}
              onClick={() => { audioService.playSfx('buttonClick'); setStep(i); }}
              className="flex-1 text-left"
            >
              <div className="mb-1.5 flex items-center gap-1.5">
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold"
                  style={{
                    backgroundColor: i === step ? accent : i < step ? '#10B981' : '#27272A',
                    color: i <= step ? '#000' : '#fff',
                  }}
                >
                  {i < step ? '✓' : toPersianDigits(i + 1, isPersian)}
                </span>
                <span className="truncate text-[11px]" style={{ color: i === step ? accent : '#9CA3AF', fontWeight: i === step ? 700 : 400 }}>
                  {label}
                </span>
              </div>
              <div className="h-[3px] rounded" style={{ backgroundColor: i <= step ? accent : '#27272A' }} />
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {step === 0 && (
            <>
              <h3 className="mb-1 text-sm font-bold text-white">{isPersian ? '۱. تخصص و سبک مبارزه خود را انتخاب کنید' : '1. Choose Your Combat Archetype'}</h3>
              <p className="mb-3 text-[12px] text-zinc-400">{isPersian ? 'تخصص تجهیزات اولیه و پاداش‌های مهارتی را تعیین می‌کند.' : 'Your archetype determines starting gear and modifier bonuses.'}</p>
              {archetypes.map((a) => {
                const sel = a.id === archetypeId;
                return (
                  <button
                    key={a.id}
                    onClick={() => { audioService.playSfx('buttonClick'); setArchetypeId(a.id); }}
                    className="mb-3 w-full rounded-2xl border p-4 text-left transition-all"
                    style={{ backgroundColor: sel ? '#1B1926' : '#111322', borderColor: sel ? accent : theme.cardBorder, boxShadow: sel ? `0 0 16px -4px ${accent}` : 'none' }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold" style={{ color: sel ? accent : '#fff' }}>{a.name}</span>
                      <span style={{ color: sel ? accent : '#444' }}>{sel ? '●' : '○'}</span>
                    </div>
                    <p className="mt-1 text-[12px] text-zinc-400">{a.description}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {Object.entries(a.statBonuses ?? {}).map(([k, v]) => (
                        <span key={k} className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-300">
                          +{v as number} {getStatName(k, isPersian)}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </>
          )}

          {step === 1 && (
            <>
              <h3 className="mb-1 text-sm font-bold text-white">{isPersian ? '۲. تبار و پیشینه داستانی' : '2. Select Your Background Origin'}</h3>
              <p className="mb-3 text-[12px] text-zinc-400">{isPersian ? 'پیشینه سرنخ‌های منحصر‌به‌فردی به راوی می‌افزاید.' : 'Your background unlocks unique lore options for the AI director.'}</p>
              {backgrounds.map((b) => {
                const sel = b.id === backgroundId;
                return (
                  <button
                    key={b.id}
                    onClick={() => { audioService.playSfx('buttonClick'); setBackgroundId(b.id); }}
                    className="mb-3 w-full rounded-2xl border p-4 text-left"
                    style={{ backgroundColor: sel ? '#1B1926' : '#111322', borderColor: sel ? accent : theme.cardBorder }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold" style={{ color: sel ? accent : '#fff' }}>{b.name}</span>
                      <span style={{ color: sel ? accent : '#444' }}>{sel ? '●' : '○'}</span>
                    </div>
                    <p className="mt-1 text-[12px] text-zinc-400">{b.description}</p>
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-indigo-400/40 bg-indigo-500/15 px-2.5 py-1 text-[11px] font-bold text-indigo-300">
                      <span>✶</span> {isPersian ? 'ویژگی: ' : 'Trait: '}{b.trait}
                    </div>
                  </button>
                );
              })}
            </>
          )}

          {step === 2 && (
            <>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">{isPersian ? '۳. تخصیص ویژگی‌ها' : '3. Allocate Attribute Points'}</h3>
                <span className="rounded-xl border px-3 py-1 text-[12px] font-bold" style={{ color: remaining > 0 ? accent : '#10B981', borderColor: remaining > 0 ? accent : '#10B981' }}>
                  {isPersian ? `باقی‌مانده: ${toPersianDigits(remaining)}` : `Pool: ${remaining}`}
                </span>
              </div>
              {stats.map((s) => {
                const t = totalStat(s.id);
                const mod = Math.floor((t - 10) / 2);
                const alloc = points[s.id] ?? 0;
                return (
                  <div key={s.id} className="mb-3 rounded-2xl border p-3.5" style={{ backgroundColor: '#121422', borderColor: '#27272A' }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[13px] font-bold text-white">{getStatName(s.id, isPersian)}</div>
                        <div className="text-[10px] text-zinc-500">{s.description}</div>
                      </div>
                      <div className="flex items-center gap-2" dir="ltr">
                        <span className="rounded-lg px-2 py-0.5 text-[11px] font-bold" style={{ color: mod >= 0 ? '#10B981' : '#EF4444', backgroundColor: mod >= 0 ? '#10B98126' : '#EF444426' }}>
                          {mod >= 0 ? `+${mod}` : mod}
                        </span>
                        <span className="font-bold" style={{ color: accent, fontFamily: 'ui-monospace, monospace' }}>{t}</span>
                        <button
                          disabled={alloc <= 0}
                          onClick={() => { audioService.playSfx('buttonClick'); setPoints((p) => ({ ...p, [s.id]: Math.max(0, (p[s.id] ?? 0) - 1) })); }}
                          className="rounded-lg p-1 text-lg"
                          style={{ color: alloc > 0 ? accent : '#444' }}
                        >−</button>
                        <button
                          disabled={remaining <= 0}
                          onClick={() => { audioService.playSfx('buttonClick'); setPoints((p) => ({ ...p, [s.id]: (p[s.id] ?? 0) + 1 })); }}
                          className="rounded-lg p-1 text-lg"
                          style={{ color: remaining > 0 ? accent : '#444' }}
                        >+</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {step === 3 && (
            <>
              <h3 className="mb-3 text-sm font-bold text-white">{isPersian ? '۴. نام‌گذاری و آماده‌سازی' : '4. Finalize Identity & Embark'}</h3>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={isPersian ? 'نام قهرمان (اختیاری)' : 'Character Name (Optional)'}
                className="mb-3 w-full rounded-2xl border bg-[#121422] px-4 py-3 text-sm text-white outline-none focus:border-amber-500"
                style={{ borderColor: theme.cardBorder }}
              />
              <div className="rounded-2xl border p-4" style={{ backgroundColor: '#131524', borderColor: `${accent}4D` }}>
                <div className="flex items-center gap-2">
                  <span className="font-bold" style={{ color: accent }}>{arch?.name}</span>
                  <span className="text-zinc-400">• {bg?.name}</span>
                </div>
                <div className="my-2 border-t" style={{ borderColor: '#27272A' }} />
                <div className="text-[11px]" style={{ color: '#818CF8' }}>{isPersian ? 'ویژگی تبار: ' : 'Origin Trait: '}{bg?.trait}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {stats.map((s) => (
                    <span key={s.id} className="rounded-lg bg-[#1E2235] px-2 py-1 text-[11px] font-bold text-white">
                      {getStatName(s.id, isPersian)}: {totalStat(s.id)}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 border-t p-4" style={{ borderColor: theme.cardBorder, backgroundColor: '#0F111D' }}>
          {step > 0 && (
            <button
              onClick={() => { audioService.playSfx('buttonClick'); setStep((s) => s - 1); }}
              className="rounded-xl border px-4 py-3 text-[13px] text-zinc-300"
              style={{ borderColor: '#27272A' }}
            >
              {isPersian ? 'مرحله قبل' : 'Back'}
            </button>
          )}
          <button
            onClick={() => embark(step < 3)}
            disabled={embarking}
            className="flex-1 rounded-xl py-3 text-sm font-bold text-black transition-transform hover:scale-[1.01]"
            style={{ backgroundColor: accent }}
          >
            {embarking ? (isPersian ? 'در حال آغاز...' : 'Embarking...') : step === 3 ? (isPersian ? 'آغاز سرگذشت' : 'Embark on Chronicle') : isPersian ? 'آغاز سریع' : 'Quick Start'}
          </button>
        </div>
      </div>
    </div>
  );
}
