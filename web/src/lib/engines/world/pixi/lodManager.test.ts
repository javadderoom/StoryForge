import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCounterScale,
  getDynamicTextResolution,
  getLODTier,
  getLODTierName,
  getPlacementLODTier,
  getRouteLODTier,
  getSettlementLODTier,
  getTerrainLabelLODTier,
  isCandidateVisibleAtLOD,
  isElementVisibleAtZoom,
  LOD_THRESHOLDS,
} from './lodManager';
import type { MapHitCandidate } from '../mapHitTest';

describe('lodManager — Google Maps-Style LOD Architecture', () => {
  it('correctly maps camera zoom to the 4 semantic LOD tiers', () => {
    // Continental Tier 1 (< 0.55)
    assert.equal(getLODTier(0.25), 1);
    assert.equal(getLODTier(0.54), 1);

    // Regional Tier 2 (0.55 <= zoom < 1.0)
    assert.equal(getLODTier(0.55), 2);
    assert.equal(getLODTier(0.8), 2);
    assert.equal(getLODTier(0.99), 2);

    // Provincial Tier 3 (1.0 <= zoom < 1.75)
    assert.equal(getLODTier(1.0), 3);
    assert.equal(getLODTier(1.4), 3);
    assert.equal(getLODTier(1.74), 3);

    // Tactical Tier 4 (>= 1.75)
    assert.equal(getLODTier(1.75), 4);
    assert.equal(getLODTier(2.5), 4);
    assert.equal(getLODTier(4.0), 4);
  });

  it('provides localized human-readable tier names', () => {
    assert.equal(getLODTierName(1, false), 'Continental View');
    assert.equal(getLODTierName(1, true), 'نمای قاره‌ای');

    assert.equal(getLODTierName(2, false), 'Regional View');
    assert.equal(getLODTierName(3, false), 'Provincial View');
    assert.equal(getLODTierName(4, false), 'Tactical View');
  });

  it('correctly categorizes settlements into LOD tiers', () => {
    assert.equal(getSettlementLODTier('capital'), 1);
    assert.equal(getSettlementLODTier('stronghold'), 2);
    assert.equal(getSettlementLODTier('fortress'), 2);
    assert.equal(getSettlementLODTier('citadel'), 2);
    assert.equal(getSettlementLODTier('town'), 3);
    assert.equal(getSettlementLODTier('village'), 3);
    assert.equal(getSettlementLODTier('dungeon'), 3);
    assert.equal(getSettlementLODTier(null), 3);
  });

  it('correctly categorizes routes and terrain labels into LOD tiers', () => {
    assert.equal(getRouteLODTier('highway'), 2);
    assert.equal(getRouteLODTier('caravan'), 2);
    assert.equal(getRouteLODTier('sea_lane'), 2);
    assert.equal(getRouteLODTier('road'), 3);
    assert.equal(getRouteLODTier('trail'), 3);

    assert.equal(getTerrainLabelLODTier('mountain_range'), 1);
    assert.equal(getTerrainLabelLODTier('ocean'), 1);
    assert.equal(getTerrainLabelLODTier('continent'), 1);
    assert.equal(getTerrainLabelLODTier('river'), 2);
    assert.equal(getTerrainLabelLODTier('desert'), 2);
    assert.equal(getTerrainLabelLODTier('highland'), 2);
    assert.equal(getTerrainLabelLODTier('forest'), 3);
    assert.equal(getTerrainLabelLODTier('lake'), 3);
  });

  it('enforces selection exemption rule so selected entities are always visible', () => {
    // At Continental zoom (0.3x), a minor town (Tier 3) is normally hidden
    assert.equal(isElementVisibleAtZoom(3, 0.3, false), false);
    // But when selected, it is guaranteed visible
    assert.equal(isElementVisibleAtZoom(3, 0.3, true), true);

    // Capital is visible at Continental zoom even if unselected
    assert.equal(isElementVisibleAtZoom(1, 0.3, false), true);
  });

  it('calculates counter-scaling to prevent pins from ballooning on zoom-in', () => {
    const scaleAt1x = calculateCounterScale(1.0);
    assert.equal(scaleAt1x, 1.0);

    // Zoomed in at 4x, scale shrinks to ~0.5 so screen size remains stable (~12-18px)
    const scaleAt4x = calculateCounterScale(4.0);
    assert.equal(scaleAt4x, 0.5);

    // Zoomed out at 0.25x, counter-scale expands (clamped to maxScale = 1.6)
    const scaleAtQuarter = calculateCounterScale(0.25);
    assert.equal(scaleAtQuarter, 1.6);
  });

  it('allocates dynamic text resolution for retina-crisp rendering on zoom-in', () => {
    // At 1x zoom, resolution is at least 1.0
    const res1x = getDynamicTextResolution(1.0);
    assert.ok(res1x >= 1.0);

    // At 3x zoom, resolution increases to prevent pixelation (clamped to 3.5 max)
    const res3x = getDynamicTextResolution(3.0);
    assert.ok(res3x >= 2.0 && res3x <= 3.5);
  });

  it('filters hit-test candidates by LOD tier to prevent clicks on invisible items', () => {
    const minorLocationCandidate: MapHitCandidate = {
      kind: 'location',
      id: 'loc_village',
      location: {
        id: 'loc_village',
        name: 'Little Hamlet',
        category: 'village',
        coordinates: { x: 100, y: 100 },
      } as any,
    };

    const capitalCandidate: MapHitCandidate = {
      kind: 'location',
      id: 'loc_capital',
      location: {
        id: 'loc_capital',
        name: 'Grand Imperial City',
        category: 'capital',
        coordinates: { x: 200, y: 200 },
      } as any,
    };

    const waypointCandidate: MapHitCandidate = {
      kind: 'waypoint',
      id: 'wp_1',
      routeId: 'r_1',
      index: 0,
      point: { x: 150, y: 150 },
    };

    // At Continental Tier 1:
    assert.equal(isCandidateVisibleAtLOD(minorLocationCandidate, 1, false), false);
    assert.equal(isCandidateVisibleAtLOD(capitalCandidate, 1, false), true);
    assert.equal(isCandidateVisibleAtLOD(waypointCandidate, 1, false), false);

    // When minor village is selected, it becomes pickable even at Tier 1:
    assert.equal(isCandidateVisibleAtLOD(minorLocationCandidate, 1, true), true);

    // At Provincial Tier 3:
    assert.equal(isCandidateVisibleAtLOD(minorLocationCandidate, 3, false), true);
    assert.equal(isCandidateVisibleAtLOD(waypointCandidate, 3, false), false);

    // At Tactical Tier 4:
    assert.equal(isCandidateVisibleAtLOD(waypointCandidate, 4, false), true);
  });
});
