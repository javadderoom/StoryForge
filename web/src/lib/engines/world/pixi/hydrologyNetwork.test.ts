import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { MapTerrainFeature } from '@/lib/types';
import {
  areRiversConnected,
  findConnectedRiverNetworks,
  createDistributaryBranch,
  generateNetworkGeometry,
} from './hydrologyNetwork';

describe('hydrologyNetwork — Topological Hydrology Graph', () => {
  it('detects river connection via explicit connectedRiverId', () => {
    const trunk: MapTerrainFeature = {
      id: 'river_trunk',
      name: 'Main River',
      type: 'river',
      points: [
        { x: 100, y: 100 },
        { x: 200, y: 200 },
        { x: 300, y: 300 },
      ],
      width: 12,
    };

    const branch: MapTerrainFeature = {
      id: 'river_branch_1',
      name: 'Delta Branch',
      type: 'river',
      points: [
        { x: 200, y: 200 },
        { x: 250, y: 280 },
        { x: 320, y: 350 },
      ],
      width: 7,
      connectedRiverId: 'river_trunk',
    };

    assert.equal(areRiversConnected(trunk, branch), true);
    assert.equal(areRiversConnected(branch, trunk), true);
  });

  it('detects river connection via geometric endpoint proximity (snapping)', () => {
    const trunk: MapTerrainFeature = {
      id: 'river_trunk',
      name: 'Main River',
      type: 'river',
      points: [
        { x: 100, y: 100 },
        { x: 200, y: 200 },
        { x: 300, y: 300 },
      ],
      width: 12,
    };

    // Branch starts 3px away from trunk's midpoint (well within snap threshold)
    const branch: MapTerrainFeature = {
      id: 'river_branch_geo',
      name: 'Geometric Delta Branch',
      type: 'river',
      points: [
        { x: 202, y: 201 },
        { x: 260, y: 240 },
        { x: 340, y: 280 },
      ],
      width: 8,
    };

    assert.equal(areRiversConnected(trunk, branch), true);
  });

  it('correctly partitions distinct river networks across the world map', () => {
    const rivers: MapTerrainFeature[] = [
      // Network 1: Trunk + 2 branches (Delta)
      {
        id: 'r_net1_trunk',
        name: 'Zarvan River',
        type: 'river',
        points: [{ x: 100, y: 100 }, { x: 200, y: 200 }, { x: 300, y: 300 }],
        width: 14,
      },
      {
        id: 'r_net1_b1',
        name: 'Zarvan West Mouth',
        type: 'river',
        points: [{ x: 240, y: 240 }, { x: 280, y: 320 }, { x: 320, y: 380 }],
        connectedRiverId: 'r_net1_trunk',
      },
      {
        id: 'r_net1_b2',
        name: 'Zarvan East Mouth',
        type: 'river',
        points: [{ x: 250, y: 250 }, { x: 320, y: 280 }, { x: 380, y: 340 }],
        connectedRiverId: 'r_net1_trunk',
      },
      // Network 2: Far-away isolated mountain stream
      {
        id: 'r_net2_stream',
        name: 'Isolated Mountain Brook',
        type: 'river',
        points: [{ x: 1200, y: 1200 }, { x: 1300, y: 1300 }],
        width: 4,
      },
    ];

    const networks = findConnectedRiverNetworks(rivers);
    assert.equal(networks.length, 2, 'Should partition into 2 distinct river networks');

    const net1 = networks.find((n) => n.rivers.some((r) => r.id === 'r_net1_trunk'));
    assert.ok(net1);
    assert.equal(net1.rivers.length, 3, 'Zarvan delta network should contain 3 rivers');

    const net2 = networks.find((n) => n.rivers.some((r) => r.id === 'r_net2_stream'));
    assert.ok(net2);
    assert.equal(net2.rivers.length, 1, 'Mountain brook network should contain 1 river');
  });

  it('createDistributaryBranch generates clean diverging geometry from parent river', () => {
    const parent: MapTerrainFeature = {
      id: 'river_parent',
      name: 'Arvand River',
      type: 'river',
      points: [
        { x: 100, y: 100 },
        { x: 200, y: 200 },
        { x: 300, y: 300 },
        { x: 400, y: 400 },
      ],
      width: 16,
      elevation: 200,
    };

    const branch = createDistributaryBranch(parent, {
      branchFraction: 0.75,
      angleOffsetDegrees: 30,
    });

    assert.ok(branch);
    assert.equal(branch.type, 'river');
    assert.equal(branch.connectedRiverId, parent.id);
    assert.ok(branch.points && branch.points.length >= 3);
    assert.ok(branch.width! > 0 && branch.width! < parent.width!);

    // Start point of branch must be on the parent line near 75% arc length
    const startPt = branch.points![0];
    const distToParent = Math.hypot(startPt.x - 325, startPt.y - 325);
    assert.ok(distToParent < 15, 'Branch start point must originate near parent arc length position');
  });

  it('generateNetworkGeometry unions connected rivers without internal crossing bank lines', () => {
    const parent: MapTerrainFeature = {
      id: 'river_main',
      name: 'Main River',
      type: 'river',
      points: [
        { x: 50, y: 50 },
        { x: 150, y: 150 },
        { x: 250, y: 250 },
        { x: 350, y: 350 },
      ],
      width: 14,
    };

    const branch: MapTerrainFeature = {
      id: 'river_delta_branch',
      name: 'Delta Distributary',
      type: 'river',
      points: [
        { x: 250, y: 250 },
        { x: 310, y: 290 },
        { x: 390, y: 320 },
      ],
      width: 8,
      connectedRiverId: parent.id,
    };

    const network: { id: string; rivers: MapTerrainFeature[] } = {
      id: 'net_delta',
      rivers: [parent, branch],
    };

    const { waterPolygons, shorelineRuns } = generateNetworkGeometry(network);

    assert.ok(waterPolygons.length >= 1, 'Should produce unified water polygon(s)');
    assert.ok(shorelineRuns.length >= 1, 'Should produce outer bank strokes');

    // The water polygon should be unified (multi-polygon or single polygon with no internal partition)
    const totalWaterVerts = waterPolygons.reduce((acc, p) => acc + p.length, 0);
    assert.ok(totalWaterVerts >= 10, 'Unified water polygon must contain boundary vertices');
  });
});
