'use client';

import React from 'react';
import Link from 'next/link';
import {
  Compass,
  Map as MapIcon,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCcw,
  Sparkles,
  Save,
  CheckCircle2,
  ArrowLeft,
  ChevronDown,
  Globe,
  Palette,
  Grid,
  Route,
  Mountain,
  Users,
  Eye,
  SlidersHorizontal,
} from 'lucide-react';
import { WorldMapSettings, MapStyleTheme } from '@/lib/types';

export type CartographerTool =
  | 'select'
  | 'terrain_continent'
  | 'terrain_mountain'
  | 'terrain_river'
  | 'terrain_valley'
  | 'terrain_biome'
  | 'place_settlement'
  | 'draw_caravan'
  | 'place_npc'
  | 'place_creature'
  | 'place_relic'
  | 'place_deity'
  | 'place_timeline'
  | 'ruler';

interface CartographerHeaderProps {
  worldName: string;
  worldsList: Array<{ id: string; name: string }>;
  selectedWorldId: string;
  onSelectWorld: (id: string) => void;
  activeTool: CartographerTool;
  onSelectTool: (tool: CartographerTool) => void;
  settings: WorldMapSettings;
  onUpdateSettings: (settings: Partial<WorldMapSettings>) => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onFitView: () => void;
  isSyncing: boolean;
  hasUnsavedChanges: boolean;
  onSave: () => void;
  onOpenAiOracle: () => void;
  onToggleLayerPanel: () => void;
  isLayerPanelOpen: boolean;
  onTogglePalette: () => void;
  isPaletteOpen: boolean;
  isPersian: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

const THEME_OPTIONS: Array<{ id: MapStyleTheme; en: string; fa: string; icon: string }> = [
  { id: 'parchment', en: 'Antique Parchment', fa: 'طومار کهن', icon: '📜' },
  { id: 'topographic', en: 'Topographic Relief', fa: 'نقشه ناهمواری‌ها', icon: '🏔️' },
  { id: 'dark_fantasy', en: 'Dark Fantasy Sorcery', fa: 'فانتزی سیاه و تاریک', icon: '🔮' },
  { id: 'satellite', en: 'Orbital Planetary', fa: 'دید ماهواره‌ای مداری', icon: '🛰️' },
  { id: 'mystic_astral', en: 'Mystic Astral Realm', fa: 'قلمرو ستاره‌ای اثیری', icon: '✨' },
];

export const CartographerHeader: React.FC<CartographerHeaderProps> = ({
  worldName,
  worldsList,
  selectedWorldId,
  onSelectWorld,
  activeTool,
  onSelectTool,
  settings,
  onUpdateSettings,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetView,
  onFitView,
  isSyncing,
  hasUnsavedChanges,
  onSave,
  onOpenAiOracle,
  onToggleLayerPanel,
  isLayerPanelOpen,
  onTogglePalette,
  isPaletteOpen,
  isPersian,
  isFullscreen,
  onToggleFullscreen,
}) => {
  return (
    <header className="h-16 bg-zinc-950/90 border-b border-zinc-800/80 backdrop-blur-md px-4 flex items-center justify-between gap-3 select-none z-30 shrink-0">
      {/* Left: Branding & World Switcher */}
      <div className="flex items-center gap-3">
        <Link
          href="/studio/locations"
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-amber-300 hover:border-amber-500/40 transition-all text-xs font-medium"
          title={isPersian ? 'بازگشت به استودیو' : 'Return to Studio'}
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">{isPersian ? 'استودیو' : 'Studio'}</span>
        </Link>

        <div className="h-5 w-px bg-zinc-800 hidden sm:block" />

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-sm shadow-amber-500/10">
            <Compass className="w-4.5 h-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-zinc-100 tracking-wide">
                {isPersian ? 'نقشه‌نگار تعاملی جهان' : 'Interactive World Cartographer'}
              </h1>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded-md font-mono uppercase tracking-wider">
                Studio Atlas
              </span>
            </div>

            {/* World Switcher Dropdown */}
            {worldsList.length > 1 ? (
              <div className="relative inline-block mt-0.5">
                <select
                  value={selectedWorldId}
                  onChange={(e) => onSelectWorld(e.target.value)}
                  className="bg-transparent text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer pr-4 focus:outline-none appearance-none"
                >
                  {worldsList.map((w) => (
                    <option key={w.id} value={w.id} className="bg-zinc-900 text-zinc-200">
                      {w.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-zinc-500 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            ) : (
              <span className="text-xs text-zinc-400 truncate max-w-[180px] block mt-0.5 font-medium">
                {worldName || (isPersian ? 'جهان جاری' : 'Current World')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Center: Style Theme & Quick View Controls */}
      <div className="hidden lg:flex items-center gap-2 bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-1 shadow-inner">
        {/* Theme Picker */}
        <div className="flex items-center gap-1 px-2 border-r border-zinc-800">
          <Palette className="w-3.5 h-3.5 text-zinc-400" />
          <select
            value={settings.theme}
            onChange={(e) => onUpdateSettings({ theme: e.target.value as MapStyleTheme })}
            className="bg-transparent text-xs text-zinc-200 cursor-pointer focus:outline-none py-1"
          >
            {THEME_OPTIONS.map((th) => (
              <option key={th.id} value={th.id} className="bg-zinc-900 text-zinc-200">
                {th.icon} {isPersian ? th.fa : th.en}
              </option>
            ))}
          </select>
        </div>

        {/* Grid Type Selector */}
        <div className="flex items-center gap-1 px-2 border-r border-zinc-800">
          <Grid className="w-3.5 h-3.5 text-zinc-400" />
          <select
            value={settings.gridType}
            onChange={(e) => onUpdateSettings({ gridType: e.target.value as 'none' | 'square' | 'hex' })}
            className="bg-transparent text-xs text-zinc-200 cursor-pointer focus:outline-none py-1"
          >
            <option value="none" className="bg-zinc-900">{isPersian ? 'بدون شبکه' : 'No Grid'}</option>
            <option value="hex" className="bg-zinc-900">{isPersian ? 'شبکه شش‌ضلعی' : 'Hex Grid'}</option>
            <option value="square" className="bg-zinc-900">{isPersian ? 'شبکه چهارضلعی' : 'Square Grid'}</option>
          </select>
        </div>

        {/* Layer Manager Toggle */}
        <button
          onClick={onToggleLayerPanel}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium transition-colors ${
            isLayerPanelOpen
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
          }`}
          title={isPersian ? 'مدیریت لایه‌ها' : 'Layer Controls'}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{isPersian ? 'لایه‌ها' : 'Layers'}</span>
        </button>

        {/* Entity Palette Toggle */}
        <button
          onClick={onTogglePalette}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium transition-colors ${
            isPaletteOpen
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
          }`}
          title={isPersian ? 'موجودی موجودات و مکان‌های جهان' : 'World Bible Entities'}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>{isPersian ? 'موجودیت‌های جهان' : 'World Palette'}</span>
        </button>
      </div>

      {/* Right: AI Oracle, Zoom HUD, Save & Fullscreen */}
      <div className="flex items-center gap-2">
        {/* AI Cartographer Oracle */}
        <button
          onClick={onOpenAiOracle}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-violet-600/30 to-indigo-600/30 border border-violet-500/40 text-violet-200 hover:text-white hover:border-violet-400 transition-all text-xs font-medium shadow-md shadow-violet-950/40"
        >
          <Sparkles className="w-3.5 h-3.5 text-violet-400 animate-pulse" />
          <span className="hidden sm:inline">{isPersian ? 'پیشنهاد هوش مصنوعی' : 'AI Cartographer'}</span>
        </button>

        {/* Zoom Controls */}
        <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-0.5">
          <button
            onClick={onZoomOut}
            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
            title={isPersian ? 'کوچک‌نمایی' : 'Zoom Out'}
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-mono text-zinc-300 px-1.5 min-w-[42px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={onZoomIn}
            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
            title={isPersian ? 'بزرگ‌نمایی' : 'Zoom In'}
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onFitView}
            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors border-l border-zinc-800"
            title={isPersian ? 'نمای کامل نقشه' : 'Fit to Map'}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Save to Server Button */}
        <button
          onClick={onSave}
          disabled={isSyncing}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
            hasUnsavedChanges
              ? 'bg-amber-500 text-zinc-950 font-semibold hover:bg-amber-400 shadow-lg shadow-amber-500/20'
              : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {isSyncing ? (
            <div className="w-3.5 h-3.5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
          ) : hasUnsavedChanges ? (
            <Save className="w-3.5 h-3.5" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          )}
          <span className="hidden sm:inline">
            {isSyncing
              ? isPersian ? 'در حال ذخیره...' : 'Saving...'
              : hasUnsavedChanges
              ? isPersian ? 'ذخیره نقشه' : 'Save Changes'
              : isPersian ? 'همگام با سرور' : 'Saved'}
          </span>
        </button>

        {/* Fullscreen Toggle */}
        <button
          onClick={onToggleFullscreen}
          className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 border border-zinc-800 rounded-xl transition-colors"
          title={isPersian ? 'تمام صفحه' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
