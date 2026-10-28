import React from 'react';
import {
  Globe,
  Layers,
  Mountain,
  Waves,
  Split,
  Trees,
  Castle,
  Route,
  Flame,
} from 'lucide-react';
import {
  WorldLocation,
  WorldTradeRoute,
  MapRoute,
  MapTerrainFeature,
  MapEntityPlacement,
} from '@/lib/types';

export type ElementCategoryKey =
  | 'landmass'
  | 'highland'
  | 'mountain'
  | 'water'
  | 'valley'
  | 'biome'
  | 'settlement'
  | 'road'
  | 'route'
  | 'pin';

export interface CategoryDefinition {
  key: ElementCategoryKey;
  label: { en: string; fa: string };
  emptyMessage: { en: string; fa: string };
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

export const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  {
    key: 'landmass',
    label: { en: 'Landmasses & Islands', fa: 'قاره‌ها و جزایر' },
    emptyMessage: { en: 'No landmasses drawn yet', fa: 'هنوز خشکی رسم نشده است' },
    icon: Globe,
    color: 'text-amber-400',
  },
  {
    key: 'highland',
    label: { en: 'Highlands & Plateaus', fa: 'فلات‌ها و زمین‌های مرتفع' },
    emptyMessage: { en: 'No highlands or plateaus drawn', fa: 'هنوز فلات یا بلندی رسم نشده است' },
    icon: Layers,
    color: 'text-stone-300',
  },
  {
    key: 'mountain',
    label: { en: 'Mountains & Peaks', fa: 'رشته‌کوه‌ها و قله‌ها' },
    emptyMessage: { en: 'No mountains or peaks placed', fa: 'هنوز کوهستانی افزوده نشده است' },
    icon: Mountain,
    color: 'text-orange-400',
  },
  {
    key: 'water',
    label: { en: 'Rivers, Lakes & Waters', fa: 'رودخانه‌ها، دریاچه‌ها و آب‌ها' },
    emptyMessage: { en: 'No rivers or lakes drawn', fa: 'هنوز رود یا دریاچه‌ای رسم نشده است' },
    icon: Waves,
    color: 'text-cyan-400',
  },
  {
    key: 'valley',
    label: { en: 'Valleys & Chasms', fa: 'دره‌ها و شکاف‌ها' },
    emptyMessage: { en: 'No valleys or canyons drawn', fa: 'هنوز دره یا شکافی رسم نشده است' },
    icon: Split,
    color: 'text-zinc-400',
  },
  {
    key: 'biome',
    label: { en: 'Biomes & Vegetation', fa: 'اقلیم‌ها و پوشش گیاهی' },
    emptyMessage: { en: 'No biomes (forests, deserts) painted', fa: 'هنوز اقلیم یا جنگلی رنگ‌آمیزی نشده است' },
    icon: Trees,
    color: 'text-emerald-400',
  },
  {
    key: 'settlement',
    label: { en: 'Settlements & Sites', fa: 'شهرها، دژها و مکان‌ها' },
    emptyMessage: { en: 'No locations placed on map', fa: 'هیچ مکانی روی نقشه قرار نگرفته است' },
    icon: Castle,
    color: 'text-amber-300',
  },
  {
    key: 'road',
    label: { en: 'Roads & Paths', fa: 'جاده‌ها و راه‌ها' },
    emptyMessage: { en: 'No roads drawn yet', fa: 'هنوز جاده‌ای رسم نشده است' },
    icon: Route,
    color: 'text-amber-300',
  },
  {
    key: 'route',
    label: { en: 'Trade Corridors', fa: 'مسیرهای تجاری کاروان' },
    emptyMessage: { en: 'No trade corridors linked', fa: 'هیچ مسیر تجاری متصل نشده است' },
    icon: Route,
    color: 'text-orange-400',
  },
  {
    key: 'pin',
    label: { en: 'Beasts, NPCs & Lore Pins', fa: 'هیولاها، شخصیت‌ها و نشان‌ها' },
    emptyMessage: { en: 'No beasts, NPCs or lore pins placed', fa: 'هیچ هیولا، شخصیت یا نشانی مستقر نشده است' },
    icon: Flame,
    color: 'text-rose-400',
  },
];

export type ItemWrapper =
  | {
      kind: 'terrain';
      id: string;
      name: string;
      subtitle: string;
      visible: boolean;
      locked: boolean;
      raw: MapTerrainFeature;
    }
  | {
      kind: 'location';
      id: string;
      name: string;
      subtitle: string;
      visible: boolean;
      locked: boolean;
      raw: WorldLocation;
    }
  | {
      kind: 'route';
      id: string;
      name: string;
      subtitle: string;
      visible: boolean;
      locked: boolean;
      raw: WorldTradeRoute;
    }
  | {
      kind: 'road';
      id: string;
      name: string;
      subtitle: string;
      visible: boolean;
      locked: boolean;
      raw: MapRoute;
    }
  | {
      kind: 'placement';
      id: string;
      name: string;
      subtitle: string;
      visible: boolean;
      locked: boolean;
      raw: MapEntityPlacement;
    };
