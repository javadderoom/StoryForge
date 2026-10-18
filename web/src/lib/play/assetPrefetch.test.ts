import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveDwellPrefetchAssets,
  prefetchDwellAssets,
  clearPrefetchCacheForTesting,
  getPrefetchedUrlsForTesting,
  DwellPrefetchInput,
} from './assetPrefetch';

describe('assetPrefetch — Plan 15 §2.3 Tier 1 Dwell-Time Asset Prefetching', () => {
  beforeEach(() => {
    clearPrefetchCacheForTesting();
  });

  const sampleLore = {
    locations: [
      {
        id: 'loc_red_gate',
        name: 'دروازه سرخ',
        imageUrl: '/images/locations/red_gate.webp',
        subZones: [{ id: 'sz_watchtower', name: 'برج دیده‌بانی' }],
      },
      {
        id: 'loc_sun_citadel',
        name: 'ارگ سنگخورشید',
        imageUrl: '/images/locations/sun_citadel.webp',
      },
      {
        id: 'loc_dark_dungeon',
        name: 'سیاه‌چال کهن',
        imageUrl: '/images/locations/dark_dungeon.webp',
      },
    ],
    npcs: [
      {
        id: 'npc_borzou',
        name: 'برزو سنگ‌تراش',
        imageUrl: '/images/npcs/borzou.webp',
      },
      {
        id: 'npc_maziar',
        name: 'مازیار مشک‌دار',
        imageUrl: '/images/npcs/maziar.webp',
      },
    ],
    bestiary: [
      {
        id: 'creature_sand_viper',
        name: 'افعی شن‌زار',
        imageUrl: '/images/bestiary/sand_viper.webp',
      },
    ],
  };

  it('derives location image and ambient track when choice mentions a location', () => {
    const input: DwellPrefetchInput = {
      currentNarrative: 'شن‌های بیابان در باد زوزه می‌کشند.',
      choices: [
        { id: 'c1', text: 'حرکت به سوی دروازه سرخ و بررسی کاروان' },
        { id: 'c2', text: 'پناه گرفتن در صخره‌ها' },
      ],
      lore: sampleLore,
    };

    const plan = deriveDwellPrefetchAssets(input);
    assert.ok(plan.imageUrls.includes('/images/locations/red_gate.webp'));
    assert.ok(!plan.imageUrls.includes('/images/locations/sun_citadel.webp'));
    assert.ok(plan.audioUrls.includes('/audio/ambient/ambient_citadel_wind.wav'));
  });

  it('derives dungeon drip ambience when dark dungeon is referenced', () => {
    const input: DwellPrefetchInput = {
      currentNarrative: 'صدای چکه‌های آب از پله‌های منتهی به سیاه‌چال کهن به گوش می‌رسد.',
      choices: [{ id: 'c1', text: 'فرود آمدن به عمق دخمه' }],
      lore: sampleLore,
    };

    const plan = deriveDwellPrefetchAssets(input);
    assert.ok(plan.imageUrls.includes('/images/locations/dark_dungeon.webp'));
    assert.ok(plan.audioUrls.includes('/audio/ambient/ambient_dungeon_drips.wav'));
  });

  it('derives NPC portraits when mentioned in narrative or present in discovered list', () => {
    const input: DwellPrefetchInput = {
      currentNarrative: 'برزو سنگ‌تراش نگاهی هوشیار به افق می‌اندازد.',
      choices: [{ id: 'c1', text: 'مشورت با ساربان' }],
      discoveredNpcs: [
        { id: 'npc_maziar', name: 'مازیار', imageUrl: '/images/npcs/maziar.webp' },
      ],
      lore: sampleLore,
    };

    const plan = deriveDwellPrefetchAssets(input);
    assert.ok(plan.imageUrls.includes('/images/npcs/borzou.webp'));
    assert.ok(plan.imageUrls.includes('/images/npcs/maziar.webp'));
  });

  it('derives creature portraits from discoveredCreature or text mentions', () => {
    const input: DwellPrefetchInput = {
      currentNarrative: 'سایه‌ای خزنده در میان سنگ‌ها جابجا شد.',
      discoveredCreature: {
        id: 'creature_sand_viper',
        name: 'افعی شن‌زار',
        imageUrl: '/images/bestiary/sand_viper.webp',
      },
      lore: sampleLore,
    };

    const plan = deriveDwellPrefetchAssets(input);
    assert.ok(plan.imageUrls.includes('/images/bestiary/sand_viper.webp'));
  });

  it('prefetchDwellAssets safely handles non-browser (Node.js) environments', () => {
    const plan = {
      imageUrls: ['/images/test.webp'],
      audioUrls: ['/audio/test.wav'],
    };

    // In Node (where window is undefined), this must be a safe no-op
    assert.doesNotThrow(() => {
      prefetchDwellAssets(plan);
    });
    assert.equal(getPrefetchedUrlsForTesting().length, 0);
  });
});
