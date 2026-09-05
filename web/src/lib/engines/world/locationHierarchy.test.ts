import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { WorldLocation, WorldBible } from '@/lib/types/world';
import type { PlayerState } from '@/lib/types/gameplay';
import type { RPGSystemSchema } from '@/lib/types/rpg';
import {
  getLocationAncestry,
  getDescendantLocationIds,
  getLocationBreadcrumb,
} from '@/lib/types/world';
import { ActionValidator } from '@/lib/engines/validator/ActionValidator';
import { pruneWorldBibleToScope } from '@/lib/engines/narrative/worldContext';

describe('Location Hierarchy — Multi-tier Parent/Grandparent Ancestry', () => {
  const sampleLocations: WorldLocation[] = [
    {
      id: 'loc_realm',
      name: 'قاره خورشید کهن',
      region: 'خاور میانه باستان',
      category: 'wilderness',
      dangerLevel: 3,
      connectedLocationIds: [],
      atmosphere: 'دشت‌های بی‌کران و کوه‌های افسانه‌ای',
      description: 'سرزمین مادری تمام تمدن‌های نخستین',
    },
    {
      id: 'loc_desert',
      name: 'کویر زروان',
      region: 'قاره خورشید کهن',
      parentLocationId: 'loc_realm',
      category: 'wilderness',
      dangerLevel: 4,
      connectedLocationIds: ['loc_mountains'],
      atmosphere: 'شن‌های سوزان و بادهای داغ روزگار',
      description: 'دریایی بی‌پایان از رمل‌های سرخ',
    },
    {
      id: 'loc_city',
      name: 'شهر فیروزه',
      region: 'کویر زروان',
      parentLocationId: 'loc_desert',
      category: 'settlement',
      dangerLevel: 2,
      connectedLocationIds: [],
      atmosphere: 'دیوارهای سپید و فواره‌های بلورین',
      description: 'واحه بزرگ بازرگانان و کیمیاگران',
    },
    {
      id: 'loc_citadel',
      name: 'ارگ یاقوت',
      region: 'شهر فیروزه',
      parentLocationId: 'loc_city',
      category: 'stronghold',
      dangerLevel: 2,
      connectedLocationIds: [],
      atmosphere: 'کاخ‌های بلند با کاشی‌های لاجوردی',
      description: 'مقر صدراعظم و بارگاه فرمانروایی',
    },
    {
      id: 'loc_vault',
      name: 'سرداب اسناد مهروموم',
      region: 'ارگ یاقوت',
      parentLocationId: 'loc_citadel',
      category: 'dungeon',
      dangerLevel: 3,
      connectedLocationIds: [],
      atmosphere: 'تاریکی نمناک و عطر کافور کهن',
      description: 'مخزن طومارهای محرمانه پادشاهی',
    },
    {
      id: 'loc_mountains',
      name: 'کوه‌های سر به فلک کشیده',
      region: 'قاره خورشید کهن',
      parentLocationId: 'loc_realm',
      category: 'wilderness',
      dangerLevel: 4,
      connectedLocationIds: ['loc_desert'],
      atmosphere: 'صخره‌های یخ‌بسته',
      description: 'مرز شمالی قاره',
    },
  ];

  it('resolves recursive ancestry across 4 tiers (parent, grandparent, great-grandparent)', () => {
    const ancestry = getLocationAncestry(sampleLocations, 'loc_vault');
    assert.equal(ancestry.length, 4);
    assert.equal(ancestry[0].id, 'loc_citadel'); // Parent
    assert.equal(ancestry[1].id, 'loc_city'); // Grandparent
    assert.equal(ancestry[2].id, 'loc_desert'); // Great-grandparent
    assert.equal(ancestry[3].id, 'loc_realm'); // Great-great-grandparent
  });

  it('returns an empty array for root locations with no parent', () => {
    const ancestry = getLocationAncestry(sampleLocations, 'loc_realm');
    assert.equal(ancestry.length, 0);
  });

  it('handles cyclical parentLocationId chains safely without infinite loops', () => {
    const cycleLocations: WorldLocation[] = [
      {
        id: 'loc_a',
        name: 'A',
        region: 'Test',
        parentLocationId: 'loc_b',
        dangerLevel: 1,
        connectedLocationIds: [],
        atmosphere: '',
        description: '',
      },
      {
        id: 'loc_b',
        name: 'B',
        region: 'Test',
        parentLocationId: 'loc_c',
        dangerLevel: 1,
        connectedLocationIds: [],
        atmosphere: '',
        description: '',
      },
      {
        id: 'loc_c',
        name: 'C',
        region: 'Test',
        parentLocationId: 'loc_a', // Cycle back to A
        dangerLevel: 1,
        connectedLocationIds: [],
        atmosphere: '',
        description: '',
      },
    ];

    const ancestry = getLocationAncestry(cycleLocations, 'loc_a');
    // Traverses B, C, and terminates before re-visiting A
    assert.equal(ancestry.length, 2);
    assert.equal(ancestry[0].id, 'loc_b');
    assert.equal(ancestry[1].id, 'loc_c');
  });

  it('generates a clean breadcrumb representation from root to leaf', () => {
    const breadcrumb = getLocationBreadcrumb(sampleLocations, 'loc_vault');
    assert.equal(
      breadcrumb,
      'قاره خورشید کهن > کویر زروان > شهر فیروزه > ارگ یاقوت > سرداب اسناد مهروموم'
    );
  });

  it('finds all recursive descendant IDs for cycle prevention', () => {
    const descendants = getDescendantLocationIds(sampleLocations, 'loc_desert');
    assert.ok(descendants.has('loc_city'));
    assert.ok(descendants.has('loc_citadel'));
    assert.ok(descendants.has('loc_vault'));
    assert.ok(!descendants.has('loc_realm'));
    assert.ok(!descendants.has('loc_mountains'));
  });

  it('allows travel between direct parent and child locations in ActionValidator', () => {
    const dummyWorld: WorldBible = {
      worldId: 'wb_test',
      worldName: 'Test World',
      summary: '',
      themeNotes: '',
      laws: [],
      factions: [],
      locations: sampleLocations,
      npcs: [],
      timeline: [],
      artifacts: [],
      bestiary: [],
      religions: [],
      dramaBonds: [],
    };

    // Player in Desert travels to City (child)
    const stateInDesert: PlayerState = {
      currentLocationId: 'loc_desert',
      inventory: [],
      stats: {},
      resources: {},
      equipment: {},
      discoveredLocationIds: ['loc_desert'],
      relationships: {},
      activeQuestIds: [],
      completedQuestIds: [],
    };

    const dummyRpg = { stats: [] } as unknown as RPGSystemSchema;

    const resEnterCity = ActionValidator.validateAction('سفر به شهر فیروزه', stateInDesert, dummyWorld, dummyRpg);
    assert.equal(resEnterCity.isValid, true);

    // Player in City travels back out to Desert (parent)
    const stateInCity: PlayerState = {
      currentLocationId: 'loc_city',
      inventory: [],
      stats: {},
      resources: {},
      equipment: {},
      discoveredLocationIds: ['loc_city'],
      relationships: {},
      activeQuestIds: [],
      completedQuestIds: [],
    };

    const resExitToDesert = ActionValidator.validateAction('حرکت به کویر زروان', stateInCity, dummyWorld, dummyRpg);
    assert.equal(resExitToDesert.isValid, true);

    // Unconnected non-ancestor location is rejected
    const resGoToMountains = ActionValidator.validateAction('سفر به کوه‌های سر به فلک کشیده', stateInCity, dummyWorld, dummyRpg);
    assert.equal(resGoToMountains.isValid, false);
    assert.ok(resGoToMountains.rejectionReason?.includes('not directly reachable'));
  });

  it('retains parent and grandparent in active scope during pruneWorldBibleToScope', () => {
    const dummyWorld: WorldBible = {
      worldId: 'wb_test',
      worldName: 'Test World',
      summary: '',
      themeNotes: '',
      laws: [],
      factions: [],
      locations: sampleLocations,
      npcs: [],
      timeline: [],
      artifacts: [],
      bestiary: [],
      religions: [],
      dramaBonds: [],
    };

    // Scene is active only at the Vault (child)
    const pruned = pruneWorldBibleToScope(dummyWorld, {
      scopeTier: 'street',
      locationIds: ['loc_vault'],
    });

    const keptLocationIds = new Set((pruned.locations || []).map((l) => l.id));
    // Vault itself
    assert.ok(keptLocationIds.has('loc_vault'));
    // Parent Citadel
    assert.ok(keptLocationIds.has('loc_citadel'));
    // Grandparent City
    assert.ok(keptLocationIds.has('loc_city'));
    // Great-grandparent Desert
    assert.ok(keptLocationIds.has('loc_desert'));
    // Great-great-grandparent Realm
    assert.ok(keptLocationIds.has('loc_realm'));
  });
});
