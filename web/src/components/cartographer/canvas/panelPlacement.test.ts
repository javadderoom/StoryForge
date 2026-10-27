import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computePanelPlacement, PANEL_MARGIN } from './panelPlacement';

const DESKTOP = { width: 1440, height: 900 };

describe('panelPlacement — floating panels stay on screen', () => {
  it('opens at the click when there is room', () => {
    const p = computePanelPlacement({
      anchor: { x: 400, y: 300 },
      width: 320,
      naturalHeight: 240,
      viewport: DESKTOP,
    });

    assert.deepEqual({ left: p.left, top: p.top }, { left: 400, top: 300 });
    assert.equal(p.width, 320);
  });

  it('never runs off the bottom when the content is long', () => {
    // The reported bug: a long candidate list pushed the panel off-screen.
    const p = computePanelPlacement({
      anchor: { x: 400, y: 300 },
      width: 320,
      naturalHeight: 2400,
      viewport: DESKTOP,
    });

    assert.ok(p.top !== undefined);
    assert.ok(
      p.top + p.maxHeight <= DESKTOP.height - PANEL_MARGIN,
      `bottom ${p.top + p.maxHeight} exceeded ${DESKTOP.height - PANEL_MARGIN}`
    );
    // Tall content scrolls inside the panel rather than growing the panel.
    assert.ok(p.maxHeight > 0);
  });

  it('flips up instead of sliding over the click when opened near the bottom', () => {
    const p = computePanelPlacement({
      anchor: { x: 300, y: 850 },
      width: 320,
      naturalHeight: 400,
      viewport: DESKTOP,
    });

    assert.ok(p.top !== undefined);
    assert.ok(p.top + 400 <= DESKTOP.height, 'panel should sit above the click');
    assert.ok(p.top < 850, 'panel should not cover the click');
  });

  it('flips left instead of running off the right edge', () => {
    const p = computePanelPlacement({
      anchor: { x: 1400, y: 200 },
      width: 320,
      naturalHeight: 300,
      viewport: DESKTOP,
    });

    assert.ok(p.left !== undefined);
    assert.ok(p.left + (p.width ?? 0) <= DESKTOP.width - PANEL_MARGIN);
    assert.ok(p.left < 1400);
  });

  it('stays inside the viewport from the bottom-right corner', () => {
    const p = computePanelPlacement({
      anchor: { x: DESKTOP.width - 2, y: DESKTOP.height - 2 },
      width: 320,
      naturalHeight: 1200,
      viewport: DESKTOP,
    });

    assert.ok((p.left ?? 0) >= PANEL_MARGIN);
    assert.ok((p.top ?? 0) >= PANEL_MARGIN);
    assert.ok((p.left ?? 0) + p.width <= DESKTOP.width - PANEL_MARGIN);
    assert.ok((p.top ?? 0) + p.maxHeight <= DESKTOP.height - PANEL_MARGIN);
  });

  it('clamps its width on a narrow screen', () => {
    const p = computePanelPlacement({
      anchor: { x: 100, y: 100 },
      width: 320,
      naturalHeight: 300,
      viewport: { width: 280, height: 700 },
    });

    assert.ok(p.width <= 280 - PANEL_MARGIN * 2);
    assert.ok((p.left ?? 0) >= PANEL_MARGIN);
  });

  it('keeps a usable body height in short viewports without exceeding them', () => {
    const viewport = { width: 900, height: 260 };
    const p = computePanelPlacement({
      anchor: { x: 200, y: 120 },
      width: 320,
      naturalHeight: 900,
      viewport,
    });

    assert.ok(p.maxHeight > 0);
    assert.ok((p.top ?? 0) + p.maxHeight <= viewport.height - PANEL_MARGIN);
  });

  it('stays inside even when a short panel opens near the bottom edge', () => {
    // Regression: a minimum-height floor used to push the panel past the
    // bottom of the screen when the click was low and the content was short.
    const viewport = { width: 1440, height: 900 };
    for (const naturalHeight of [40, 140, 240]) {
      const p = computePanelPlacement({
        anchor: { x: 300, y: 880 },
        width: 320,
        naturalHeight,
        viewport,
      });

      assert.ok(
        (p.top ?? 0) + p.maxHeight <= viewport.height - PANEL_MARGIN,
        `naturalHeight ${naturalHeight}: bottom ${(p.top ?? 0) + p.maxHeight}`
      );
      assert.ok((p.top ?? 0) >= PANEL_MARGIN);
    }
  });

  it('centres dialogs and caps them to the viewport', () => {
    const p = computePanelPlacement({
      variant: 'centered',
      width: 512,
      naturalHeight: 5000,
      viewport: DESKTOP,
    });

    // Centering is done by CSS; the computation only supplies size limits.
    assert.equal(p.left, undefined);
    assert.equal(p.top, undefined);
    assert.equal(p.maxHeight, DESKTOP.height - PANEL_MARGIN * 2);
    assert.ok(p.width <= DESKTOP.width - PANEL_MARGIN * 2);
  });

  it('never reports a negative box', () => {
    const p = computePanelPlacement({
      anchor: { x: 10, y: 10 },
      width: 400,
      naturalHeight: 0,
      viewport: { width: 120, height: 90 },
    });

    assert.ok(p.width > 0);
    assert.ok(p.maxHeight > 0);
    assert.ok((p.left ?? 0) >= 0);
    assert.ok((p.top ?? 0) >= 0);
  });
});