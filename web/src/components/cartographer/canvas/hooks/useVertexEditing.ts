import { useCallback, useEffect, useRef, useState } from 'react';
import type { MapTerrainFeature } from '@/lib/types';

export interface ActiveVertex {
  featureId: string;
  index: number;
  subType: 'points' | 'polygon';
}

export interface UseVertexEditingOptions {
  /** Live terrain features, so the keyboard can resolve the edited vertex. */
  terrainFeaturesRef: React.RefObject<MapTerrainFeature[]>;
  onUpdateTerrain: (id: string, updated: Partial<MapTerrainFeature>) => void;
}

/**
 * Vertex edit mode: `A` toggles it, `V` leaves it, `Escape` cancels, and
 * `Delete` removes the active vertex.
 *
 * The state lives here so the keyboard listener is declared after the setters
 * it calls, which is what the react-hooks immutability rule asks for.
 */
export function useVertexEditing({
  terrainFeaturesRef,
  onUpdateTerrain,
}: UseVertexEditingOptions) {
  const [activeVertex, setActiveVertex] = useState<ActiveVertex | null>(null);
  const activeVertexRef = useRef<ActiveVertex | null>(null);
  const [isVertexEditMode, setIsVertexEditMode] = useState(false);

  const clearActiveVertex = useCallback(() => {
    setActiveVertex(null);
    activeVertexRef.current = null;
  }, []);

  const selectVertex = useCallback((vertex: ActiveVertex | null) => {
    setActiveVertex(vertex);
    activeVertexRef.current = vertex;
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && activeVertexRef.current) {
        const v = activeVertexRef.current;
        const feature = terrainFeaturesRef.current.find((f) => f.id === v.featureId);
        if (feature) {
          if (v.subType === 'points' && feature.points && feature.points.length > 2) {
            e.preventDefault();
            const updated = feature.points.filter((_, i) => i !== v.index);
            onUpdateTerrain(feature.id, { points: updated });
            clearActiveVertex();
            return;
          }
          if (v.subType === 'polygon' && feature.polygon && feature.polygon.length > 3) {
            e.preventDefault();
            const updated = feature.polygon.filter((_, i) => i !== v.index);
            onUpdateTerrain(feature.id, { polygon: updated });
            clearActiveVertex();
            return;
          }
        }
      }

      if (e.key === 'Escape') {
        setIsVertexEditMode(false);
        clearActiveVertex();
      }

      if (e.key === 'a' || e.key === 'A') {
        setIsVertexEditMode(true);
      }

      if (e.key === 'v' || e.key === 'V') {
        setIsVertexEditMode(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [clearActiveVertex, onUpdateTerrain, terrainFeaturesRef]);

  return {
    activeVertex,
    activeVertexRef,
    selectVertex,
    clearActiveVertex,
    isVertexEditMode,
    setIsVertexEditMode,
  };
}
