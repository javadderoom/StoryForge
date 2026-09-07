export function getAffinityBadge(affinity: number, isPersian: boolean = false) {
  if (affinity >= 50) {
    return {
      label: isPersian ? 'وفاداری مطلق' : 'Sworn Devotion',
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    };
  }
  if (affinity > 0) {
    return {
      label: isPersian ? 'دوستانه' : 'Friendly',
      color: 'text-teal-300 bg-teal-500/10 border-teal-500/30',
    };
  }
  if (affinity === 0) {
    return {
      label: isPersian ? 'بی‌طرف' : 'Neutral',
      color: 'text-zinc-400 bg-zinc-700/20 border-zinc-600/30',
    };
  }
  if (affinity > -50) {
    return {
      label: isPersian ? 'تنش و بدگمانی' : 'Tense / Distrust',
      color: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    };
  }
  return {
    label: isPersian ? 'دشمنی خونی' : 'Bitter Blood Nemesis',
    color: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
  };
}

export function getCombatTierBadge(tier: string) {
  switch (tier) {
    case 'mythic':
      return 'text-amber-300 bg-gradient-to-r from-amber-500/20 to-red-500/20 border-amber-500/40';
    case 'boss':
      return 'text-rose-400 bg-rose-500/15 border-rose-500/30';
    case 'elite':
      return 'text-purple-300 bg-purple-500/15 border-purple-500/30';
    case 'veteran':
      return 'text-sky-300 bg-sky-500/15 border-sky-500/30';
    case 'apprentice':
      return 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30';
    default:
      return 'text-zinc-400 bg-zinc-800 border-zinc-700';
  }
}
