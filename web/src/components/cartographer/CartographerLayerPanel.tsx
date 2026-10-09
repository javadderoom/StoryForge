'use client';

import React from 'react';
import {
  Layers,
  X,
  Eye,
  EyeOff,
  Globe,
  Waves,
  Mountain,
  Split,
  Trees,
  Castle,
  Route,
  User,
  Skull,
  Sparkles,
  Sun,
  History,
  Grid,
  Tag,
} from 'lucide-react';
import { WorldMapSettings } from '@/lib/types';

interface CartographerLayerPanelProps {
  settings: WorldMapSettings;
  onUpdateSettings: (settings: Partial<WorldMapSettings>) => void;
  onClose: () => void;
  isPersian: boolean;
}

export const CartographerLayerPanel: React.FC<CartographerLayerPanelProps> = ({
  settings,
  onUpdateSettings,
  onClose,
  isPersian,
}) => {
  const layers = [
    {
      key: 'terrain' as const,
      label: { en: 'Continents & Landmasses', fa: 'قاره‌ها و خشکی‌ها' },
      icon: Globe,
      color: 'text-amber-400',
    },
    {
      key: 'water' as const,
      label: { en: 'Lakes, Rivers & Waters', fa: 'دریاچه‌ها، رودها و آب‌ها' },
      icon: Waves,
      color: 'text-cyan-400',
    },
    {
      key: 'mountains' as const,
      label: { en: 'Mountains & Summits', fa: 'رشته‌کوه‌ها و قله‌ها' },
      icon: Mountain,
      color: 'text-orange-400',
    },
    {
      key: 'valleys' as const,
      label: { en: 'Canyons & Rift Valleys', fa: 'دره‌ها و شکاف‌های عمیق' },
      icon: Split,
      color: 'text-stone-400',
    },
    {
      key: 'biomes' as const,
      label: { en: 'Biomes (Forests, Deserts)', fa: 'اقلیم‌ها (جنگل، کویر)' },
      icon: Trees,
      color: 'text-emerald-400',
    },
    {
      key: 'settlements' as const,
      label: { en: 'Settlements & Citadels', fa: 'شهرها، دژها و قرارگاه‌ها' },
      icon: Castle,
      color: 'text-amber-400',
    },
    {
      key: 'caravanRoutes' as const,
      label: { en: 'Caravan Corridors & Roads', fa: 'مسیر کاروان‌ها و شاهراه‌ها' },
      icon: Route,
      color: 'text-orange-400',
    },
    {
      key: 'npcs' as const,
      label: { en: 'Stationed NPCs', fa: 'شخصیت‌های مستقر (NPC)' },
      icon: User,
      color: 'text-indigo-400',
    },
    {
      key: 'bestiary' as const,
      label: { en: 'Monster Lairs & Fauna', fa: 'آشیانه هیولاها و جانورنامه' },
      icon: Skull,
      color: 'text-rose-400',
    },
    {
      key: 'relics' as const,
      label: { en: 'Mythic Relics & Vaults', fa: 'عتیقه‌ها و خزانه‌های باستانی' },
      icon: Sparkles,
      color: 'text-purple-400',
    },
    {
      key: 'deities' as const,
      label: { en: 'Temples & Holy Sites', fa: 'معابد و جایگاه ایزدان' },
      icon: Sun,
      color: 'text-yellow-400',
    },
    {
      key: 'timeline' as const,
      label: { en: 'Historic Battlefields', fa: 'رویدادها و نبردهای تاریخی' },
      icon: History,
      color: 'text-red-400',
    },
    {
      key: 'labels' as const,
      label: { en: 'Geographic Place Names', fa: 'نام‌های جغرافیایی' },
      icon: Tag,
      color: 'text-zinc-300',
    },
    {
      key: 'grid' as const,
      label: { en: 'Coordinate Grid', fa: 'شبکه مختصات کارتوگرافی' },
      icon: Grid,
      color: 'text-zinc-400',
    },
  ];

  const toggleLayer = (key: keyof WorldMapSettings['visibleLayers']) => {
    onUpdateSettings({
      visibleLayers: {
        ...settings.visibleLayers,
        [key]: !settings.visibleLayers[key],
      },
    });
  };

  const setAllLayers = (visible: boolean) => {
    const updated: any = {};
    layers.forEach((l) => {
      updated[l.key] = visible;
    });
    onUpdateSettings({
      visibleLayers: updated,
    });
  };

  return (
    <div className="absolute right-4 top-20 z-20 w-80 bg-zinc-950/90 backdrop-blur-md border border-zinc-800/80 rounded-3xl p-4 shadow-2xl flex flex-col gap-3.5 select-none animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
        <div className="flex items-center gap-2 text-zinc-100 font-semibold text-sm">
          <Layers className="w-4 h-4 text-amber-400" />
          <span>{isPersian ? 'لایه‌های نقشه‌نگار' : 'Map Layers'}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAllLayers(true)}
            className="text-[10px] text-zinc-400 hover:text-amber-300 font-medium transition-colors"
          >
            {isPersian ? 'همه روشن' : 'All On'}
          </button>
          <span className="text-zinc-600 text-xs">|</span>
          <button
            onClick={() => setAllLayers(false)}
            className="text-[10px] text-zinc-400 hover:text-amber-300 font-medium transition-colors"
          >
            {isPersian ? 'همه خاموش' : 'All Off'}
          </button>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-zinc-800 transition-colors ml-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Layer Toggles */}
      <div className="space-y-1 max-h-[360px] overflow-y-auto scrollbar-thin pr-1">
        {layers.map((l) => {
          const Icon = l.icon;
          const isVisible = settings.visibleLayers[l.key] ?? true;

          return (
            <button
              key={l.key}
              onClick={() => toggleLayer(l.key)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                isVisible
                  ? 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200'
                  : 'bg-zinc-950/40 text-zinc-500 hover:bg-zinc-900/40 opacity-60'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Icon className={`w-3.5 h-3.5 ${isVisible ? l.color : 'text-zinc-600'}`} />
                <span className="truncate">{isPersian ? l.label.fa : l.label.en}</span>
              </div>
              <div className="shrink-0 text-zinc-400 ml-2">
                {isVisible ? (
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5 text-zinc-600" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Grid Settings */}
      <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
        <span>{isPersian ? 'اندازه خانه‌های شبکه' : 'Grid Cell Size'}:</span>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={30}
            max={100}
            step={5}
            value={settings.gridSize}
            onChange={(e) => onUpdateSettings({ gridSize: Number(e.target.value) })}
            className="w-24 accent-amber-500 cursor-pointer"
          />
          <span className="font-mono text-zinc-300 text-[11px] w-8 text-right">
            {settings.gridSize}px
          </span>
        </div>
      </div>
    </div>
  );
};
