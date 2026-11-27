import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  findMentionedNpcs,
  resolveDepartingCaravanCompanionIds,
  resolvePersonalFirstToken,
} from './npcMatching';
import type { WorldBible, WorldNpc } from '@/lib/types/world';

describe('npcMatching — Persian role prefix & collective group safety', () => {
  const npcs: WorldNpc[] = [
    {
      id: 'npc_borzou',
      name: 'برزو سنگ تراش',
      title: '',
      role: 'تاجر',
      currentLocationId: 'loc_chah',
      personalityTraits: [],
      speechStyle: '',
      goals: [],
      secrets: [],
      initialTrust: 0,
    },
    {
      id: 'npc_radman',
      name: 'کاروان‌سالار رادمان دشت‌پیما',
      title: '',
      role: 'کاروان‌سالار',
      currentLocationId: 'loc_shakh',
      personalityTraits: [],
      speechStyle: '',
      goals: [],
      secrets: [],
      initialTrust: 5,
    },
    {
      id: 'npc_guild_zarrin',
      name: 'ساربانان شاخ زرین',
      title: '',
      role: 'گروه',
      currentLocationId: 'loc_shakh',
      personalityTraits: [],
      speechStyle: '',
      goals: [],
      secrets: [],
      initialTrust: 10,
    },
  ];

  it('ignores generic title prefixes and collective group location tokens when prose only mentions title or destination', () => {
    const openingProse = 'من برزو هستم؛ کاروان‌سالارِ این قطار. بار را به کاروانسرای شاخ زرین می‌رسانیم.';
    const matched = findMentionedNpcs(npcs, [openingProse]);
    assert.deepEqual(matched.map((n) => n.id), ['npc_borzou']);
    assert.equal(resolvePersonalFirstToken('کاروان‌سالار رادمان دشت‌پیما'), 'رادمان');
    assert.equal(resolvePersonalFirstToken('ساربانان شاخ زرین'), '');
  });

  it('matches distant titled NPCs when their personal name or full name is actually mentioned', () => {
    const matched = findMentionedNpcs(npcs, ['رادمان دروازهٔ کاروانسرا را گشود.']);
    assert.deepEqual(matched.map((n) => n.id), ['npc_radman']);
  });

  it('resolves departing caravan companions stationed at the origin stop only', () => {
    const wb = {
      locations: [],
      npcs: [
        ...npcs,
        {
          id: 'npc_maziar',
          name: 'مازیار مشک‌دار',
          title: '',
          role: 'guide',
          currentLocationId: 'loc_rabat',
          personalityTraits: [],
          speechStyle: '',
          goals: [],
          secrets: [],
          initialTrust: 0,
        },
      ],
      tradeRoutes: [
        {
          id: 'route_hiram',
          name: 'مسیر هیرام',
          originLocationId: 'loc_chah',
          destinationLocationId: 'loc_shakh',
          intermediateLocationIds: ['loc_rabat'],
          status: 'active',
          dangerLevel: 3,
          caravanMasterNpcId: 'npc_borzou',
          travelingNpcIds: ['npc_maziar'],
          commodities: [],
        },
      ],
    } as unknown as WorldBible;

    assert.deepEqual(resolveDepartingCaravanCompanionIds(wb, 'route_hiram', 'loc_chah'), ['npc_borzou']);
    assert.deepEqual(
      resolveDepartingCaravanCompanionIds(wb, 'route_hiram', 'loc_rabat', ['npc_borzou']),
      ['npc_borzou', 'npc_maziar']
    );
  });
});
