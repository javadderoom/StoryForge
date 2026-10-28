import { useCallback, useEffect, useRef, useState } from 'react';
import type { MapPoint } from '@/lib/types';
import type { MapObjectRef } from '@/lib/engines/world/mapSelection';
import { calculateZoomPan, clampZoom } from '@/lib/engines/world/pixi/pixiMath';

/**
 * A rubber band in progress, in container-relative screen pixels.
 *
 * `base` is the selection the band started from when Shift/Ctrl is held, so
 * an additive band unions with what was already selected instead of replacing
 * it.
 */
export interface MarqueeState {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  additive: boolean;
  base: MapObjectRef[];
}

/** A click that never moved further than this is not a rubber band. */
export const MARQUEE_THRESHOLD_PX = 3;

/**
 * A group move in progress.
 *
 * `origin` and `delta` are world-space. The world is not mutated while the
 * pointer moves: the engine draws the selected objects translated by `delta`,
 * and only mouseup commits the move (one undo step, one world update).
 */
export interface SelectionDragState {
  refs: MapObjectRef[];
  origin: MapPoint;
  delta: MapPoint;
  moved: boolean;
}

/** Screen-space distance before a press becomes a drag. */
export const SELECTION_DRAG_THRESHOLD_PX = 3;

/**
 * An Alt + left-drag zoom box, in container-relative screen pixels.
 *
 * Released below the threshold it is a no-op: the gesture is navigation, so it
 * must never be mistaken for a selection click.
 */
export interface ZoomRectState {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Both axes must clear this before a zoom box is worth applying. */
export const ZOOM_RECT_THRESHOLD_PX = 8;

export interface UseCanvasGesturesOptions {
  zoom: number;
  pan: { x: number; y: number };
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * The viewport gestures: panning, the rubber-band selection, the group move,
 * the Alt-drag zoom box and the keyboard zoom.
 *
 * Each gesture keeps a ref beside its state, because the mouseup path has to
 * read the live values synchronously without re-binding a global listener on
 * every pointer move.
 */
export function useCanvasGestures({
  zoom,
  pan,
  setZoom,
  setPan,
  containerRef,
}: UseCanvasGesturesOptions) {
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Rubber-band selection (Plan 23).
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);
  const marqueeRef = useRef<MarqueeState | null>(null);
  const setMarqueeState = useCallback((next: MarqueeState | null) => {
    marqueeRef.current = next;
    setMarquee(next);
  }, []);

  // Group move in progress (Plan 23).
  const [selectionDrag, setSelectionDrag] = useState<SelectionDragState | null>(null);
  const selectionDragRef = useRef<SelectionDragState | null>(null);
  const setSelectionDragState = useCallback((next: SelectionDragState | null) => {
    selectionDragRef.current = next;
    setSelectionDrag(next);
  }, []);

  // Alt + left-drag zoom box.
  const [zoomRect, setZoomRect] = useState<ZoomRectState | null>(null);
  const zoomRectRef = useRef<ZoomRectState | null>(null);
  const setZoomRectState = useCallback((next: ZoomRectState | null) => {
    zoomRectRef.current = next;
    setZoomRect(next);
  }, []);

  // Show the zoom cursor while Alt is held, even before the drag starts.
  const [isAltHeld, setIsAltHeld] = useState(false);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setIsAltHeld(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setIsAltHeld(false);
    };
    const onBlur = () => setIsAltHeld(false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  // Track cursor position for anchor-preserving keyboard zoom (PageUp / PageDown)
  const lastMousePosRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);

  zoomRef.current = zoom;
  panRef.current = pan;

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  // Window-level mouse tracking so lastMousePosRef is never stale even if hovering over toolbars/overlays
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      lastMousePosRef.current = { clientX: e.clientX, clientY: e.clientY };
    };
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  // PageUp / PageDown keyboard shortcuts for zooming in / out
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

      const isZoomIn =
        e.key === 'PageUp' ||
        e.code === 'PageUp' ||
        e.key === 'Prior' ||
        (e.code === 'Numpad9' && !e.getModifierState?.('NumLock'));
      const isZoomOut =
        e.key === 'PageDown' ||
        e.code === 'PageDown' ||
        e.key === 'Next' ||
        (e.code === 'Numpad3' && !e.getModifierState?.('NumLock'));

      if (!isZoomIn && !isZoomOut) return;

      e.preventDefault();
      e.stopPropagation();

      const zoomFactor = isZoomIn ? 1.2 : 1 / 1.2;
      const currentZoom = zoomRef.current;
      const currentPan = panRef.current;
      const newZoom = clampZoom(currentZoom * zoomFactor);
      if (Math.abs(newZoom - currentZoom) < 0.001) return;

      const container = containerRef.current;
      const rect = container
        ? container.getBoundingClientRect()
        : {
            left: 0,
            top: 0,
            right: typeof window !== 'undefined' ? window.innerWidth : 2400,
            bottom: typeof window !== 'undefined' ? window.innerHeight : 1600,
            width: typeof window !== 'undefined' ? window.innerWidth : 2400,
            height: typeof window !== 'undefined' ? window.innerHeight : 1600,
          };

      const lastPos = lastMousePosRef.current;
      const isCursorInside =
        lastPos !== null &&
        lastPos.clientX >= rect.left &&
        lastPos.clientX <= rect.right &&
        lastPos.clientY >= rect.top &&
        lastPos.clientY <= rect.bottom;

      const cursorX = isCursorInside && lastPos ? lastPos.clientX - rect.left : rect.width / 2;
      const cursorY = isCursorInside && lastPos ? lastPos.clientY - rect.top : rect.height / 2;

      const newPan = calculateZoomPan(cursorX, cursorY, currentPan, currentZoom, newZoom);

      zoomRef.current = newZoom;
      panRef.current = newPan;

      setZoom(newZoom);
      setPan(newPan);
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
    };
  }, [containerRef, setZoom, setPan]);

  const cancelZoomBox = useCallback(() => setZoomRectState(null), [setZoomRectState]);

  return {
    isPanning,
    setIsPanning,
    dragStart,
    setDragStart,
    marquee,
    marqueeRef,
    setMarqueeState,
    selectionDrag,
    selectionDragRef,
    setSelectionDragState,
    zoomRect,
    zoomRectRef,
    setZoomRectState,
    isAltHeld,
    lastMousePosRef,
    cancelZoomBox,
  };
}
