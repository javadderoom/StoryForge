import { useCallback, useRef, useState } from 'react';
import type {
  WorldBible,
  WorldMapSettings,
  MapEntityPlacement,
  MapPoint,
} from '@/lib/types';
import type { CartographerTool } from '../../CartographerHeader';
import type { MapObjectRef } from '@/lib/engines/world/mapSelection';
import type { PixiCartographerEngine } from '@/lib/engines/world/pixi/PixiCartographerEngine';
import {
  extractEnvironmentalContext,
  EnvironmentalContext,
} from '@/lib/engines/world/environmentalContext';
import {
  buildLorePlacement,
  loreKindForTool,
  makeLorePlacementId,
  type LorePinCandidate,
  type LorePinKind,
} from '@/lib/engines/world/lorePlacement';

export interface ContextMenuState {
  clientX: number;
  clientY: number;
  worldPoint: MapPoint;
  environmentalContext: EnvironmentalContext;
  targetHitObject?: { kind: string; id: string; name?: string } | null;
  initialSection?: 'main' | 'beast' | 'npc' | 'event' | 'artifact' | 'settlement' | 'custom';
}

export interface LoreDraftState {
  kind: LorePinKind;
  worldPoint: MapPoint;
  clientX: number;
  clientY: number;
}

export interface UseCanvasContextMenuOptions {
  worldBible: WorldBible;
  settings: WorldMapSettings;
  activeTool: CartographerTool;
  engineRef: React.RefObject<PixiCartographerEngine | null>;
  clientToWorld: (clientX: number, clientY: number) => MapPoint;
  onAddPlacement: (placement: MapEntityPlacement) => void;
  onSelectionChange: (refs: MapObjectRef[]) => void;
}

export function useCanvasContextMenu({
  worldBible,
  settings,
  activeTool,
  engineRef,
  clientToWorld,
  onAddPlacement,
  onSelectionChange,
}: UseCanvasContextMenuOptions) {
  const rightClickStartRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const [contextMenuState, setContextMenuState] = useState<ContextMenuState | null>(null);
  const [loreDraft, setLoreDraft] = useState<LoreDraftState | null>(null);

  /** Records right-click starting point for <5px drag-vs-click disambiguation. */
  const recordRightClickStart = useCallback((clientX: number, clientY: number) => {
    rightClickStartRef.current = { clientX, clientY };
  }, []);

  /** Checks if right click was a stationary click (<5px) and opens context menu. */
  const checkRightClickRelease = useCallback(
    (pos: { clientX: number; clientY: number } | null) => {
      if (!rightClickStartRef.current) return;
      const start = rightClickStartRef.current;
      rightClickStartRef.current = null;
      if (!pos) return;

      const dist = Math.hypot(pos.clientX - start.clientX, pos.clientY - start.clientY);
      if (dist < 5) {
        const worldPoint = clientToWorld(pos.clientX, pos.clientY);
        const envContext = extractEnvironmentalContext(worldPoint, worldBible);
        let targetHitObject: { kind: string; id: string; name?: string } | null = null;
        if (engineRef.current) {
          const hit = engineRef.current.pickAt(worldPoint, settings.visibleLayers);
          if (hit) {
            targetHitObject = {
              kind: hit.kind,
              id: hit.id,
              name: (hit as any).candidate?.name || (hit as any).location?.name || hit.id,
            };
          }
        }
        setContextMenuState({
          clientX: pos.clientX,
          clientY: pos.clientY,
          worldPoint,
          environmentalContext: envContext,
          targetHitObject,
        });
      }
    },
    [clientToWorld, engineRef, settings.visibleLayers, worldBible]
  );

  /** Places the chosen canon entity at the point the author clicked. */
  const handlePlaceLore = useCallback(
    (candidate: LorePinCandidate) => {
      if (!loreDraft) return;

      const pin = buildLorePlacement(
        makeLorePlacementId(),
        loreDraft.kind,
        candidate.id,
        candidate.name,
        loreDraft.worldPoint
      );
      onAddPlacement(pin);
      onSelectionChange([{ kind: 'placement', id: pin.id }]);
      setLoreDraft(null);
    },
    [loreDraft, onAddPlacement, onSelectionChange]
  );

  /** Opens the right-click generator submenu matching the active lore tool kind. */
  const handleGenerateLore = useCallback(() => {
    if (!loreDraft) return;

    const sectionByKind: Partial<Record<LorePinKind, 'beast' | 'npc' | 'event' | 'artifact'>> = {
      bestiary: 'beast',
      npc: 'npc',
      timeline: 'event',
      artifact: 'artifact',
    };
    const section = sectionByKind[loreDraft.kind];
    if (!section) return;

    setContextMenuState({
      clientX: loreDraft.clientX,
      clientY: loreDraft.clientY,
      worldPoint: loreDraft.worldPoint,
      environmentalContext: extractEnvironmentalContext(loreDraft.worldPoint, worldBible),
      targetHitObject: null,
      initialSection: section,
    });
    setLoreDraft(null);
  }, [loreDraft, worldBible]);

  const loreDraftIsLive = loreDraft !== null && loreKindForTool(activeTool) === loreDraft.kind;
  const canGenerateHere = loreDraft ? loreDraft.kind !== 'deity' : false;

  return {
    rightClickStartRef,
    contextMenuState,
    setContextMenuState,
    loreDraft,
    setLoreDraft,
    loreDraftIsLive,
    canGenerateHere,
    recordRightClickStart,
    checkRightClickRelease,
    handlePlaceLore,
    handleGenerateLore,
  };
}
