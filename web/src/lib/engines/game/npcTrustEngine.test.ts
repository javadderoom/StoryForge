import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { NPCDossier } from '@/lib/types/world';
import {
  MAX_TRUST_CHANGES_PER_TURN,
  MAX_TRUST_DELTA_PER_TURN,
  describeTrustChange,
  isNpcPresentForTrust,
  normalizeNpcTrustChanges,
  resolveDeclaredNpcTrustChanges,
  seedTrustRelationships,
} from './npcTrustEngine';

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

const borzou = npc({
  id: 'npc_borzou',
  name: 'Borzou Sangtarash',
  currentLocationId: 'loc_harbor',
});
const sohrab = npc({
  id: 'npc_sohrab',
  name: 'Sohrab Choob-Dast',
  currentLocationId: 'loc_camp',
});
const maryam = npc({
  id: 'npc_maryam',
  name: 'مریم نمک\u200cفروش',
  currentLocationId: 'loc_harbor',
});
const ali = npc({
  id: 'npc_ali',
  // Persian "علي نمکی" with an Arabic yeh — normalized to the Persian yeh.
  name: '\u0639\u0644\u064a \u0646\u0645\u06a9\u06cc',
  currentLocationId: 'loc_harbor',
});

const harborNpcs = [borzou, sohrab, maryam, ali];

describe('Plan 17 — NPC stance authority (writer trust channel)', () => {
  it('normalizes aliases, trims, and clamps raw writer entries', () => {
    const normalized = normalizeNpcTrustChanges([
      { name: 'Borzou Sangtarash', delta: 34, evidence: 'you sealed the salt contract' },
      { npcName: 'مریم نمک فروش', trustDelta: -4, reason: 'you haggled too hard' },
      { npcName: 'Nobody', trustDelta: 0 },
      { name: 'Zeroed', trustDelta: 'not-a-number' },
    ]);

    assert.equal(normalized.length, 2);
    assert.equal(normalized[0].npcName, 'Borzou Sangtarash');
    assert.equal(normalized[0].trustDelta, MAX_TRUST_DELTA_PER_TURN);
    assert.equal(normalized[0].reason, 'you sealed the salt contract');
    assert.equal(normalized[1].trustDelta, -4);
  });

  it('resolves by id, exact name, and a unique significant name word', () => {
    const byId = resolveDeclaredNpcTrustChanges({
      declared: [{ npcId: 'npc_borzou', trustDelta: 8, reason: 'the deal is sealed' }],
      npcs: harborNpcs,
      currentLocationId: 'loc_harbor',
    });
    assert.equal(byId.length, 1);
    assert.equal(byId[0].npcId, 'npc_borzou');
    assert.equal(byId[0].npcName, 'Borzou Sangtarash');

    const byExactName = resolveDeclaredNpcTrustChanges({
      declared: [{ npcName: 'مریم نمک\u200cفروش', trustDelta: 5, reason: 'a fair bargain' }],
      npcs: harborNpcs,
      currentLocationId: 'loc_harbor',
    });
    assert.equal(byExactName[0]?.npcId, 'npc_maryam');

    const byWord = resolveDeclaredNpcTrustChanges({
      declared: [{ npcName: 'Borzou', trustDelta: 4, reason: 'shared bread' }],
      npcs: harborNpcs,
      currentLocationId: 'loc_harbor',
    });
    assert.equal(byWord[0]?.npcId, 'npc_borzou');
  });

  it('matches Persian names across ZWNJ and Arabic/Persian letter variants', () => {
    const spaced = resolveDeclaredNpcTrustChanges({
      declared: [{ npcName: 'مریم نمک فروش', trustDelta: 6, reason: 'paid fairly' }],
      npcs: harborNpcs,
      currentLocationId: 'loc_harbor',
    });
    assert.equal(spaced[0]?.npcId, 'npc_maryam');

    const aliByPersianYeh = resolveDeclaredNpcTrustChanges({
      declared: [{ npcName: 'علی نمکی', trustDelta: 3, reason: 'returned his tool' }],
      npcs: harborNpcs,
      currentLocationId: 'loc_harbor',
    });
    assert.equal(aliByPersianYeh[0]?.npcId, 'npc_ali');
  });

  it('rejects off-scene NPCs and accepts the party / caravan roster', () => {
    const absent = resolveDeclaredNpcTrustChanges({
      declared: [{ npcName: 'Sohrab Choob-Dast', trustDelta: 10, reason: 'you saved his life' }],
      npcs: harborNpcs,
      currentLocationId: 'loc_harbor',
    });
    assert.equal(absent.length, 0);

    const accompanied = resolveDeclaredNpcTrustChanges({
      declared: [{ npcName: 'Sohrab Choob-Dast', trustDelta: 10, reason: 'you saved his life' }],
      npcs: harborNpcs,
      currentLocationId: 'loc_harbor',
      accompanyingNpcIds: ['npc_sohrab'],
    });
    assert.equal(accompanied[0]?.npcId, 'npc_sohrab');

    const caravan = resolveDeclaredNpcTrustChanges({
      declared: [{ npcName: 'Sohrab Choob-Dast', trustDelta: 4, reason: 'shared the watch' }],
      npcs: harborNpcs,
      currentLocationId: 'loc_harbor',
      extraPresentNpcIds: ['npc_sohrab'],
    });
    assert.equal(caravan[0]?.npcId, 'npc_sohrab');
  });

  it('requires prose evidence (a reason) for every declared shift', () => {
    const applied = resolveDeclaredNpcTrustChanges({
      declared: [{ npcName: 'Borzou Sangtarash', trustDelta: 12 }],
      npcs: harborNpcs,
      currentLocationId: 'loc_harbor',
    });
    assert.equal(applied.length, 0);
  });

  it('merges duplicate entries and clamps the per-NPC total to ±20', () => {
    const applied = resolveDeclaredNpcTrustChanges({
      declared: [
        { npcName: 'Borzou Sangtarash', trustDelta: 14, reason: 'you sealed the deal' },
        { npcName: 'Borzou Sangtarash', trustDelta: 14, reason: 'and paid the debt' },
      ],
      npcs: harborNpcs,
      currentLocationId: 'loc_harbor',
    });
    assert.equal(applied.length, 1);
    assert.equal(applied[0].trustDelta, MAX_TRUST_DELTA_PER_TURN);

    const negative = resolveDeclaredNpcTrustChanges({
      declared: [
        { npcName: 'Borzou', trustDelta: -20, reason: 'betrayal' },
        { npcName: 'Borzou', trustDelta: -20, reason: 'and a lie' },
      ],
      npcs: harborNpcs,
      currentLocationId: 'loc_harbor',
    });
    assert.equal(negative[0].trustDelta, -MAX_TRUST_DELTA_PER_TURN);
  });

  it('caps a single scene to four stance changes', () => {
    const crowd = Array.from({ length: 6 }, (_, index) =>
      npc({ id: `npc_${index}`, name: `Warden Number${index}`, currentLocationId: 'loc_harbor' })
    );
    // "NumberN" words are not stopwords and each name is unique.
    const applied = resolveDeclaredNpcTrustChanges({
      declared: crowd.map((c) => ({
        npcName: c.name,
        trustDelta: 5,
        reason: 'you helped at the gate',
      })),
      npcs: crowd,
      currentLocationId: 'loc_harbor',
    });
    assert.equal(applied.length, MAX_TRUST_CHANGES_PER_TURN);
  });

  it('treats a stationed NPC at another location as absent', () => {
    assert.equal(isNpcPresentForTrust(sohrab, { currentLocationId: 'loc_harbor' }), false);
    assert.equal(isNpcPresentForTrust(borzou, { currentLocationId: 'loc_harbor' }), true);
  });

  it('seeds unmet NPCs from initialTrust before deltas are applied', () => {
    const existing = {
      npc_borzou: { trust: 40, knownSecrets: ['s1'], notes: ['old debt'] },
    };
    const withBaseline = { ...maryam, initialTrust: 25 };
    const seeded = seedTrustRelationships(
      existing,
      [
        { npcId: 'npc_borzou', npcName: 'Borzou Sangtarash', trustDelta: 5, reason: 'deal' },
        { npcId: 'npc_maryam', npcName: 'مریم نمک‌فروش', trustDelta: 5, reason: 'kindness' },
      ],
      [borzou, withBaseline]
    );

    assert.equal(seeded.npc_borzou, existing.npc_borzou, 'met NPCs keep their reference');
    assert.equal(seeded.npc_maryam.trust, 25);
    assert.deepEqual(seeded.npc_maryam.knownSecrets, []);

    const unchanged = seedTrustRelationships(seeded, [], []);
    assert.equal(unchanged, seeded, 'no-op returns the same object');
  });

  it('phrases trust feedback in both languages', () => {
    const change = {
      npcId: 'npc_borzou',
      npcName: 'Borzou Sangtarash',
      trustDelta: 8,
      reason: 'deal',
    };
    assert.match(describeTrustChange(change, false), /trusts you more now \(\+8\)/);
    assert.match(describeTrustChange({ ...change, trustDelta: -3 }, true), /کاهش.*\(-3\)/);
  });
});
