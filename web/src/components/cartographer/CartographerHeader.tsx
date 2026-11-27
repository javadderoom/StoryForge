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
  Wand2,
  Undo2,
  Redo2,
  ListTree,
  Trash2,
  Stamp,
  RefreshCw,
  CloudDownload,
  Frame,
} from 'lucide-react';
import { WorldMapSettings, MapStyleTheme } from '@/lib/types';

export type CartographerTool =
  | 'select'
  | 'land_brush'
  | 'terrain_continent'
  | 'terrain_mountain'
  | 'terrain_highland'
  | 'terrain_river'
  | 'terrain_lake'
  | 'terrain_valley'
  | 'terrain_biome'
  | 'place_settlement'
  | 'draw_route'
  | 'draw_caravan'
  | 'place_npc'
  | 'place_creature'
  | 'place_relic'
  | 'place_deity'
  | 'place_timeline'
  | 'place_encounter'
  | 'place_quest'
  | 'place_faction'
  | 'ruler';

interface CartographerHeaderProps {
  worldName: string;
  worldsList: Array<{ id: string; name: string; storyCount?: number }>;
  selectedWorldId: string;
  onSelectWorld: (id: string) => void;
  /** Delete the currently selected world (cascades to its stories). */
  onDeleteWorld?: () => void | Promise<void>;
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
  onResetToServer?: () => void | Promise<void>;
  onOpenAiOracle: () => void;
  /** Plan 19: derive coordinates from lore/topology (auto-fit, undoable). */
  onAutoFit: () => Promise<void> | void;
  /** Populate unplaced WorldBible entities & encounters onto non-overlapping map pins. */
  onSyncEntities?: () => void;
  canUndoAutoFit: boolean;
  onUndoAutoFit: () => void;
  /** Undo/redo across every authoring action on the map (Ctrl+Z / Ctrl+Shift+Z). */
  canUndo: boolean;
  onUndo: () => void;
  canRedo: boolean;
  onRedo: () => void;
  /** Labels of the next undo/redo action, for the tooltips. */
  undoLabel?: string | null;
  redoLabel?: string | null;
  onToggleLayerPanel: () => void;
  isLayerPanelOpen: boolean;
  onToggleElementsPanel: () => void;
  isElementsPanelOpen: boolean;
  onTogglePalette: () => void;
  isPaletteOpen: boolean;
  onToggleAssetDrawer?: () => void;
  isAssetDrawerOpen?: boolean;
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
  onDeleteWorld,
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
  onResetToServer,
  onOpenAiOracle,
  onAutoFit,
  onSyncEntities,
  canUndoAutoFit,
  onUndoAutoFit,
  canUndo,
  onUndo,
  canRedo,
  onRedo,
  undoLabel,
  redoLabel,
  onToggleLayerPanel,
  isLayerPanelOpen,
  onToggleElementsPanel,
  isElementsPanelOpen,
  onTogglePalette,
  isPaletteOpen,
  onToggleAssetDrawer,
  isAssetDrawerOpen = false,
  isPersian,
  isFullscreen,
  onToggleFullscreen,
}) => {
  const duplicateWorldNames = new Set(
    worldsList
      .filter((world) =>
        worldsList.some((other) => other.id !== world.id && other.name === world.name)
      )
      .map((world) => world.name)
  );

  return (
    <header className="h-14 bg-zinc-950/92 border-b border-zinc-800/80 backdrop-blur-md px-2.5 flex items-center justify-between gap-2 select-none z-30 shrink-0 overflow-hidden">
      {/* Left: Branding & World Switcher */}
      <div className="flex items-center gap-2 min-w-0 shrink-0">
        <Link
          href="/studio/locations"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-amber-300 hover:border-amber-500/40 transition-all text-[11px] font-medium whitespace-nowrap shrink-0"
          title={isPersian ? 'بازگشت به استودیو' : 'Return to Studio'}
        >
          <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">{isPersian ? 'استودیو' : 'Studio'}</span>
        </Link>

        <div className="h-4 w-px bg-zinc-800 hidden sm:block shrink-0" />

        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Compass className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-xs font-bold text-zinc-100 tracking-wide whitespace-nowrap">
                {isPersian ? 'نقشه‌نگار جهان' : 'World Cartographer'}
              </h1>
              <span className="hidden 2xl:inline text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded-md font-mono uppercase tracking-wider whitespace-nowrap">
                Studio Atlas
              </span>
            </div>

            {worldsList.length > 0 ? (
              <div className="flex items-center gap-1">
                <div className="relative inline-block">
                  <select
                    value={selectedWorldId}
                    onChange={(e) => onSelectWorld(e.target.value)}
                    className="bg-transparent text-[11px] text-zinc-400 hover:text-zinc-200 cursor-pointer pr-3.5 focus:outline-none appearance-none max-w-[140px] xl:max-w-[175px] truncate"
                  >
                    {worldsList.map((w) => {
                      const isEmpty = w.storyCount === 0;
                      const isDuplicate = duplicateWorldNames.has(w.name);
                      const storyLabel =
                        typeof w.storyCount === 'number'
                          ? ` (${w.storyCount})`
                          : '';
                      const emptyLabel = isEmpty
                        ? isPersian
                          ? ' — خالی'
                          : ' — empty'
                        : '';
                      const idLabel = isDuplicate ? ` · #${w.id.slice(0, 6)}` : '';

                      return (
                        <option
                          key={w.id}
                          value={w.id}
                          disabled={isEmpty}
                          className="bg-zinc-900 text-zinc-200"
                        >
                          {w.name}{storyLabel}{emptyLabel}{idLabel}
                        </option>
                      );
                    })}
                  </select>
                  <ChevronDown className="w-3 h-3 text-zinc-500 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                {onDeleteWorld && (
                  <button
                    onClick={() => void onDeleteWorld()}
                    title={isPersian ? 'حذف جهان جاری و همه داستان‌هایش' : 'Delete current world and all its stories'}
                    className="p-0.5 rounded-md text-zinc-600 hover:text-rose-300 hover:bg-rose-500/10 transition-colors shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ) : (
              <span className="text-[11px] text-zinc-400 truncate max-w-[140px] block font-medium">
                {worldName || (isPersian ? 'جهان جاری' : 'Current World')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Center: Style Theme & Quick View Controls */}
      <div className="hidden lg:flex items-center gap-1 bg-zinc-900/80 border border-zinc-800/80 rounded-xl px-1.5 py-1 shadow-inner shrink-0">
        {/* Theme Picker */}
        <div className="flex items-center gap-1 px-1.5 border-r border-zinc-800">
          <Palette className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <select
            value={settings.theme}
            onChange={(e) => onUpdateSettings({ theme: e.target.value as MapStyleTheme })}
            className="bg-transparent text-[11px] text-zinc-200 cursor-pointer focus:outline-none py-0.5 max-w-[92px] truncate"
          >
            {THEME_OPTIONS.map((th) => (
              <option key={th.id} value={th.id} className="bg-zinc-900 text-zinc-200">
                {th.icon} {isPersian ? th.fa : th.en}
              </option>
            ))}
          </select>
        </div>

        {/* Grid Type Selector */}
        <div className="flex items-center gap-1 px-1.5 border-r border-zinc-800">
          <Grid className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <select
            value={settings.gridType}
            onChange={(e) => onUpdateSettings({ gridType: e.target.value as 'none' | 'square' | 'hex' })}
            className="bg-transparent text-[11px] text-zinc-200 cursor-pointer focus:outline-none py-0.5 max-w-[90px] truncate"
          >
            <option value="none" className="bg-zinc-900">{isPersian ? 'بی‌شبکه' : 'No Grid'}</option>
            <option value="hex" className="bg-zinc-900">{isPersian ? 'شش‌ضلعی' : 'Hex'}</option>
            <option value="square" className="bg-zinc-900">{isPersian ? 'چهارضلعی' : 'Square'}</option>
          </select>
        </div>

        {/* Layer Manager Toggle */}
        <button
          onClick={onToggleLayerPanel}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors ${
            isLayerPanelOpen
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
          }`}
          title={isPersian ? 'مدیریت لایه‌ها' : 'Layer Controls'}
        >
          <Layers className="w-3.5 h-3.5 shrink-0" />
          <span>{isPersian ? 'لایه‌ها' : 'Layers'}</span>
        </button>

        {/* Elements List Toggle */}
        <button
          onClick={onToggleElementsPanel}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors ${
            isElementsPanelOpen
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
          }`}
          title={isPersian ? 'فهرست المنت‌ها و اجزای نقشه' : 'Map Elements List'}
        >
          <ListTree className="w-3.5 h-3.5 shrink-0" />
          <span>{isPersian ? 'المنت‌ها' : 'Elements'}</span>
        </button>

        {/* Entity Palette Toggle */}
        <button
          onClick={onTogglePalette}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors ${
            isPaletteOpen
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
          }`}
          title={isPersian ? 'موجودی موجودیت‌های جهان (شخصیت، جانور، رویداد...)' : 'World Bible Entities'}
        >
          <Globe className="w-3.5 h-3.5 shrink-0" />
          <span>{isPersian ? 'پالت جهان' : 'Palette'}</span>
        </button>

        {/* Asset & Stamp Drawer Toggle */}
        {onToggleAssetDrawer && (
          <button
            onClick={onToggleAssetDrawer}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors ${
              isAssetDrawerOpen
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
            title={isPersian ? 'کتابخانه نمادها و استامپ‌ها' : 'Asset & Stamp Library'}
          >
            <Stamp className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden xl:inline">{isPersian ? 'نمادها' : 'Stamps'}</span>
          </button>
        )}
      </div>

      {/* Right: Sync, Auto-fit, AI Oracle, Zoom HUD, Save & Fullscreen */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Sync unplaced WorldBible entities & encounters onto map */}
        {onSyncEntities && (
          <button
            onClick={onSyncEntities}
            className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-200 hover:bg-amber-500/25 hover:text-white transition-all text-[11px] font-medium whitespace-nowrap"
            title={
              isPersian
                ? 'سنجاق‌کردن خودکار همه عناصر نامستقر جهان (شخصیت‌ها، جانوران، رویارویی‌ها، مأموریت‌ها و جناح‌ها) بدون تداخل'
                : 'Auto-pin all unplaced world entities, encounters, quests & factions without overlap'
            }
          >
            <RefreshCw className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="hidden xl:inline">{isPersian ? 'همگام‌سازی' : 'Sync'}</span>
          </button>
        )}

        {/* Plan 19: deterministic coordinate auto-fit + undo */}
        <button
          onClick={onAutoFit}
          className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600/30 to-teal-600/30 border border-emerald-500/40 text-emerald-200 hover:text-white hover:border-emerald-400 transition-all text-[11px] font-medium whitespace-nowrap"
          title={
            isPersian
              ? 'چیدمان خودکار: استخراج مختصات از گراف جهان (فقط نشان‌های قدیمی/ناقص)'
              : 'Auto-fit coordinates from lore & topology'
          }
        >
          <Wand2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="hidden 2xl:inline">{isPersian ? 'چیدمان' : 'Auto-fit'}</span>
        </button>
        {canUndoAutoFit && (
          <button
            onClick={onUndoAutoFit}
            className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-amber-300 hover:border-amber-500/40 transition-all text-[11px] whitespace-nowrap"
            title={isPersian ? 'بازگردانی مختصات قبلی' : 'Undo last auto-fit'}
          >
            <Undo2 className="w-3.5 h-3.5 shrink-0" />
          </button>
        )}

        {/* Undo / redo */}
        <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-0.5 shrink-0">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            title={
              canUndo && undoLabel
                ? isPersian
                  ? `بازگردانی: ${undoLabel}`
                  : `Undo: ${undoLabel}`
                : isPersian
                  ? 'چیزی برای بازگردانی نیست'
                  : 'Nothing to undo'
            }
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            title={
              canRedo && redoLabel
                ? isPersian
                  ? `تکرار: ${redoLabel}`
                  : `Redo: ${redoLabel}`
                : isPersian
                  ? 'چیزی برای تکرار نیست'
                  : 'Nothing to redo'
            }
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* AI Cartographer Oracle */}
        <button
          onClick={onOpenAiOracle}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-violet-600/30 to-indigo-600/30 border border-violet-500/40 text-violet-200 hover:text-white hover:border-violet-400 transition-all text-[11px] font-medium whitespace-nowrap"
          title={isPersian ? 'پیشنهاد هوش مصنوعی' : 'AI Cartographer'}
        >
          <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0" />
          <span className="hidden xl:inline">{isPersian ? 'هوش مصنوعی' : 'AI Oracle'}</span>
        </button>

        {/* Zoom Controls */}
        <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-0.5 shrink-0">
          <button
            onClick={onZoomOut}
            className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
            title={isPersian ? 'کوچک‌نمایی (Page Down)' : 'Zoom Out (Page Down)'}
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span dir="ltr" className="text-[10.5px] font-mono text-zinc-300 px-1 min-w-[36px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={onZoomIn}
            className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
            title={isPersian ? 'بزرگ‌نمایی (Page Up)' : 'Zoom In (Page Up)'}
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onFitView}
            className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors border-l border-zinc-800"
            title={isPersian ? 'نمای کامل نقشه' : 'Fit to Map'}
          >
            <Frame className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Reset stale browser draft back to Server DB */}
        {hasUnsavedChanges && onResetToServer && (
          <button
            onClick={() => void onResetToServer()}
            className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/35 text-rose-300 hover:bg-rose-500/25 hover:text-white transition-all text-[11px] font-medium whitespace-nowrap shrink-0"
            title={
              isPersian
                ? 'لغو پیش‌نویس محلی مرورگر و بارگذاری نسخهٔ تازهٔ سرور'
                : 'Discard local browser draft & reload from server'
            }
          >
            <CloudDownload className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">{isPersian ? 'از سرور' : 'Revert'}</span>
          </button>
        )}

        {/* Save to Server Button */}
        <button
          onClick={onSave}
          disabled={isSyncing}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-medium whitespace-nowrap transition-all shrink-0 ${
            hasUnsavedChanges
              ? 'bg-amber-500 text-zinc-950 font-semibold hover:bg-amber-400 shadow-lg shadow-amber-500/20'
              : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
          }`}
          title={
            hasUnsavedChanges
              ? isPersian
                ? 'تغییرات محلی ذخیره نشده — کلیک برای ذخیره در سرور'
                : 'Unsaved local draft — click to save to server'
              : isPersian
              ? 'همگام با سرور'
              : 'Synced with server'
          }
        >
          {isSyncing ? (
            <div className="w-3.5 h-3.5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin shrink-0" />
          ) : hasUnsavedChanges ? (
            <Save className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          )}
          <span className="hidden sm:inline">
            {isSyncing
              ? isPersian ? 'ذخیره...' : 'Saving...'
              : hasUnsavedChanges
              ? isPersian ? 'ذخیره' : 'Save'
              : isPersian ? 'ذخیره شد' : 'Saved'}
          </span>
        </button>

        {/* Fullscreen Toggle */}
        <button
          onClick={onToggleFullscreen}
          className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 border border-zinc-800 rounded-xl transition-colors shrink-0"
          title={isPersian ? 'تمام صفحه' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>
    </header>
  );
};
