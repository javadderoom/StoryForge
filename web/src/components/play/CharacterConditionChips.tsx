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
};

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
        const meta = CONDITION_REGISTRY[condKey];
        const IconComponent = meta?.icon || Activity;
        const label = meta ? (isRtl ? meta.labelFa : meta.labelEn) : condKey;
        const tooltip = meta ? (isRtl ? meta.tooltipFa : meta.tooltipEn) : condKey;
        const colorClasses =
          meta?.classes ||
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
