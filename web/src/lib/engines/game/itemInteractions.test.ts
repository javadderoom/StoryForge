import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildItemInteractionProfile,
  buildEquippedItemProfiles,
  formatItemInteractionsForPrompt,
} from './itemInteractions';
import { PlayerState } from '@/lib/types/gameplay';

describe('Item Interactions & Capabilities Engine', () => {
  it('derives authentic interaction profile and forbidden misuses for desert survival relics', () => {
    const relic = {
      id: 'art_salt_bead',
      name: 'مهرهٔ تراش‌خوردهٔ نمک فیروزه',
      slot: 'relic' as const,
      powers: ['دافع عطش و سراب در مسیرهای کویری'],
      description: 'تکه‌ای صیقلی از بلور نمک فیروزهٔ باختر متصل به غلاف شمشیر؛ دافع عطش و باطل‌کنندهٔ سراب.',
    };

    const profileFa = buildItemInteractionProfile(relic.id, relic, false);
    assert.equal(profileFa.name, 'مهرهٔ تراش‌خوردهٔ نمک فیروزه');
    assert.ok(profileFa.primaryPurpose.includes('کویر'));
    assert.ok(profileFa.validInteractions.some((v) => v.includes('تشنگی') || v.includes('عطش')));
    assert.ok(profileFa.forbiddenMisuses.some((f) => f.includes('سنگریزه برای پرتاب')));
    assert.equal(profileFa.passiveBonus?.value, 3);

    const profileEn = buildItemInteractionProfile(relic.id, relic, true);
    assert.ok(profileEn.primaryPurpose.includes('survival'));
    assert.ok(profileEn.forbiddenMisuses.some((f) => f.includes('diversion pebble')));
    assert.equal(profileEn.passiveBonus?.value, 3);
  });

  it('derives interaction profile for defensive shields with kinetic protection and shield bash', () => {
    const shield = {
      id: 'item_wood_shield',
      name: 'سپر چوبی بارانداز',
      type: 'shield' as const,
      slot: 'off_hand',
      description: 'سپر محکم چوبی برای مهار ضربات و پرتابه‌ها',
      quantity: 1,
    };

    const profile = buildItemInteractionProfile(shield, undefined, false);
    assert.equal(profile.slot, 'off_hand');
    assert.ok(profile.validInteractions.some((v) => v.includes('سنگر گرفتن')));
    assert.ok(profile.validInteractions.some((v) => v.includes('Shield Bash') || v.includes('کوبیدن لبه')));
    assert.equal(profile.passiveBonus?.value, 3);
  });

  it('buildEquippedItemProfiles extracts profiles for all actively equipped items', () => {
    const playerState: PlayerState = {
      characterName: 'Barzin',
      archetypeName: 'Vanguard',
      stats: { might: 12 },
      resources: { hp: 30 },
      inventory: [
        {
          id: 'sh_wood',
          name: 'سپر چوبی بارانداز',
          type: 'shield',
          quantity: 1,
          description: 'A round shield',
        },
      ],
      equipment: {
        offHand: 'sh_wood',
        relic: 'art_salt_bead',
      },
      discoveredLocationIds: ['loc_quay'],
      relationships: {},
      activeQuestIds: [],
      completedQuestIds: [],
      currentLocationId: 'loc_quay',
    };

    const story = {
      worldBible: {
        artifacts: [
          {
            id: 'art_salt_bead',
            name: 'مهرهٔ نمک فیروزه',
            slot: 'relic',
            powers: ['دافع عطش و سراب در مسیرهای کویری'],
            description: 'یادگار بقا در دشت و دافع عطش',
          },
        ],
      },
    };

    const profiles = buildEquippedItemProfiles(playerState, story, false);
    assert.equal(profiles.length, 2);

    const shieldProfile = profiles.find((p) => p.name.includes('سپر'));
    assert.ok(shieldProfile);
    assert.equal(shieldProfile?.passiveBonus?.value, 3);

    const relicProfile = profiles.find((p) => p.name.includes('مهره'));
    assert.ok(relicProfile);
    assert.equal(relicProfile?.passiveBonus?.value, 3);
  });

  it('formatItemInteractionsForPrompt outputs structured catalog with forbidden misuses and valid interactions', () => {
    const relic = {
      id: 'art_salt_bead',
      name: 'مهرهٔ تراش‌خوردهٔ نمک فیروزه',
      slot: 'relic' as const,
      powers: ['دافع عطش و سراب'],
      description: 'دافع عطش و سراب',
    };
    const profile = buildItemInteractionProfile(relic.id, relic, false);
    const catalog = formatItemInteractionsForPrompt([profile], false);

    assert.ok(catalog.includes('کاتالوگ تعاملات تاکتیکی تجهیزات و عتیقه‌های همراه'));
    assert.ok(catalog.includes('مهرهٔ تراش‌خوردهٔ نمک فیروزه'));
    assert.ok(catalog.includes('ممنوعیت‌های قطعی'));
    assert.ok(catalog.includes('تعاملات معتبر تاکتیکی'));
    assert.ok(catalog.includes('اثر مکانیکی پدافندی/پایدار'));

    const catalogEn = formatItemInteractionsForPrompt([buildItemInteractionProfile(relic.id, relic, true)], true);
    assert.ok(catalogEn.includes('[EQUIPPED GEAR & ARTIFACT INTERACTION CATALOGUE]'));
    assert.ok(catalogEn.includes('STRICTLY FORBIDDEN MISUSES'));
    assert.ok(catalogEn.includes('Valid Tactical Interactions'));
  });
});
