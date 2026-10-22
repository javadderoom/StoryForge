'use client';

import React from 'react';
import { MousePointer, Navigation, Sparkles } from 'lucide-react';
import type { MapPoint } from '@/lib/types';

interface ScreenRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface CanvasOverlaysProps {
  marquee: ScreenRect | null;
  zoomRect: ScreenRect | null;
  hoveredCoord: MapPoint | null;
  zoom: number;
  draftPointCount: number;
  isPersian: boolean;
  marqueeThresholdPx: number;
  zoomRectThresholdPx: number;
  stopOverlayMouse: (event: React.MouseEvent) => void;
}

/**
 * Screen-space HUD and gesture previews. They stay outside the canvas draw
 * loop so the marquee, zoom box and readouts remain crisp at every zoom level.
 */
export const CanvasOverlays: React.FC<CanvasOverlaysProps> = ({
  marquee,
  zoomRect,
  hoveredCoord,
  zoom,
  draftPointCount,
  isPersian,
  marqueeThresholdPx,
  zoomRectThresholdPx,
  stopOverlayMouse,
}) => (
  <>
    {/* Rubber-band selection (Plan 23). */}
    {marquee &&
      Math.abs(marquee.x1 - marquee.x0) > marqueeThresholdPx &&
      Math.abs(marquee.y1 - marquee.y0) > marqueeThresholdPx && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute z-30 border border-amber-500/90 bg-amber-300/15 shadow-[0_0_0_1px_rgba(255,247,226,0.55)]"
          style={{
            left: Math.min(marquee.x0, marquee.x1),
            top: Math.min(marquee.y0, marquee.y1),
            width: Math.abs(marquee.x1 - marquee.x0),
            height: Math.abs(marquee.y1 - marquee.y0),
          }}
        />
      )}

    {/* Alt-drag zoom box. */}
    {zoomRect &&
      Math.abs(zoomRect.x1 - zoomRect.x0) >= zoomRectThresholdPx &&
      Math.abs(zoomRect.y1 - zoomRect.y0) >= zoomRectThresholdPx && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute z-30 border-2 border-dashed border-amber-700/90 bg-amber-300/10 shadow-[0_0_0_1px_rgba(255,247,226,0.6)]"
          style={{
            left: Math.min(zoomRect.x0, zoomRect.x1),
            top: Math.min(zoomRect.y0, zoomRect.y1),
            width: Math.abs(zoomRect.x1 - zoomRect.x0),
            height: Math.abs(zoomRect.y1 - zoomRect.y0),
          }}
        />
      )}

    {/* Floating viewport status badge. */}
    <div
      onMouseDown={stopOverlayMouse}
      onMouseMove={stopOverlayMouse}
      onMouseUp={stopOverlayMouse}
      className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-900/80 backdrop-blur-md border border-amber-800/40 text-stone-200 text-xs shadow-lg"
    >
      <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
      <span className="font-serif font-medium tracking-wide">
        {isPersian ? 'موتور شتاب‌یافته WebGL • سبک چرمینه کلاسیک' : 'PixiJS WebGL • Vintage Parchment Engine'}
      </span>
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-300 font-mono border border-amber-700/50">
        v8 GPU
      </span>
    </div>

    {/* Coordinate HUD. */}
    {hoveredCoord && (
      <div
        onMouseDown={stopOverlayMouse}
        onMouseMove={stopOverlayMouse}
        onMouseUp={stopOverlayMouse}
        className="absolute bottom-4 left-4 z-20 flex items-center gap-2 px-3 py-1 rounded bg-stone-900/80 backdrop-blur-sm border border-stone-800 text-[11px] font-mono text-stone-400"
      >
        <Navigation className="w-3 h-3 text-stone-500" />
        <span>
          X: {hoveredCoord.x} | Y: {hoveredCoord.y}
        </span>
        <span className="text-stone-600">|</span>
        <span>Zoom: {Math.round(zoom * 100)}%</span>
        <span className="text-stone-600">|</span>
        <span className="text-stone-500">
          {isPersian
            ? 'کشیدن: انتخاب · راست: جابجایی · Alt: بزرگنمایی'
            : 'Drag: select · Right-drag: pan · Alt-drag: zoom'}
        </span>
      </div>
    )}

    {/* Draft hint — the preview alone never says how to finish a shape. */}
    {draftPointCount > 0 && (
      <div
        onMouseDown={stopOverlayMouse}
        onMouseMove={stopOverlayMouse}
        onMouseUp={stopOverlayMouse}
        className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-sky-950/85 backdrop-blur-sm border border-sky-800/60 text-[11px] text-sky-100 shadow-lg"
      >
        <MousePointer className="w-3 h-3 text-sky-400" />
        <span>
          {isPersian
            ? `${draftPointCount} نقطه — برای ثبت دوبار کلیک کنید یا Enter بزنید · Esc برای لغو`
            : `${draftPointCount} point${draftPointCount === 1 ? '' : 's'} — double-click or press Enter to commit · Esc to cancel`}
        </span>
      </div>
    )}
  </>
);