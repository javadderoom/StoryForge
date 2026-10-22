'use client';

import { useCallback, useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import type { MapPoint, MapTerrainFeature } from '@/lib/types';
import type { MapObjectRef } from '@/lib/engines/world/mapSelection';
import { VINTAGE_PARCHMENT } from '@/lib/engines/world/pixi/vintageTheme';
import type { CartographerTool } from '../CartographerHeader';

interface UseMapDraftingOptions {
  activeTool: CartographerTool;
  isPersian: boolean;
  onAddTerrain: (feature: MapTerrainFeature) => void;
  onSelectionChange: (refs: MapObjectRef[]) => void;
  onCancelZoom: () => void;
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
        const newFeature: MapTerrainFeature = {
          id: `terr_${Date.now().toString(36)}`,
          name: isBiome
            ? isPersian
              ? 'ناحیه اقلیمی نو'
              : 'New Biome Region'
            : isPersian
            ? 'خشکی نوبنیاد'
            : 'New Landmass',
          type: isBiome ? 'forest' : 'continent',
          polygon: draftPoints,
          color: isBiome ? '#4d5f3e' : VINTAGE_PARCHMENT.landFillHex,
          description: isPersian ? 'عنصر جغرافیایی ترسیم‌شده' : 'User-created geographical feature',
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
          elevation: type === 'mountain_range' ? 3200 : type === 'valley' ? -200 : 150,
          width: type === 'river' ? 4 : 28,
        };
        onAddTerrain(newFeature);
        onSelectionChange([{ kind: 'terrain', id: newFeature.id }]);
      }

      setDraftPoints([]);
    },
    [draftPoints, activeTool, isPersian, onAddTerrain, onSelectionChange]
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