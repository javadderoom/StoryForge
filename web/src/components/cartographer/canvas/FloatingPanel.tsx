'use client';

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  computePanelPlacement,
  PANEL_MARGIN,
  type PanelPlacement,
} from './panelPlacement';

/**
 * A floating panel anchored to a screen point — the Cartographer's one popover
 * shell.
 *
 * Every popover in this editor is opened by a click at a coordinate and then
 * grows as content arrives (a search filter, a longer generator submenu, a
 * candidate list). Hand-rolled positioning in each component produced panels
 * that ran off the bottom of the screen once they were long enough, because
 * they clamped against a guess at their own height.
 *
 * This shell measures itself first, then places itself with an explicit
 * maximum height and an internal scroll area, so a panel can never leave the
 * viewport no matter how much content it holds.
 */

export interface FloatingPanelAnchor {
  x: number;
  y: number;
}

interface FloatingPanelProps {
  /** Screen coordinates of the click that opened the panel. Required when anchored. */
  anchor?: FloatingPanelAnchor;
  /** Preferred width in px. Narrow viewports clamp it. */
  width?: number;
  /** Fraction of the viewport height the panel may occupy. */
  maxHeightRatio?: number;
  /**
   * `anchored` opens at the click point (context menus, pickers).
   * `centered` is a dialog (the AI oracle): fixed in the middle, same shell.
   */
  variant?: 'anchored' | 'centered';
  /** `parchment` is the Cartographer's map palette; `plain` leaves colours to the caller. */
  theme?: 'parchment' | 'plain';

  /** Fixed header row. Keep it `shrink-0`. */
  header?: React.ReactNode;
  /** Fixed footer row. Keep it `shrink-0`. */
  footer?: React.ReactNode;
  /** Scrolling body. */
  children: React.ReactNode;

  onClose?: () => void;
  /**
   * Swallow clicks behind the panel. Use when the click that opened the panel
   * would otherwise be re-handled by the canvas underneath.
   */
  backdrop?: boolean;
  /** Backdrop styling. Defaults to an invisible click-catcher. */
  backdropClassName?: string;
  closeOnOutsideClick?: boolean;
  closeOnEscape?: boolean;

  dir?: 'ltr' | 'rtl';
  /** Extra classes for the root, e.g. the Persian font. */
  className?: string;
  /** Extra classes for the scrolling body. */
  bodyClassName?: string;
  ariaLabel?: string;
}

const MARGIN = PANEL_MARGIN;

export function FloatingPanel({
  anchor,
  width = 320,
  maxHeightRatio = 0.9,
  variant = 'anchored',
  theme = 'parchment',
  header,
  footer,
  children,
  onClose,
  backdrop = false,
  backdropClassName = '',
  closeOnOutsideClick = true,
  closeOnEscape = true,
  dir = 'ltr',
  className = '',
  bodyClassName = '',
  ariaLabel,
}: FloatingPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<PanelPlacement | null>(null);

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Anchor deps stay primitive: the callers build the object inline, so
  // depending on it would re-run the placement effect on every render.
  const anchorX = anchor?.x;
  const anchorY = anchor?.y;

  /** Measures the natural size, then places the panel inside the viewport. */
  const place = useCallback(() => {
    const el = panelRef.current;
    if (!el || typeof window === 'undefined') return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Read the height the content actually wants, ignoring the cap we are
    // currently rendering with, so the flip decision is not made on a guess.
    // (A centered dialog is placed by CSS and does not need this.)
    let naturalHeight = 0;
    if (variant !== 'centered') {
      const previousMaxHeight = el.style.maxHeight;
      el.style.maxHeight = 'none';
      naturalHeight = el.offsetHeight;
      el.style.maxHeight = previousMaxHeight;
    }

    setLayout(
      computePanelPlacement({
        anchor:
          anchorX !== undefined && anchorY !== undefined
            ? { x: anchorX, y: anchorY }
            : undefined,
        width,
        naturalHeight,
        viewport: { width: vw, height: vh },
        variant,
        maxHeightRatio,
        margin: MARGIN,
      })
    );
  }, [anchorX, anchorY, width, maxHeightRatio, variant]);

  // Runs before paint: the first render is hidden, so the panel is never
  // visible at an unclamped position for a frame.
  //
  // Reading the real DOM is the one thing a layout effect is for, and the
  // state write lands before paint, so it cannot cascade into extra frames.
  useLayoutEffect(() => {
    place();
  }, [place]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => place();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [place]);

  useEffect(() => {
    if (!onClose) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape') onCloseRef.current?.();
    };
    window.addEventListener('keydown', onKeyDown);

    // With a backdrop, the backdrop owns outside clicks — attaching a window
    // listener as well would race the click that opened the panel.
    let detachOutsideClick: (() => void) | undefined;
    if (!backdrop && closeOnOutsideClick) {
      const onOutsideAction = (e: Event) => {
        if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
          onCloseRef.current?.();
        }
      };

      // Deferred one task so the gesture that opened the panel does not immediately close it
      const timer = window.setTimeout(() => {
        window.addEventListener('pointerdown', onOutsideAction, true);
        window.addEventListener('mousedown', onOutsideAction, true);
        window.addEventListener('contextmenu', onOutsideAction, true);
      }, 0);

      detachOutsideClick = () => {
        window.clearTimeout(timer);
        window.removeEventListener('pointerdown', onOutsideAction, true);
        window.removeEventListener('mousedown', onOutsideAction, true);
        window.removeEventListener('contextmenu', onOutsideAction, true);
      };
    }

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      detachOutsideClick?.();
    };
  }, [onClose, closeOnEscape, closeOnOutsideClick, backdrop]);

  if (typeof document === 'undefined') return null;

  const isCentered = variant === 'centered';
  const themeClass = isCentered
    ? ''
    : theme === 'parchment'
    ? 'rounded-xl border border-[#4a392a] bg-[#1a1410]/97 text-[#eedec8] text-xs backdrop-blur-md'
    : '';

  const style: React.CSSProperties = layout
    ? {
        width: layout.width,
        maxHeight: layout.maxHeight,
        ...(isCentered ? {} : { left: layout.left, top: layout.top }),
      }
    : {
        // Hidden measuring pass: same width so the height is honest.
        width: Math.max(200, Math.min(width, (window.innerWidth || 1024) - MARGIN * 2)),
        maxHeight: `${Math.round(maxHeightRatio * 100)}vh`,
        ...(isCentered ? {} : { left: anchor?.x ?? 0, top: anchor?.y ?? 0 }),
        visibility: 'hidden',
      };

  const panel = (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={ariaLabel}
      dir={dir}
      style={style}
      className={`fixed z-50 flex flex-col overflow-hidden shadow-2xl select-none ${
        isCentered ? 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2' : ''
      } ${themeClass} ${className}`}
    >
      {header}
      <div className={`min-h-0 flex-1 overflow-y-auto ${bodyClassName}`}>
        {children}
      </div>
      {footer}
    </div>
  );

  return createPortal(
    <>
      {backdrop && (
        <div
          className={`fixed inset-0 z-40 bg-transparent ${backdropClassName}`}
          aria-hidden="true"
          onPointerDown={() => onCloseRef.current?.()}
          onMouseDown={() => onCloseRef.current?.()}
          onContextMenu={(e) => {
            e.preventDefault();
            onCloseRef.current?.();
          }}
        />
      )}
      {panel}
    </>,
    document.body
  );
}