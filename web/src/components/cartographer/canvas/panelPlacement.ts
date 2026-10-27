/**
 * panelPlacement.ts
 *
 * Geometry for every floating panel in the Cartographer.
 *
 * Kept pure and separate from React because this is the part that has been
 * wrong: a panel whose content grows (a list of names, a generator submenu)
 * used to be positioned against a guess at its own height and then ran off the
 * bottom of the screen. The contract here is absolute — whatever the content
 * height, the placed panel never extends past the viewport edge; it scrolls
 * internally instead.
 */

export interface PanelPoint {
  x: number;
  y: number;
}

export interface PanelViewport {
  width: number;
  height: number;
}

export interface PanelPlacementInput {
  /** The click that opened the panel. Ignored for centered dialogs. */
  anchor?: PanelPoint;
  /** Preferred width in px. */
  width: number;
  /** Height the content wants, measured by the caller. */
  naturalHeight: number;
  viewport: PanelViewport;
  /** `anchored` sits at the click; `centered` is a dialog. */
  variant?: 'anchored' | 'centered';
  /** Fraction of the viewport the panel may occupy before scrolling. */
  maxHeightRatio?: number;
  /** Gap kept between the panel and the viewport edge. */
  margin?: number;
}

export interface PanelPlacement {
  left?: number;
  top?: number;
  width: number;
  maxHeight: number;
}

export const PANEL_MARGIN = 8;
export const PANEL_MIN_WIDTH = 200;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export function computePanelPlacement({
  anchor,
  width,
  naturalHeight,
  viewport,
  variant = 'anchored',
  maxHeightRatio = 0.9,
  margin = PANEL_MARGIN,
}: PanelPlacementInput): PanelPlacement {
  const vw = Math.max(1, viewport.width);
  const vh = Math.max(1, viewport.height);
  const panelWidth = Math.max(
    PANEL_MIN_WIDTH,
    Math.min(width, vw - margin * 2)
  );

  if (variant === 'centered') {
    return {
      width: panelWidth,
      maxHeight: Math.max(1, vh - margin * 2),
    };
  }

  const height = Math.min(Math.max(0, naturalHeight), Math.round(vh * maxHeightRatio));
  const anchorX = anchor?.x ?? margin;
  const anchorY = anchor?.y ?? margin;

  // Prefer opening down-right of the click, like a context menu; flip on the
  // axis that would overflow, then clamp so the panel is always on screen.
  let left = anchorX;
  if (left + panelWidth + margin > vw) left = anchorX - panelWidth;
  left = clamp(left, margin, vw - panelWidth - margin);

  let top = anchorY;
  if (top + height + margin > vh) top = anchorY - height;
  top = clamp(top, margin, vh - height - margin);

  // Whatever room is left under the placed panel becomes the scroll area. No
  // minimum: a "usable size" floor is exactly how a panel ends up past the
  // bottom edge, and a short panel is readable where a clipped one is not.
  return {
    left,
    top,
    width: panelWidth,
    maxHeight: Math.max(1, vh - top - margin),
  };
}