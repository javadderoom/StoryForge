'use client';

import React from 'react';
import {
  Droplets,
  Wind,
  HeartCrack,
  Compass,
  Eye,
  HelpCircle,
  Skull,
  AlertCircle,
  Activity,
  Bandage,
  Flame,
  Zap,
  HeartPulse,
  LucideIcon,
} from 'lucide-react';

interface ConditionMeta {
  labelFa: string;
  labelEn: string;
  icon: LucideIcon;
  classes: string;
  tooltipFa: string;
  tooltipEn: string;
}

const CONDITION_REGISTRY: Record<string, ConditionMeta> = {
  تشنه: {
    labelFa: 'تشنه',
    labelEn: 'Thirsty',
    icon: Droplets,
    classes: 'border-sky-500/50 bg-sky-950/50 text-sky-200 shadow-[0_0_10px_rgba(14,165,233,0.25)]',
    tooltipFa: 'کمبود آب و خشکی گلو؛ ادامهٔ تشنگی توان بدنی را تحلیل می‌برد.',
    tooltipEn: 'Dehydration; continuous lack of water drains physical stamina.',
  },
  خسته: {
    labelFa: 'خسته',
    labelEn: 'Exhausted',
    icon: Wind,
    classes: 'border-amber-500/50 bg-amber-950/50 text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.25)]',
    tooltipFa: 'فرسودگی ناشی از راهپیمایی طولانی یا نبرد مداوم؛ واکنش‌ها کندتر شده‌اند.',
    tooltipEn: 'Fatigue from prolonged march or combat; reactions are sluggish.',
  },
  زخمی: {
    labelFa: 'زخمی',
    labelEn: 'Wounded',
    icon: HeartCrack,
    classes: 'border-rose-500/60 bg-rose-950/60 text-rose-200 shadow-[0_0_12px_rgba(244,63,94,0.3)] animate-pulse',
    tooltipFa: 'جراحت عمیق بر تن؛ نیازمند پانسمان یا مداوا پیش از درگیری مجدد.',
    tooltipEn: 'Severe physical wound; requires bandaging or medical care.',
  },
  ناآشنا: {
    labelFa: 'ناآشنا',
    labelEn: 'Outsider',
    icon: Compass,
    classes: 'border-indigo-500/50 bg-indigo-950/50 text-indigo-200 shadow-[0_0_10px_rgba(99,102,241,0.2)]',
    tooltipFa: 'غریبه در اقلیم؛ آداب و کوره‌راه‌های این دیار هنوز برایت مبهم است.',
    tooltipEn: 'Stranger to this territory; local customs and hidden paths are unfamiliar.',
  },
  هوشیار: {
    labelFa: 'هوشیار',
    labelEn: 'Vigilant',
    icon: Eye,
    classes: 'border-emerald-500/50 bg-emerald-950/50 text-emerald-200 shadow-[0_0_10px_rgba(16,185,129,0.25)]',
    tooltipFa: 'حواس جمع و گوش‌به‌زنگ؛ کمین‌ها و نشانه‌های خطر را زودتر درمی‌یابی.',
    tooltipEn: 'High alertness; notices ambushes and environmental clues earlier.',
  },
  گیج: {
    labelFa: 'گیج',
    labelEn: 'Dazed',
    icon: HelpCircle,
    classes: 'border-fuchsia-500/50 bg-fuchsia-950/50 text-fuchsia-200 shadow-[0_0_10px_rgba(217,70,239,0.25)]',
    tooltipFa: 'حیرت و سرگیجه ناشی از ضربه یا شوک؛ تمرکز کاهش یافته است.',
    tooltipEn: 'Mental disorientation from shock or trauma; focus is impaired.',
  },
  مسموم: {
    labelFa: 'مسموم',
    labelEn: 'Poisoned',
    icon: Skull,
    classes: 'border-lime-500/60 bg-lime-950/60 text-lime-200 shadow-[0_0_12px_rgba(132,204,22,0.3)] animate-pulse',
    tooltipFa: 'زهر در رگ‌ها می‌گردد؛ با هر تلاش بدنی سوزش و آسیب افزایش می‌یابد.',
    tooltipEn: 'Toxin running through bloodstream; physical exertion incurs damage.',
  },
  مظنون: {
    labelFa: 'مظنون',
    labelEn: 'Suspected',
    icon: AlertCircle,
    classes: 'border-yellow-500/50 bg-yellow-950/50 text-yellow-200 shadow-[0_0_10px_rgba(234,179,8,0.25)]',
    tooltipFa: 'زیر ذره‌بین گزمه‌ها و مأموران تفتیش؛ هر حرکت مشکوک عواقب دارد.',
    tooltipEn: 'Under watch by inquisitors or guards; suspicious acts draw scrutiny.',
  },
  // Plan 17: canonical tags that the reconciler can now write must render
  // with the same styling language as the rest of the registry.
  خونریزی: {
    labelFa: 'خونریزی',
    labelEn: 'Bleeding',
    icon: HeartPulse,
    classes: 'border-red-500/60 bg-red-950/60 text-red-200 shadow-[0_0_12px_rgba(239,68,68,0.3)] animate-pulse',
    tooltipFa: 'خون‌ریزی فعال؛ تا پانسمان یا مداوا بند نمی‌آید.',
    tooltipEn: 'Active blood loss; does not stop until treated.',
  },
  تندرست: {
    labelFa: 'تندرست',
    labelEn: 'Unencumbered',
    icon: Activity,
    classes: 'border-emerald-500/50 bg-emerald-950/50 text-emerald-200 shadow-[0_0_10px_rgba(16,185,129,0.25)]',
    tooltipFa: 'تن سالم و توانمند؛ هیچ جراحت یا فرسودگی بازدارنده‌ای نیست.',
    tooltipEn: 'Body in prime condition; no encumbrance from injury or fatigue.',
  },
  مصمم: {
    labelFa: 'مصمم',
    labelEn: 'Resolute',
    icon: Flame,
    classes: 'border-orange-500/50 bg-orange-950/50 text-orange-200 shadow-[0_0_10px_rgba(249,115,22,0.25)]',
    tooltipFa: 'ارادهٔ پولادین؛ درد و ترس مهار شده‌اند، نه آنکه نباشند.',
    tooltipEn: 'Steely resolve; pain and fear are mastered, not absent.',
  },
  شوک‌زده: {
    labelFa: 'شوک‌زده',
    labelEn: 'Shaken',
    icon: Zap,
    classes: 'border-purple-500/50 bg-purple-950/50 text-purple-200 shadow-[0_0_10px_rgba(168,85,247,0.25)]',
    tooltipFa: 'شوک روانی؛ دست‌ها می‌لرزند و وحشت تازه پشت پلک‌ها تکرار می‌شود.',
    tooltipEn: 'Mental shock; hands shake, the recent horror replays behind the eyes.',
  },
};

/**
 * Plan 17: treated wounds/poisons carry a suffix marker and render as a muted,
 * non-pulsing bandage chip instead of the alarming untreated styling.
 */
const TREATED_SUFFIX = /\s*\((پانسمان‌شده|درمان‌شده|پادزهرخورده)\)\s*$/;

const TREATED_CLASSES =
  'border-rose-400/40 bg-rose-950/30 text-rose-100/90 shadow-[0_0_8px_rgba(251,113,133,0.15)]';

export function CharacterConditionChips({
  conditions,
  isRtl,
}: {
  conditions: string[];
  isRtl: boolean;
}) {
  if (!conditions || conditions.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 pt-1"
      aria-label={isRtl ? 'وضعیت‌های فعلی کاراکتر' : 'Active Character Conditions'}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400/80 mr-1">
        {isRtl ? 'وضعیت:' : 'Status:'}
      </span>
      {conditions.map((rawCondition) => {
        const condKey = rawCondition.trim();
        // Plan 17: parse the treated suffix — the chip shows the base
        // condition with bandage styling and an honest tooltip.
        const treatedMatch = condKey.match(TREATED_SUFFIX);
        const baseKey = treatedMatch ? condKey.replace(TREATED_SUFFIX, '').trim() : condKey;
        const baseMeta = CONDITION_REGISTRY[baseKey];
        const isTreated = !!treatedMatch && !!baseMeta;
        const meta = isTreated ? undefined : baseMeta;
        const IconComponent = isTreated ? Bandage : meta?.icon || Activity;
        const label = isTreated
          ? isRtl
            ? `${baseMeta!.labelFa} — پانسمان‌شده`
            : `${baseMeta!.labelEn} (Treated)`
          : meta
            ? isRtl
              ? meta.labelFa
              : meta.labelEn
            : condKey;
        const tooltip = isTreated
          ? isRtl
            ? `${baseMeta!.tooltipFa} (پانسمان‌شده؛ فشار سنگین هنوز می‌سوزاند.)`
            : `${baseMeta!.tooltipEn} (Bandaged; hard exertion still aches.)`
          : meta
            ? isRtl
              ? meta.tooltipFa
              : meta.tooltipEn
            : condKey;
        const colorClasses = isTreated
          ? TREATED_CLASSES
          : meta?.classes ||
            'border-zinc-700/60 bg-zinc-900/70 text-zinc-300 shadow-[0_0_8px_rgba(161,161,170,0.15)]';

        return (
          <div
            key={condKey}
            title={tooltip}
            className={`group relative inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium backdrop-blur-md transition-all hover:scale-105 select-none ${colorClasses}`}
          >
            <IconComponent className="h-3 w-3 shrink-0" />
            <span>{label}</span>
          </div>
        );
      })}
    </div>
  );
}
