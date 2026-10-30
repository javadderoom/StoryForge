'use client';

import { useCallback, useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import type { MapPoint, MapTerrainFeature } from '@/lib/types';
import type { MapObjectRef } from '@/lib/engines/world/mapSelection';
import { VINTAGE_PARCHMENT } from '@/lib/engines/world/pixi/vintageTheme';
import type { CartographerTool } from '../CartographerHeader';
import type { BiomeType, HighlandMode } from './GeoToolHud';
import { resolveDefaultFamilyForTerrain } from '@/lib/engines/world/pixi/symbolPalette';
import { generateScatterInstances } from '@/lib/engines/world/pixi/symbolScatterRenderer';

interface UseMapDraftingOptions {
  activeTool: CartographerTool;
  isPersian: boolean;
  onAddTerrain: (feature: MapTerrainFeature) => void;
  onSelectionChange: (refs: MapObjectRef[]) => void;
  onCancelZoom: () => void;
  activeBiome?: BiomeType;
  highlandMode?: HighlandMode;
  cliffHeight?: number;
  terraceTiers?: number;
  valleyWidth?: number;
  mountainScale?: number;
  hasSnowcaps?: boolean;
}

/**
 * Multi-point terrain drafts and the ruler share the same point buffers. A
 * draft belongs to the tool that started it, so switching tools drops the
 * preview instead of leaking vertices into the next shape.
 */
export function useMapDrafting({
  activeTool,
  isPersian,
  onAddTerrain,
  onSelectionChange,
  onCancelZoom,
  activeBiome = 'forest',
  highlandMode = 'plateau',
  cliffHeight = 36,
  terraceTiers = 1,
  valleyWidth = 28,
  mountainScale = 55,
  hasSnowcaps = true,
}: UseMapDraftingOptions) {
  const [draftPoints, setDraftPoints] = useState<MapPoint[]>([]);
  const [rulerPoints, setRulerPoints] = useState<MapPoint[]>([]);

  // A draft belongs to one tool. Clearing it when the tool changes is the
  // intended external-system cleanup; deriving the clear would resurrect a
  // stale draft if the author switched back to the previous tool.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraftPoints([]);
    setRulerPoints([]);
  }, [activeTool]);

  // Double click finishes the draft (Enter does the same — see below).
  const handleDoubleClick = useCallback(
    (event?: MouseEvent) => {
      // Alt is navigation: an Alt-double-click must not finish a draft.
      if (event?.altKey) return;
      if (draftPoints.length < 2) return;

      if (activeTool === 'terrain_continent' || activeTool === 'terrain_biome') {
        const isBiome = activeTool === 'terrain_biome';
        const biomeNames: Record<string, { en: string; fa: string }> = {
          forest: { en: 'Ancient Forest', fa: 'جنگل کهن' },
          jungle: { en: 'Primeval Jungle', fa: 'جنگل گرمسیری' },
          desert: { en: 'Sand Dune Desert', fa: 'کویر و ریگزار' },
          swamp: { en: 'Foul Marshland', fa: 'مرداب و لجنزار' },
          tundra: { en: 'Frozen Tundra', fa: 'تندرای یخی' },
          plains: { en: 'Golden Plains', fa: 'دشت بی‌کران' },
        };
        const selectedName = isBiome ? biomeNames[activeBiome] : null;

        const targetFamily = isBiome && activeBiome ? resolveDefaultFamilyForTerrain(activeBiome) : undefined;
        const newFeature: MapTerrainFeature = {
          id: `terr_${Date.now().toString(36)}`,
          name: isBiome
            ? (isPersian ? selectedName?.fa || 'ناحیه اقلیمی' : selectedName?.en || 'Biome Region')
            : isPersian
            ? 'خشکی نوبنیاد'
            : 'New Landmass',
          type: isBiome ? activeBiome : 'continent',
          polygon: draftPoints,
          symbolFamily: targetFamily,
          color: isBiome ? undefined : VINTAGE_PARCHMENT.landFillHex,
          description: isPersian ? 'عنصر جغرافیایی ترسیم‌شده' : 'User-created geographical feature',
        };
        if (isBiome) {
          newFeature.scatterInstances = generateScatterInstances(newFeature);
        }
        onAddTerrain(newFeature);
        onSelectionChange([{ kind: 'terrain', id: newFeature.id }]);
      } else if (activeTool === 'terrain_lake') {
        const newFeature: MapTerrainFeature = {
          id: `terr_${Date.now().toString(36)}`,
          name: isPersian ? 'دریاچه لاجوردی' : 'Inland Lake',
          type: 'lake',
          polygon: draftPoints,
          color: '#5a7b91',
          description: isPersian ? 'دریاچه عمیق آب شیرین' : 'Deep inland freshwater lake',
        };
        onAddTerrain(newFeature);
        onSelectionChange([{ kind: 'terrain', id: newFeature.id }]);
      } else if (activeTool === 'terrain_highland') {
        const isRidge = highlandMode === 'ridge';
        const newFeature: MapTerrainFeature = {
          id: `terr_${Date.now().toString(36)}`,
          name: isRidge
            ? isPersian
              ? 'دیواره صخره‌ای و پرتگاه'
              : 'Highland Escarpment'
            : isPersian
            ? 'فلات مرتفع'
            : 'Elevated Plateau',
          type: isRidge ? 'highland' : 'plateau',
          ...(isRidge ? { points: draftPoints } : { polygon: draftPoints }),
          elevation: terraceTiers > 1 ? 1800 : 800,
          width: cliffHeight,
          description: isPersian ? 'زمین‌های مرتفع با سقف صاف' : 'Elevated flat-topped tablelands',
        };
        onAddTerrain(newFeature);
        onSelectionChange([{ kind: 'terrain', id: newFeature.id }]);
      } else if (
        activeTool === 'terrain_mountain' ||
        activeTool === 'terrain_river' ||
        activeTool === 'terrain_valley'
      ) {
        const type =
          activeTool === 'terrain_mountain'
            ? 'mountain_range'
            : activeTool === 'terrain_river'
            ? 'river'
            : 'valley';

        const newFeature: MapTerrainFeature = {
          id: `terr_${Date.now().toString(36)}`,
          name:
            type === 'mountain_range'
              ? isPersian
                ? 'رشته‌کوه کهن'
                : 'Ancient Mountain Ridge'
              : type === 'river'
              ? isPersian
                ? 'رودخانه خروشان'
                : 'Winding River'
              : isPersian
              ? 'دره و شکاف زمین'
              : 'Rift Valley',
          type,
          points: draftPoints,
          elevation: type === 'mountain_range' ? (hasSnowcaps ? 3200 : 2000) : type === 'valley' ? -200 : 150,
          scale: type === 'mountain_range' ? mountainScale : undefined,
          hasSnowcaps: type === 'mountain_range' ? hasSnowcaps : undefined,
          width:
            type === 'river'
              ? 10
              : type === 'mountain_range'
              ? Math.round(mountainScale * 0.58)
              : valleyWidth,
        };
        onAddTerrain(newFeature);
        onSelectionChange([{ kind: 'terrain', id: newFeature.id }]);
      }

      setDraftPoints([]);
    },
    [
      draftPoints,
      activeTool,
      isPersian,
      onAddTerrain,
      onSelectionChange,
      activeBiome,
      highlandMode,
      cliffHeight,
      terraceTiers,
      valleyWidth,
      mountainScale,
      hasSnowcaps,
    ]
  );

  // Escape cancels the draft, Enter commits it.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDraftPoints([]);
        setRulerPoints([]);
        onCancelZoom();
      } else if (event.key === 'Enter' && draftPoints.length >= 2) {
        event.preventDefault();
        handleDoubleClick();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDoubleClick, draftPoints.length, onCancelZoom]);

  return {
    draftPoints,
    setDraftPoints,
    rulerPoints,
    setRulerPoints,
    handleDoubleClick,
  };
}