import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectSubZoneChange } from './movementEngine';
import { WorldLocation } from '../../types/world';

const location: WorldLocation = {
  id: 'loc_salt_cavern',
  name: 'Salt Cavern',
  description: 'A sprawling cavern of tessellated salt.',
  region: 'Hiram Reach',
  category: 'dungeon',
  dangerLevel: 3,
  connectedLocationIds: [],
  atmosphere: 'Cold, mineral, echoing',
  subZones: [
    {
      id: 'zone_salt_gallery',
      name: 'Salt Gallery',
      subType: 'dungeon',
      dangerLevel: 2,
      atmosphere: 'Glittering pillars',
      explorationHooks: [],
      pointsOfInterest: [],
    },
    {
      id: 'zone_dehliz_malk',
      name: 'دهلیز نمک',
      subType: 'hazard_zone',
      dangerLevel: 4,
      atmosphere: 'Rushing brine below',
      explorationHooks: [],
      pointsOfInterest: [],
    },
    {
      id: 'zone_mouth',
      name: 'Windswept Mouth',
      subType: 'sanctuary',
      dangerLevel: 1,
      atmosphere: 'Wind combed stone',
      explorationHooks: [],
      pointsOfInterest: [],
    },
  ],
  pointsOfInterest: [],
};

describe('movementEngine — Plan 15 Pillar 4 deterministic sub-zone writer', () => {
  it('enters a named EN sub-zone with an explicit motion verb', () => {
    const change = detectSubZoneChange(
      'I grip the torch and step into the Salt Gallery',
      location,
      {}
    );
    assert.ok(change);
    assert.equal(change.kind, 'enter');
    assert.equal(change.subZoneId, 'zone_salt_gallery');
    assert.match(change.note, /Salt Gallery/);
  });

  it('enters a named FA sub-zone including ZWNJ variants of the name', () => {
    const change = detectSubZoneChange(
      'به سمت دهلیزِ نمک می‌روم', // ZWNJ in می‌روم
      location,
      { isPersian: true }
    );
    assert.ok(change);
    assert.equal(change.kind, 'enter');
    assert.equal(change.subZoneId, 'zone_dehliz_malk');
    assert.match(change.note, /دهلیز نمک/);
  });

  it('ignores ambient zone mentions without a motion verb', () => {
    assert.equal(detectSubZoneChange('The Salt Gallery is said to glitter at dusk', location, {}), null);
  });

  it('never invents sub-zones absent from the World Bible', () => {
    assert.equal(
      detectSubZoneChange('I descend into the Obsidian Vault', location, {}),
      null
    );
  });

  it('returns null when the location has no sub-zones', () => {
    const flat: WorldLocation = { ...location, subZones: undefined };
    assert.equal(detectSubZoneChange('I descend into the Salt Gallery', flat, {}), null);
  });

  it('does not re-enter the zone the protagonist already occupies', () => {
    const change = detectSubZoneChange('I go deeper into the Salt Gallery', location, {
      currentSubZoneId: 'zone_salt_gallery',
    });
    assert.equal(change, null);
  });

  it('leaves the active micro-location on an explicit departure phrase', () => {
    const change = detectSubZoneChange('I climb back out of the Salt Gallery', location, {
      isPersian: false,
      currentSubZoneId: 'zone_salt_gallery',
    });
    assert.ok(change);
    assert.equal(change.kind, 'leave');
    assert.equal(change.subZoneId, undefined);
  });

  it('destination mentions without a motion verb stay no-ops (no leave, no enter)', () => {
    assert.equal(
      detectSubZoneChange('I rest facing the Windswept Mouth', location, {
        currentSubZoneId: 'zone_salt_gallery',
      }),
      null
    );
  });

  it('leave prefers a named destination over generic departure phrasing', () => {
    const change = detectSubZoneChange(
      'I step out of the Salt Gallery and enter the Windswept Mouth',
      location,
      { currentSubZoneId: 'zone_salt_gallery' }
    );
    assert.ok(change);
    assert.equal(change.kind, 'enter');
    assert.equal(change.subZoneId, 'zone_mouth');
  });

  it('does not fire leave without an active micro-location', () => {
    assert.equal(detectSubZoneChange('I exit the salt works', location, { currentSubZoneId: null }), null);
  });
});
