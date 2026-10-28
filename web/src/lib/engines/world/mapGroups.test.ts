import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createMapGroup,
  ungroupMapGroup,
  setMapGroupMode,
  setMapGroupLocation,
  updateMapGroup,
  findGroupForRef,
  areRefsInSameGroup,
  expandSelectionToGroups,
  type MapGroupSource,
} from './mapGroups';
import type { MapTerrainFeature, MapEntityPlacement, WorldLocation } from '@/lib/types/world';

describe('mapGroups — Universal Map Grouping: Unified Story Entity vs. Folder Group', () => {
  const riverMain: MapTerrainFeature = {
    id: 'terr_river_karun',
    name: 'رودخانه کارون',
    type: 'river',
    locationId: 'loc_karun_river',
    points: [{ x: 100, y: 100 }, { x: 300, y: 300 }],
    width: 14,
  };

  const branchEast: MapTerrainFeature = {
    id: 'terr_branch_east',
    name: 'انشعاب شرقی',
    type: 'river',
    connectedRiverId: 'terr_river_karun',
    points: [{ x: 300, y: 300 }, { x: 400, y: 350 }],
    width: 8,
  };

  const branchWest: MapTerrainFeature = {
    id: 'terr_branch_west',
    name: 'انشعاب غربی',
    type: 'river',
    connectedRiverId: 'terr_river_karun',
    points: [{ x: 300, y: 300 }, { x: 250, y: 400 }],
    width: 8,
  };

  const outpostPin: MapEntityPlacement = {
    id: 'pin_watchtower',
    entityId: 'npc_guard',
    entityType: 'npc',
    x: 320,
    y: 310,
  };

  const fortressLoc: WorldLocation = {
    id: 'loc_fortress',
    name: 'قلعه رودخانه',
    description: 'دژ دیده‌بانی',
    region: 'خوزستان',
    dangerLevel: 2,
    connectedLocationIds: [],
    atmosphere: 'سنگر نظامی',
  };

  it('creates a unified_entity group that synchronizes locationId and suppresses secondary labels', () => {
    const source: MapGroupSource = {
      terrainFeatures: [riverMain, branchEast, branchWest],
      placements: [outpostPin],
      groups: [],
    };

    const refs = [
      { kind: 'terrain' as const, id: riverMain.id },
      { kind: 'terrain' as const, id: branchEast.id },
      { kind: 'terrain' as const, id: branchWest.id },
    ];

    const { updatedSource, group } = createMapGroup(source, refs, {
      name: 'حوضه کارون و دلتا',
      mode: 'unified_entity',
    });

    assert.equal(group.mode, 'unified_entity');
    assert.equal(group.locationId, 'loc_karun_river', 'Should inherit parent river locationId');
    assert.equal(group.memberRefs.length, 3);
    assert.equal(updatedSource.groups?.length, 1);

    // All members now have groupId and locationId
    const eBranch = updatedSource.terrainFeatures?.find((f) => f.id === branchEast.id);
    const wBranch = updatedSource.terrainFeatures?.find((f) => f.id === branchWest.id);
    const mRiver = updatedSource.terrainFeatures?.find((f) => f.id === riverMain.id);

    assert.equal(eBranch?.groupId, group.id);
    assert.equal(eBranch?.locationId, 'loc_karun_river', 'Delta branch must inherit canonical locationId');
    assert.equal(eBranch?.labelConfig?.enabled, false, 'Secondary branch label must be suppressed');

    assert.equal(wBranch?.groupId, group.id);
    assert.equal(wBranch?.locationId, 'loc_karun_river');
    assert.equal(wBranch?.labelConfig?.enabled, false);

    assert.equal(mRiver?.groupId, group.id);
    assert.equal(mRiver?.locationId, 'loc_karun_river');
  });

  it('creates a folder group without overriding individual member identities', () => {
    const source: MapGroupSource = {
      terrainFeatures: [riverMain],
      locations: [fortressLoc],
      placements: [outpostPin],
      groups: [],
    };

    const refs = [
      { kind: 'terrain' as const, id: riverMain.id },
      { kind: 'location' as const, id: fortressLoc.id },
      { kind: 'placement' as const, id: outpostPin.id },
    ];

    const { updatedSource, group } = createMapGroup(source, refs, {
      name: 'پوشه منطقه نظامی',
      mode: 'folder',
    });

    assert.equal(group.mode, 'folder');
    assert.equal(group.locationId, undefined, 'Folder groups do not enforce a single location');

    const updatedLoc = updatedSource.locations?.find((l) => l.id === fortressLoc.id);
    const updatedRiver = updatedSource.terrainFeatures?.find((f) => f.id === riverMain.id);

    assert.equal(updatedLoc?.groupId, group.id);
    assert.equal(updatedRiver?.groupId, group.id);
    assert.equal(updatedRiver?.locationId, 'loc_karun_river', 'Keeps original distinct locationId');
  });

  it('losslessly ungroups a group, clearing groupId without affecting geometry or data', () => {
    const source: MapGroupSource = {
      terrainFeatures: [riverMain, branchEast],
      groups: [],
    };

    const refs = [
      { kind: 'terrain' as const, id: riverMain.id },
      { kind: 'terrain' as const, id: branchEast.id },
    ];

    const { updatedSource: groupedSource, group } = createMapGroup(source, refs, {
      name: 'کارون و دلتا',
      mode: 'unified_entity',
    });

    assert.equal(groupedSource.groups?.length, 1);

    const { updatedSource: ungroupedSource } = ungroupMapGroup(groupedSource, group.id);

    assert.equal(ungroupedSource.groups?.length, 0, 'Group must be removed');
    const uMain = ungroupedSource.terrainFeatures?.find((f) => f.id === riverMain.id);
    const uBranch = ungroupedSource.terrainFeatures?.find((f) => f.id === branchEast.id);

    assert.equal(uMain?.groupId, undefined, 'groupId must be cleared');
    assert.equal(uBranch?.groupId, undefined, 'groupId must be cleared');
    assert.deepEqual(uMain?.points, riverMain.points, 'Points and geometry must stay 100% intact');
    assert.deepEqual(uBranch?.points, branchEast.points, 'Points must stay intact');
  });

  it('setMapGroupLocation cascades the new locationId to all members in unified_entity mode', () => {
    const source: MapGroupSource = {
      terrainFeatures: [riverMain, branchEast],
      groups: [],
    };

    const refs = [
      { kind: 'terrain' as const, id: riverMain.id },
      { kind: 'terrain' as const, id: branchEast.id },
    ];

    const { updatedSource, group } = createMapGroup(source, refs, {
      name: 'کارون',
      mode: 'unified_entity',
    });

    const { updatedSource: reLinkedSource, group: reLinkedGroup } = setMapGroupLocation(
      updatedSource,
      group.id,
      'loc_new_grand_delta'
    );

    assert.equal(reLinkedGroup?.locationId, 'loc_new_grand_delta');
    const uMain = reLinkedSource.terrainFeatures?.find((f) => f.id === riverMain.id);
    const uBranch = reLinkedSource.terrainFeatures?.find((f) => f.id === branchEast.id);

    assert.equal(uMain?.locationId, 'loc_new_grand_delta');
    assert.equal(uBranch?.locationId, 'loc_new_grand_delta');
  });

  it('areRefsInSameGroup and expandSelectionToGroups correctly identify and expand group members', () => {
    const source: MapGroupSource = {
      terrainFeatures: [riverMain, branchEast],
      groups: [],
    };

    const refs = [
      { kind: 'terrain' as const, id: riverMain.id },
      { kind: 'terrain' as const, id: branchEast.id },
    ];

    const { group } = createMapGroup(source, refs, {
      name: 'کارون',
      mode: 'unified_entity',
    });

    const groups = [group];

    // Selecting just the branch should detect it belongs to the group
    const found = findGroupForRef(groups, { kind: 'terrain', id: branchEast.id });
    assert.equal(found?.id, group.id);

    // areRefsInSameGroup
    assert.ok(areRefsInSameGroup(groups, refs));
    assert.equal(areRefsInSameGroup(groups, [{ kind: 'terrain', id: riverMain.id }, { kind: 'terrain', id: 'other' }]), null);

    // expandSelectionToGroups
    const expanded = expandSelectionToGroups([{ kind: 'terrain', id: branchEast.id }], groups);
    assert.equal(expanded.length, 2, 'Should expand to both riverMain and branchEast');
    assert.ok(expanded.some((r) => r.id === riverMain.id));
    assert.ok(expanded.some((r) => r.id === branchEast.id));
  });
});
