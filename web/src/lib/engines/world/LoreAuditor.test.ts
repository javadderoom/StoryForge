import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LoreAuditor } from './LoreAuditor';
import { WorldBible } from '@/lib/types/world';

function baseWorld(overrides: Partial<WorldBible> = {}): WorldBible {
  return {
    worldId: 'world_test',
    worldName: 'Test World',
    summary: 'A test world.',
    themeNotes: '',
    laws: [],
    factions: [],
    locations: [],
    timeline: [],
    npcs: [],
    artifacts: [],
    bestiary: [],
    religions: [],
    dramaBonds: [],
    ...overrides,
  };
}

describe('LoreAuditor — deterministic consistency checks', () => {
  it('returns a perfect score for an empty world (no entities)', () => {
    const report = LoreAuditor.audit(baseWorld());
    assert.equal(report.score, 0); // empty world is not "coherent"
    assert.equal(report.findings.length, 0);
  });

  it('flags a dangling faction reference to a missing location', () => {
    const world = baseWorld({
      factions: [
        {
          id: 'fac_a',
          name: 'House A',
          description: 'A faction.',
          alignment: 'neutral',
          territoryIds: ['loc_missing'],
          rivalFactionIds: [],
          alliedFactionIds: [],
          publicGoals: '',
        },
      ],
    });
    const report = LoreAuditor.audit(world);
    const finding = report.findings.find((f) => f.category === 'missing_link');
    assert.ok(finding, 'expected a missing_link finding');
    assert.equal(finding?.severity, 'warning');
  });

  it('flags magic_violation when a banned-magic law coexists with a casting artifact', () => {
    const world = baseWorld({
      laws: [
        {
          id: 'law_magic',
          rule: 'All casting of magic is forbidden by imperial decree.',
          description: 'Magic is illegal.',
          category: 'magic',
          isImmutable: true,
        },
      ],
      artifacts: [
        {
          id: 'art_inferno',
          name: 'The Inferno Brand',
          title: 'Brand of Flame',
          originEra: 'Ancient',
          rarity: 'legendary',
          description: 'A wand that lets the wielder cast fireballs.',
          powers: ['Cast fireball'],
          curseOrCost: '',
          currentHolderType: 'unknown',
          currentHolderId: 'unknown',
        },
      ],
    });
    const report = LoreAuditor.audit(world);
    const finding = report.findings.find((f) => f.category === 'magic_violation');
    assert.ok(finding, 'expected a magic_violation finding');
    assert.equal(finding?.severity, 'error');
  });



  it('flags one-sided faction rivalry as a suggestion', () => {
    const world = baseWorld({
      factions: [
        {
          id: 'fac_a',
          name: 'House A',
          description: 'A.',
          alignment: 'neutral',
          territoryIds: [],
          rivalFactionIds: ['fac_b'],
          alliedFactionIds: [],
          publicGoals: '',
        },
        {
          id: 'fac_b',
          name: 'House B',
          description: 'B.',
          alignment: 'neutral',
          territoryIds: [],
          rivalFactionIds: [],
          alliedFactionIds: [],
          publicGoals: '',
        },
      ],
    });
    const report = LoreAuditor.audit(world);
    const finding = report.findings.find((f) => f.category === 'faction_rivalry');
    assert.ok(finding, 'expected a faction_rivalry finding');
    assert.equal(finding?.severity, 'suggestion');
  });

  it('flags orphaned factions and locations as suggestions', () => {
    const world = baseWorld({
      factions: [
        {
          id: 'fac_a',
          name: 'House A',
          description: 'An isolated faction.',
          alignment: 'neutral',
          territoryIds: [],
          rivalFactionIds: [],
          alliedFactionIds: [],
          publicGoals: '',
        },
      ],
      locations: [
        {
          id: 'loc_a',
          name: 'Lost Cove',
          description: 'An isolated cove.',
          region: 'Coast',
          dangerLevel: 3,
          connectedLocationIds: [],
          atmosphere: 'lonely',
        },
      ],
    });
    const report = LoreAuditor.audit(world);
    assert.ok(report.findings.some((f) => f.title === 'Orphaned faction'));
    assert.ok(report.findings.some((f) => f.title === 'Isolated location'));
  });

  it('produces a high score for a fully connected, consistent world', () => {
    const world = baseWorld({
      laws: [
        {
          id: 'law_a',
          rule: 'Steel must be forged with fire.',
          description: 'A foundational truth.',
          category: 'physics',
          isImmutable: true,
        },
      ],
      factions: [
        {
          id: 'fac_a',
          name: 'House A',
          description: 'A.',
          alignment: 'neutral',
          territoryIds: ['loc_a'],
          rivalFactionIds: ['fac_b'],
          alliedFactionIds: [],
          publicGoals: '',
        },
        {
          id: 'fac_b',
          name: 'House B',
          description: 'B.',
          alignment: 'neutral',
          territoryIds: ['loc_b'],
          rivalFactionIds: ['fac_a'],
          alliedFactionIds: [],
          publicGoals: '',
        },
      ],
      locations: [
        {
          id: 'loc_a',
          name: 'Keep A',
          description: 'A.',
          region: 'North',
          dangerLevel: 2,
          connectedLocationIds: ['loc_b'],
          atmosphere: 'calm',
        },
        {
          id: 'loc_b',
          name: 'Keep B',
          description: 'B.',
          region: 'South',
          dangerLevel: 2,
          connectedLocationIds: ['loc_a'],
          atmosphere: 'calm',
        },
      ],
    });
    const report = LoreAuditor.audit(world);
    assert.ok(report.score >= 90, `expected high score, got ${report.score}`);
    assert.equal(report.findings.length, 0);
  });
});

describe('Plan 08 — LoreAuditor v2 cross-vault integrity', () => {
  it('flags artifacts held by missing NPCs (previously unchecked)', () => {
    const world = baseWorld({
      npcs: [
        {
          id: 'npc_a',
          name: 'Aria',
          title: '',
          currentLocationId: 'loc_a',
          personalityTraits: [],
          speechStyle: '',
          goals: [],
          secrets: [],
          initialTrust: 0,
        },
      ],
      locations: [
        { id: 'loc_a', name: 'Hall A', description: '', region: 'r', dangerLevel: 1, connectedLocationIds: [], atmosphere: '' },
      ],
      artifacts: [
        {
          id: 'art_x',
          name: 'Blade of X',
          title: '',
          originEra: '',
          rarity: 'epic',
          description: '',
          powers: [],
          currentHolderType: 'npc',
          currentHolderId: 'npc_missing',
        },
      ],
    });

    const report = LoreAuditor.audit(world);
    assert.ok(report.findings.some((f) => f.title === 'Artifact holder not found'));
  });

  it('flags deity holy sites and creature habitats that do not exist', () => {
    const world = baseWorld({
      religions: [
        {
          id: 'deity_1',
          name: 'The Forge Mother',
          title: '',
          domain: 'forge',
          sacredSymbol: '',
          coreDogma: '',
          taboos: [],
          divineBlessings: [],
          affiliatedFactionIds: [],
          holyLocationIds: ['loc_missing_shrine'],
        },
      ],
      bestiary: [
        {
          id: 'cre_1',
          name: 'Ash Hound',
          speciesCategory: 'beast',
          dangerLevel: 3,
          habitatLocationIds: ['loc_missing_den'],
          behavioralTactics: '',
          weaknesses: [],
          resistances: [],
          harvestableLoot: [],
          loreDescription: '',
        },
      ],
    });

    const report = LoreAuditor.audit(world);
    assert.ok(report.findings.some((f) => f.title === 'Deity tied to missing holy site'));
    assert.ok(report.findings.some((f) => f.title === 'Creature habitat not found'));
  });

  it('flags drama bonds with missing endpoints and duplicate entity names', () => {
    const npc = (id: string, name: string) => ({
      id,
      name,
      title: '',
      currentLocationId: 'loc_a',
      personalityTraits: [],
      speechStyle: '',
      goals: [],
      secrets: [],
      initialTrust: 0,
    });

    const world = baseWorld({
      locations: [
        { id: 'loc_a', name: 'Hall', description: '', region: 'r', dangerLevel: 1, connectedLocationIds: [], atmosphere: '' },
      ],
      factions: [
        { id: 'fac_a', name: 'Keepers', description: '', alignment: '', territoryIds: ['loc_a'], rivalFactionIds: [], alliedFactionIds: [], publicGoals: '' },
      ],
      npcs: [npc('npc_1', 'Captain Rolan'), npc('npc_2', 'captain rolan')],
      dramaBonds: [
        {
          id: 'bond_1',
          sourceNpcId: 'npc_1',
          targetNpcId: 'npc_ghost',
          relationTypeId: 'blood_debt',
          affinity: -50,
          secretTension: '',
          isPublic: true,
        },
      ],
    });

    const report = LoreAuditor.audit(world);
    assert.ok(report.findings.some((f) => f.title === 'Drama bond references missing NPC'));
    assert.ok(report.findings.some((f) => f.title === 'Duplicate NPC names'));
  });
});

describe('Plan 08 — Saga graph audit (auditSaga)', () => {
  const scene = (sceneId: string) => ({
    sceneId,
    locationId: 'loc_a',
    narrativeText: 'text',
    choices: [],
  });

  it('accepts a coherent saga graph without findings', () => {
    const report = LoreAuditor.auditSaga({
      sagaTitle: 'The Long March',
      premise: '',
      chapters: [
        { id: 'ch1', chapterNumber: 1, title: 'One', scopeTier: 'street', narrativeGoal: '', prerequisiteFlags: [], scenes: [scene('s1')], completionSummaryPrompt: '' },
        { id: 'ch2', chapterNumber: 2, title: 'Two', scopeTier: 'regional', narrativeGoal: '', prerequisiteFlags: ['flag_ch1_done'], scenes: [{ ...scene('s2'), choices: [{ id: 'c1', text: 'next', style: 'agile', riskLevel: 'low', targetSceneId: 's3' }] }, scene('s3')], completionSummaryPrompt: '' },
      ],
    });
    assert.equal(report.findings.length, 0);
    assert.equal(report.score, 100);
  });

  it('detects duplicate scene ids across chapters', () => {
    const report = LoreAuditor.auditSaga({
      sagaTitle: 'Broken Graph',
      premise: '',
      chapters: [
        { id: 'ch1', chapterNumber: 1, title: 'One', scopeTier: 'street', narrativeGoal: '', prerequisiteFlags: [], scenes: [scene('dup')], completionSummaryPrompt: '' },
        { id: 'ch2', chapterNumber: 2, title: 'Two', scopeTier: 'regional', narrativeGoal: '', prerequisiteFlags: [], scenes: [scene('dup')], completionSummaryPrompt: '' },
      ],
    });
    assert.ok(report.findings.some((f) => f.title === 'Duplicate scene id'));
  });

  it('detects dangling branch edges, empty chapters, and scope regressions', () => {
    const report = LoreAuditor.auditSaga({
      sagaTitle: 'Messy Saga',
      premise: '',
      chapters: [
        {
          id: 'ch1',
          chapterNumber: 1,
          title: 'Mythic First',
          scopeTier: 'mythic',
          narrativeGoal: '',
          prerequisiteFlags: [],
          scenes: [
            {
              ...scene('s1'),
              choices: [{ id: 'c1', text: 'to nowhere', style: 'aggressive', riskLevel: 'high', targetSceneId: 'scene_void' }],
            },
          ],
          completionSummaryPrompt: '',
        },
        { id: 'ch2', chapterNumber: 2, title: 'Street Second', scopeTier: 'street', narrativeGoal: '', prerequisiteFlags: [], scenes: [], completionSummaryPrompt: '' },
      ],
    });

    assert.ok(report.findings.some((f) => f.title === 'Dangling branch edge'));
    assert.ok(report.findings.some((f) => f.title === 'Empty chapter'));
    assert.ok(report.findings.some((f) => f.title === 'Scope tier regression'));
  });
});

describe('5-State Faction Relation Spectrum Audit', () => {
  it('accepts clean 5-state spectrum relations without false positives', () => {
    const world = baseWorld({
      factions: [
        {
          id: 'fac_order',
          name: 'The Golden Order',
          description: 'Noble paladins.',
          alignment: 'Lawful',
          territoryIds: ['loc_a'],
          rivalFactionIds: [],
          alliedFactionIds: [],
          publicGoals: 'Uphold the light',
        },
        {
          id: 'fac_shadows',
          name: 'The Shadow Guild',
          description: 'Covert rogues.',
          alignment: 'Chaotic',
          territoryIds: ['loc_a'],
          rivalFactionIds: [],
          alliedFactionIds: [],
          publicGoals: 'Freedom of information',
        },
      ],
      factionRelations: [
        {
          id: 'frel_1',
          sourceFactionId: 'fac_order',
          targetFactionId: 'fac_shadows',
          value: 'favorable',
          note: 'Secret treaty between masters',
          isPublic: true,
        },
      ],
      locations: [
        {
          id: 'loc_a',
          name: 'Capital',
          description: 'A grand city.',
          dangerLevel: 1,
          region: 'Core',
          atmosphere: 'Bustling',
          connectedLocationIds: [],
        },
      ],
    });

    const report = LoreAuditor.audit(world);
    const spectrumFindings = report.findings.filter((f) => f.category === 'faction_rivalry');
    assert.equal(spectrumFindings.length, 0, 'expected zero faction rivalry findings for valid spectrum');
  });

  it('detects allied vs hostile contradiction between factions', () => {
    const world = baseWorld({
      factions: [
        {
          id: 'fac_a',
          name: 'Faction Alpha',
          description: 'Alpha.',
          alignment: 'Lawful',
          territoryIds: [],
          rivalFactionIds: [],
          alliedFactionIds: [],
          publicGoals: 'Rule',
        },
        {
          id: 'fac_b',
          name: 'Faction Beta',
          description: 'Beta.',
          alignment: 'Rebel',
          territoryIds: [],
          rivalFactionIds: [],
          alliedFactionIds: [],
          publicGoals: 'Rebel',
        },
      ],
      factionRelations: [
        {
          id: 'frel_1',
          sourceFactionId: 'fac_a',
          targetFactionId: 'fac_b',
          value: 'allied',
        },
        {
          id: 'frel_2',
          sourceFactionId: 'fac_b',
          targetFactionId: 'fac_a',
          value: 'hostile',
        },
      ],
    });

    const report = LoreAuditor.audit(world);
    const clash = report.findings.find((f) => f.title === 'Allied↔hostile contradiction');
    assert.ok(clash, 'expected Allied↔hostile contradiction finding');
    assert.equal(clash?.severity, 'error');
  });

  it('detects legacy array vs spectrum contradiction', () => {
    const world = baseWorld({
      factions: [
        {
          id: 'fac_a',
          name: 'Faction Alpha',
          description: 'Alpha.',
          alignment: 'Lawful',
          territoryIds: [],
          rivalFactionIds: [],
          alliedFactionIds: ['fac_b'],
          publicGoals: 'Rule',
        },
        {
          id: 'fac_b',
          name: 'Faction Beta',
          description: 'Beta.',
          alignment: 'Rebel',
          territoryIds: [],
          rivalFactionIds: [],
          alliedFactionIds: [],
          publicGoals: 'Rebel',
        },
      ],
      factionRelations: [
        {
          id: 'frel_1',
          sourceFactionId: 'fac_a',
          targetFactionId: 'fac_b',
          value: 'hostile',
        },
      ],
    });

    const report = LoreAuditor.audit(world);
    const clash = report.findings.find((f) => f.title === 'Legacy ally vs spectrum enemy');
    assert.ok(clash, 'expected Legacy ally vs spectrum enemy finding');
    assert.equal(clash?.severity, 'warning');
  });
});

