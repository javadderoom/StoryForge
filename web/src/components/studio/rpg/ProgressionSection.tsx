'use client';

import React, { useState } from 'react';
import {
  TrendingUp,
  Sparkles,
  Zap,
  Shield,
  Award,
  Sliders,
  RotateCcw,
  Check,
  Flame,
  Target,
  BookOpen,
} from 'lucide-react';
import { ProgressionConfig, DEFAULT_PROGRESSION_CONFIG } from '@/lib/types/rpg';
import { getXpThresholdForLevel } from '@/lib/engines/game/progressionEngine';
import { notify } from '@/lib/notify';

interface ProgressionSectionProps {
  story: any;
  isPersian: boolean;
  updateRpgSystem: (updater: (prev: any) => any) => void;
}

export function ProgressionSection({
  story,
  isPersian,
  updateRpgSystem,
}: ProgressionSectionProps) {
  const currentProgression: ProgressionConfig =
    story.rpgSystem?.progression ?? DEFAULT_PROGRESSION_CONFIG;

  const [config, setConfig] = useState<ProgressionConfig>(currentProgression);
  const [isSaved, setIsSaved] = useState(true);

  const handleChange = <K extends keyof ProgressionConfig>(
    key: K,
    val: ProgressionConfig[K]
  ) => {
    setConfig((prev) => ({ ...prev, [key]: val }));
    setIsSaved(false);
  };

  const handleActionXpChange = (key: keyof ProgressionConfig['actionXp'], val: number) => {
    setConfig((prev) => ({
      ...prev,
      actionXp: {
        ...prev.actionXp,
        [key]: val,
      },
    }));
    setIsSaved(false);
  };

  const handleMilestoneXpChange = (key: keyof ProgressionConfig['milestoneXp'], val: number) => {
    setConfig((prev) => ({
      ...prev,
      milestoneXp: {
        ...prev.milestoneXp,
        [key]: val,
      },
    }));
    setIsSaved(false);
  };

  const handleSave = () => {
    updateRpgSystem((prev: any) => ({
      ...prev,
      progression: config,
    }));
    setIsSaved(true);
    notify.success(
      isPersian
        ? 'تنظیمات سامانه پیشرفت و تراز با موفقیت ذخیره شد'
        : 'Progression & Leveling rules saved successfully'
    );
  };

  const handleResetDefaults = () => {
    setConfig(DEFAULT_PROGRESSION_CONFIG);
    updateRpgSystem((prev: any) => ({
      ...prev,
      progression: DEFAULT_PROGRESSION_CONFIG,
    }));
    setIsSaved(true);
    notify.info(
      isPersian
        ? 'تنظیمات پیشرفت به مقادیر پیشنهادی بازگردانده شد'
        : 'Progression reset to standard defaults'
    );
  };

  // Preview the first 5 level thresholds
  const previewThresholds = Array.from({ length: Math.min(5, config.maxLevel) }, (_, i) => {
    const lvl = i + 1;
    return {
      level: lvl,
      needed: getXpThresholdForLevel(lvl, config),
    };
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Banner Card */}
      <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-sm shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <TrendingUp className="w-6 h-6 text-amber-400" />
              <h2 className="text-xl md:text-2xl font-extrabold text-zinc-100">
                {isPersian
                  ? 'سامانه پیشرفت، تجربه و ارتقای تراز (XP & Level Up)'
                  : 'Progression, Experience & Level-Up Rules'}
              </h2>
            </div>
            <p className="text-xs text-zinc-400 max-w-2xl">
              {isPersian
                ? 'تنظیم منحنی کسب تجربه، پاداش اقدامات پرریسک و عطف‌های داستانی، میزان امتیازات صفات (Stat Points) در هر تراز، و آهنگ آزادسازی مهارت‌ها و طلسم‌ها.'
                : 'Configure the XP progression curve, risk/milestone rewards, attribute points awarded per level, and ability unlock cadence.'}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleResetDefaults}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-200 bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/50 transition-all cursor-pointer"
              title={isPersian ? 'بازنشانی به پیش‌فرض' : 'Reset to Defaults'}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isPersian ? 'پیش‌فرض' : 'Defaults'}</span>
            </button>

            <button
              onClick={handleSave}
              disabled={isSaved}
              className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-lg ${
                isSaved
                  ? 'bg-zinc-800 text-zinc-500 border border-zinc-700/30 cursor-default'
                  : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 shadow-amber-500/15'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>{isSaved ? (isPersian ? 'ذخیره شده' : 'Saved') : (isPersian ? 'ذخیره تغییرات' : 'Save Rules')}</span>
            </button>
          </div>
        </div>

        {/* Master Activation Toggle */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                config.enabled
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'bg-zinc-800/50 text-zinc-500 border border-zinc-700/30'
              }`}
            >
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-zinc-200">
                {isPersian ? 'فعال بودن سامانه تراز و تجربه' : 'Enable Leveling & Experience System'}
              </div>
              <div className="text-[11px] text-zinc-400">
                {isPersian
                  ? 'در صورت غیرفعال بودن، کاراکتر امتیاز تجربه دریافت نمی‌کند و تراز او ثابت می‌ماند.'
                  : 'When disabled, characters remain at Level 1 without XP accumulation.'}
              </div>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => handleChange('enabled', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
          </label>
        </div>
      </div>

      {config.enabled && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card 1: Core Curve & Leveling Cap */}
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 backdrop-blur-sm space-y-5">
            <div className="flex items-center gap-2 text-zinc-200 font-bold text-sm">
              <Sliders className="w-4 h-4 text-amber-400" />
              <span>{isPersian ? 'منحنی پیشرفت و سقف تراز' : 'Progression Curve & Level Cap'}</span>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1.5 font-medium">
                  {isPersian ? 'نوع منحنی رشد تجربه (Curve Type):' : 'Progression Curve Model:'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'standard', labelEn: 'Standard RPG', labelFa: 'استاندارد RPG' },
                    { id: 'fast', labelEn: 'Fast Story', labelFa: 'سریع / داستانی' },
                    { id: 'linear', labelEn: 'Linear (+100)', labelFa: 'خطی (+۱۰۰)' },
                  ].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleChange('curveType', c.id as any)}
                      className={`p-3 rounded-2xl border text-center font-bold transition-all cursor-pointer ${
                        config.curveType === c.id
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                          : 'bg-zinc-950/40 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                      }`}
                    >
                      {isPersian ? c.labelFa : c.labelEn}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-zinc-400 font-medium">
                    {isPersian ? 'حداکثر سقف تراز کاراکتر (Max Level):' : 'Maximum Character Level:'}
                  </label>
                  <span className="font-mono text-amber-400 font-bold">{config.maxLevel}</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={20}
                  value={config.maxLevel}
                  onChange={(e) => handleChange('maxLevel', parseInt(e.target.value, 10))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Thresholds Preview Pill Bar */}
              <div className="p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800 space-y-2">
                <div className="text-[11px] text-zinc-400 font-semibold flex items-center justify-between">
                  <span>{isPersian ? 'پیش‌نمایش آستانه ترازهای نخست:' : 'XP Thresholds (First Levels):'}</span>
                  <span className="text-[10px] text-amber-400/80">
                    {isPersian ? 'سطح بعد ← XP موردنیاز' : 'Level → Needed XP'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {previewThresholds.map((pt) => (
                    <span
                      key={pt.level}
                      className="px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-700/60 text-[11px] font-mono text-zinc-300 flex items-center gap-1"
                    >
                      <span className="text-amber-400 font-bold">L{pt.level}:</span>
                      <span>{pt.needed} XP</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Level-Up Rewards & Bonuses */}
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 backdrop-blur-sm space-y-5">
            <div className="flex items-center gap-2 text-zinc-200 font-bold text-sm">
              <Award className="w-4 h-4 text-emerald-400" />
              <span>{isPersian ? 'پاداش‌های ارتقای تراز (Level-Up Rewards)' : 'Level-Up Rewards & Cadence'}</span>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1.5 font-medium">
                  {isPersian
                    ? 'امتیاز ارتقای ویژگی در هر تراز (Stat Points per Level):'
                    : 'Attribute Points Granted per Level:'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((pts) => (
                    <button
                      key={pts}
                      type="button"
                      onClick={() => handleChange('statPointsPerLevel', pts)}
                      className={`p-2.5 rounded-2xl border text-center font-bold transition-all cursor-pointer ${
                        config.statPointsPerLevel === pts
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                          : 'bg-zinc-950/40 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      +{pts} {isPersian ? 'امتیاز' : 'Point(s)'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1.5 font-medium">
                  {isPersian
                    ? 'آهنگ انتخاب توانایی یا طلسم جدید (Ability Unlock Cadence):'
                    : 'Ability / Spell Unlock Cadence:'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'every_two_levels', labelEn: 'Every 2 Levels (2, 4, 6)', labelFa: 'هر ۲ تراز یک‌بار (۲، ۴، ۶)' },
                    { id: 'every_level', labelEn: 'Every Level (+1 each)', labelFa: 'در تمام ترازها (هر سطح)' },
                  ].map((cad) => (
                    <button
                      key={cad.id}
                      type="button"
                      onClick={() => handleChange('abilityUnlockCadence', cad.id as any)}
                      className={`p-2.5 rounded-2xl border text-center font-bold text-[11px] transition-all cursor-pointer ${
                        config.abilityUnlockCadence === cad.id
                          ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                          : 'bg-zinc-950/40 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {isPersian ? cad.labelFa : cad.labelEn}
                    </button>
                  ))}
                </div>
              </div>

              {/* Full Heal Surge Toggle */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800">
                <div className="space-y-0.5">
                  <div className="font-bold text-zinc-200">
                    {isPersian ? 'بازیابی کامل سلامت و روان با ارتقای سطح' : 'Heroic Surge (Full Heal on Level Up)'}
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    {isPersian
                      ? 'رسیدن به تراز جدید، سلامت و روان کاراکتر را به سقف ارتقایافته بازمی‌گرداند.'
                      : 'Restores HP/Resolve to new maximum upon reaching a level threshold.'}
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.healOnLevelUp}
                    onChange={(e) => handleChange('healOnLevelUp', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Card 3: Action & Risk XP Tuning */}
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 backdrop-blur-sm space-y-5">
            <div className="flex items-center gap-2 text-zinc-200 font-bold text-sm">
              <Flame className="w-4 h-4 text-orange-400" />
              <span>{isPersian ? 'پاداش تجربهٔ اقدامات و نبردها (Action XP)' : 'Action & Risk XP Rewards'}</span>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800 space-y-1.5">
                <label className="text-zinc-400 font-medium block">
                  {isPersian ? 'ریسک پایین:' : 'Low Risk:'}
                </label>
                <input
                  type="number"
                  min={0}
                  value={config.actionXp.lowRisk}
                  onChange={(e) => handleActionXpChange('lowRisk', parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-zinc-900 border border-zinc-700/60 rounded-xl px-2.5 py-1.5 font-mono text-zinc-200 font-bold"
                />
              </div>

              <div className="p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800 space-y-1.5">
                <label className="text-zinc-400 font-medium block">
                  {isPersian ? 'ریسک متوسط:' : 'Med Risk:'}
                </label>
                <input
                  type="number"
                  min={0}
                  value={config.actionXp.mediumRisk}
                  onChange={(e) => handleActionXpChange('mediumRisk', parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-zinc-900 border border-zinc-700/60 rounded-xl px-2.5 py-1.5 font-mono text-zinc-200 font-bold"
                />
              </div>

              <div className="p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800 space-y-1.5">
                <label className="text-zinc-400 font-medium block">
                  {isPersian ? 'ریسک بالا:' : 'High Risk:'}
                </label>
                <input
                  type="number"
                  min={0}
                  value={config.actionXp.highRisk}
                  onChange={(e) => handleActionXpChange('highRisk', parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-zinc-900 border border-zinc-700/60 rounded-xl px-2.5 py-1.5 font-mono text-zinc-200 font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800 space-y-1.5">
                <label className="text-zinc-400 font-medium block">
                  {isPersian ? 'پاداش تاس ۲۰ طبیعی (Nat 20):' : 'Natural 20 Crit Bonus:'}
                </label>
                <input
                  type="number"
                  min={0}
                  value={config.actionXp.criticalBonus}
                  onChange={(e) => handleActionXpChange('criticalBonus', parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-zinc-900 border border-zinc-700/60 rounded-xl px-2.5 py-1.5 font-mono text-zinc-200 font-bold"
                />
              </div>

              <div className="p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800 space-y-1.5">
                <label className="text-zinc-400 font-medium block">
                  {isPersian ? 'مهار موجود (به‌ازای هر ستاره خطر):' : 'Beast Per Danger Star:'}
                </label>
                <input
                  type="number"
                  min={0}
                  value={config.actionXp.creaturePerDangerLevel}
                  onChange={(e) => handleActionXpChange('creaturePerDangerLevel', parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-zinc-900 border border-zinc-700/60 rounded-xl px-2.5 py-1.5 font-mono text-zinc-200 font-bold"
                />
              </div>
            </div>
          </div>

          {/* Card 4: Milestone & Narrative XP Tuning */}
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 backdrop-blur-sm space-y-5">
            <div className="flex items-center gap-2 text-zinc-200 font-bold text-sm">
              <Target className="w-4 h-4 text-purple-400" />
              <span>{isPersian ? 'پاداش عطف‌های روایی و ماموریت‌ها (Milestone XP)' : 'Narrative & Milestone XP'}</span>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800 space-y-1.5">
                <label className="text-zinc-400 font-medium block">
                  {isPersian ? 'تکمیل ماموریت:' : 'Quest Complete:'}
                </label>
                <input
                  type="number"
                  min={0}
                  value={config.milestoneXp.questCompleted}
                  onChange={(e) => handleMilestoneXpChange('questCompleted', parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-zinc-900 border border-zinc-700/60 rounded-xl px-2.5 py-1.5 font-mono text-zinc-200 font-bold"
                />
              </div>

              <div className="p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800 space-y-1.5">
                <label className="text-zinc-400 font-medium block">
                  {isPersian ? 'عطف پایان فصل:' : 'Chapter Climax:'}
                </label>
                <input
                  type="number"
                  min={0}
                  value={config.milestoneXp.chapterCompleted}
                  onChange={(e) => handleMilestoneXpChange('chapterCompleted', parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-zinc-900 border border-zinc-700/60 rounded-xl px-2.5 py-1.5 font-mono text-zinc-200 font-bold"
                />
              </div>

              <div className="p-3 rounded-2xl bg-zinc-950/60 border border-zinc-800 space-y-1.5">
                <label className="text-zinc-400 font-medium block">
                  {isPersian ? 'کشف راز مهم:' : 'Lore Discovery:'}
                </label>
                <input
                  type="number"
                  min={0}
                  value={config.milestoneXp.discovery}
                  onChange={(e) => handleMilestoneXpChange('discovery', parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-zinc-900 border border-zinc-700/60 rounded-xl px-2.5 py-1.5 font-mono text-zinc-200 font-bold"
                />
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-purple-500/5 border border-purple-500/20 text-[11px] text-zinc-300 space-y-1">
              <div className="font-bold text-purple-400 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                <span>{isPersian ? 'یکپارچگی با موتور داستانی' : 'Narrative Engine Integration'}</span>
              </div>
              <p className="text-zinc-400 leading-relaxed">
                {isPersian
                  ? 'هنگامی که بازیکن اهداف داستانی و مراحل ماموریت را با موفقیت پشت سر می‌گذارد، این امتیازات به شکل خودکار و بدون نیاز به فرمول‌های پیچیده اعمال می‌شوند.'
                  : 'Milestone XP is automatically awarded when quest stages conclude or when chapter climaxes resolve in the living world ledger.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
