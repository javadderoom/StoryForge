import { Genre } from '@/lib/types';

export const GENRE_LABELS: Record<Genre, { en: string; fa: string; color: string }> = {
  dark_fantasy: { en: 'Dark Fantasy', fa: 'فانتزی تاریک', color: 'bg-purple-500/15 text-purple-300 border-purple-500/25' },
  sci_fi: { en: 'Sci-Fi', fa: 'علمی-تخیلی', color: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25' },
  cyberpunk: { en: 'Cyberpunk', fa: 'سایبرپانک', color: 'bg-pink-500/15 text-pink-300 border-pink-500/25' },
  mystery_noir: { en: 'Mystery Noir', fa: 'معمایی-نوآر', color: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/25' },
  horror: { en: 'Horror', fa: 'وحشت', color: 'bg-red-500/15 text-red-300 border-red-500/25' },
  historical: { en: 'Historical', fa: 'تاریخی', color: 'bg-amber-500/15 text-amber-300 border-amber-500/25' },
  folklore: { en: 'Folklore', fa: 'اسطوره‌ای', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' },
  romance: { en: 'Romance', fa: 'عاشقانه', color: 'bg-rose-500/15 text-rose-300 border-rose-500/25' },
  post_apocalyptic: { en: 'Post-Apocalyptic', fa: 'پسا-آخرالزمانی', color: 'bg-orange-500/15 text-orange-300 border-orange-500/25' },
};

export const GENRE_PRESETS = Object.keys(GENRE_LABELS) as Genre[];
