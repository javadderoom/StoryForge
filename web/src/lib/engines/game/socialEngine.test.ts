import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { NPCDossier } from '@/lib/types/world';
import {
  isPressureAction,
  isSocialAction,
  resolveUniquePresentNpc,
} from './socialEngine';

function npc(overrides: Partial<NPCDossier>): NPCDossier {
  return {
    id: 'npc_x',
    name: 'X',
    title: '',
    currentLocationId: 'loc_a',
    personalityTraits: [],
    speechStyle: '',
    goals: [],
    secrets: [],
    initialTrust: 0,
    ...overrides,
  } as NPCDossier;
}

const borzou = npc({ id: 'npc_borzou', name: 'Borzou Sangtarash', currentLocationId: 'loc_harbor' });
const sohrab = npc({ id: 'npc_sohrab', name: 'Sohrab Choob-Dast', currentLocationId: 'loc_harbor' });

describe('Plan 17 — social deal vocabulary & unique-present fallback', () => {
  it('recognizes deal-making as a positive social action (EN)', () => {
    assert.equal(isSocialAction('I accept the deal and shake hands on it'), true);
    assert.equal(isSocialAction('We seal the bargain with a handshake'), true);
    assert.equal(isSocialAction('I sign the contract with the caravan master'), true);
  });

  it('recognizes deal-making as a positive social action (FA)', () => {
    assert.equal(isSocialAction('پیشنهادش را می‌پذیرم و قرارداد را می‌بندم'), true);
    assert.equal(isSocialAction('با او توافق می‌کنم و پیمان می‌بندیم'), true);
    assert.equal(isSocialAction('قرارداد را قبول می‌کنم'), true);
  });

  it('does not mistake combat phrasing for a social beat', () => {
    assert.equal(isSocialAction('I deal a heavy blow to the bandit'), false);
    assert.equal(isSocialAction('I deal with the corpse and move on'), false);
  });

  it('keeps pressure actions out of the social lane', () => {
    assert.equal(isPressureAction('I threaten the guard and demand the truth'), true);
    assert.equal(isSocialAction('I threaten the guard and demand the truth'), false);
  });

  it('falls back to the single physically present NPC', () => {
    const target = resolveUniquePresentNpc(
      { currentLocationId: 'loc_harbor', accompanyingNpcIds: [] },
      [borzou, npc({ id: 'npc_far', name: 'Far One', currentLocationId: 'loc_far' })]
    );
    assert.equal(target?.id, 'npc_borzou');
  });

  it('returns null when two NPCs are present (the writer channel decides)', () => {
    const target = resolveUniquePresentNpc(
      { currentLocationId: 'loc_harbor', accompanyingNpcIds: [] },
      [borzou, sohrab]
    );
    assert.equal(target, null);
  });

  it('counts an accompanied NPC as present even away from their station', () => {
    const target = resolveUniquePresentNpc(
      { currentLocationId: 'loc_mine', accompanyingNpcIds: ['npc_sohrab'] },
      [sohrab, npc({ id: 'npc_local', name: 'Local Guide', currentLocationId: 'loc_mine' })]
    );
    assert.equal(target, null, 'two present NPCs stay ambiguous');
    const solo = resolveUniquePresentNpc(
      { currentLocationId: 'loc_mine', accompanyingNpcIds: ['npc_sohrab'] },
      [sohrab, npc({ id: 'npc_far', name: 'Far One', currentLocationId: 'loc_far' })]
    );
    assert.equal(solo?.id, 'npc_sohrab');
  });
});
