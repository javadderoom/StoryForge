import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  layoutCurvedText,
  measureCharWidth,
  deriveFeatureGuideSpline,
} from './splineTextRenderer';
import type { MapPoint, MapTerrainFeature } from '@/lib/types';

describe('splineTextRenderer — Curved & Spline-Aligned Typography', () => {
  // Curved mountain ridgeline spline: S-curve from (100, 200) to (400, 220)
  const mountainSpline: MapPoint[] = [
    { x: 100, y: 200 },
    { x: 200, y: 150 },
    { x: 300, y: 250 },
    { x: 400, y: 220 },
  ];

  it('returns null for empty text or degenerate paths', () => {
    assert.equal(layoutCurvedText('', mountainSpline), null);
    assert.equal(layoutCurvedText('TEST', []), null);
    assert.equal(layoutCurvedText('TEST', [{ x: 10, y: 10 }]), null);
  });

  it('measures character widths accurately with proportional fallbacks', () => {
    const wI = measureCharWidth('I', 20);
    const wM = measureCharWidth('M', 20);
    const wSpace = measureCharWidth(' ', 20);

    assert.ok(wI < wM, 'I should be narrower than M');
    assert.ok(wSpace > 0, 'Space width must be positive');
    assert.ok(wM > 12, 'M width should reflect wide proportional glyph');
  });

  it('generates curved glyph placements along a guide spline with uppercase tracking', () => {
    const layout = layoutCurvedText('Faravand', mountainSpline, {
      fontSize: 16,
      letterSpacing: 6,
      alignment: 'center',
    });

    assert.ok(layout !== null);
    assert.equal(layout.text, 'FARAVAND');
    assert.equal(layout.glyphs.length, 8);
    assert.ok(layout.totalArcLength > 200);

    // Glyphs must be monotonically advancing along arc length
    for (let i = 1; i < layout.glyphs.length; i++) {
      assert.ok(
        layout.glyphs[i].arcLength > layout.glyphs[i - 1].arcLength,
        `Glyph ${i} arcLength (${layout.glyphs[i].arcLength}) must be > Glyph ${i - 1} (${layout.glyphs[i - 1].arcLength})`
      );
      assert.ok(
        layout.glyphs[i].x > layout.glyphs[i - 1].x,
        `Glyphs must proceed generally along path direction`
      );
    }
  });

  it('reverses path points flowing right-to-left so text remains right-side-up', () => {
    // Path flowing East to West (right to left)
    const reverseSpline: MapPoint[] = [
      { x: 500, y: 200 },
      { x: 400, y: 210 },
      { x: 300, y: 200 },
      { x: 100, y: 190 },
    ];

    const layout = layoutCurvedText('ZARVAN', reverseSpline, {
      fontSize: 16,
    });

    assert.ok(layout !== null);
    assert.ok(layout.isFlipped, 'Should detect right-to-left flow and flip path');

    // First character 'Z' should be at smaller X than last character 'N'
    const firstGlyph = layout.glyphs[0];
    const lastGlyph = layout.glyphs[layout.glyphs.length - 1];
    assert.equal(firstGlyph.char, 'Z');
    assert.equal(lastGlyph.char, 'N');
    assert.ok(
      firstGlyph.x < lastGlyph.x,
      'Text reading direction must be left-to-right'
    );
  });

  it('applies perpendicular baseline offset to float above physical ridgelines', () => {
    const horizontalSpline: MapPoint[] = [
      { x: 100, y: 300 },
      { x: 400, y: 300 },
    ];

    const noOffset = layoutCurvedText('ALBORZ', horizontalSpline, {
      baselineOffset: 0,
    });
    const withOffset = layoutCurvedText('ALBORZ', horizontalSpline, {
      baselineOffset: 12,
    });

    assert.ok(noOffset !== null && withOffset !== null);

    // Tangent is along +X (dx=300, dy=0).
    // Normal (-T_y, T_x) is (0, 1), i.e. pointing down (+Y).
    for (let i = 0; i < noOffset.glyphs.length; i++) {
      assert.equal(noOffset.glyphs[i].y, 300);
      assert.equal(withOffset.glyphs[i].y, 312);
    }
  });

  it('automatically derives guide baselines from linear and areal terrain features', () => {
    // Linear river feature
    const riverFeat: MapTerrainFeature = {
      id: 'river_1',
      name: 'رود زروان',
      type: 'river',
      points: [
        { x: 50, y: 100 },
        { x: 150, y: 120 },
        { x: 250, y: 110 },
      ],
    };
    const riverSpline = deriveFeatureGuideSpline(riverFeat);
    assert.ok(riverSpline !== null && riverSpline.length === 3);

    // Areal lake feature
    const lakeFeat: MapTerrainFeature = {
      id: 'lake_1',
      name: 'Lake Firouzeh',
      type: 'lake',
      polygon: [
        { x: 100, y: 100 },
        { x: 300, y: 100 },
        { x: 300, y: 200 },
        { x: 100, y: 200 },
      ],
    };
    const lakeSpline = deriveFeatureGuideSpline(lakeFeat);
    assert.ok(lakeSpline !== null && lakeSpline.length >= 2);
    assert.ok(lakeSpline[0].x < lakeSpline[lakeSpline.length - 1].x);
  });
});
