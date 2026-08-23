import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { POST } from './route';
import { NextRequest } from 'next/server';
import {
  WorldLocationSchema,
  NPCDossierSchema,
  WorldArtifactSchema,
  WorldCreatureSchema,
  WorldDeitySchema,
  TimelineEventSchema,
  WorldLawSchema,
  WorldBible,
} from '../../../../lib/types/world';
import {
  GenesisWorldSchema,
  ContradictionAuditReportSchema,
} from '../../../../lib/engines/world/GenesisSchemas';
import { z } from 'zod';

function createMockRequest(body: any): NextRequest {
  return new NextRequest('http://localhost:3000/api/studio/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const WorldSynthesisSchema = z.object({
  worldName: z.string().min(2),
  summary: z.string().min(5),
  themeNotes: z.string(),
  aiSystemPrompt: z.string().optional(),
  laws: z.array(z.any()).default([]),
  factions: z.array(z.any()).default([]),
});

const SceneSynthesisSchema = z.object({
  sceneId: z.string(),
  locationId: z.string(),
  narrativeText: z.string().min(5),
  choices: z.array(
    z.object({
      id: z.string(),
      text: z.string().min(1),
      style: z.enum(['defensive', 'agile', 'aggressive', 'diplomatic', 'inquisitive']),
      riskLevel: z.enum(['low', 'medium', 'high']),
      targetDC: z.number().optional(),
      requiredStatId: z.string().optional(),
    })
  ).min(1),
});

describe('StudioGenerate API - AI Co-Pilot & Procedural Synthesis Engine', () => {
  const types = [
    { type: 'world', schema: WorldSynthesisSchema },
    { type: 'location', schema: WorldLocationSchema },
    { type: 'npc', schema: NPCDossierSchema },
    { type: 'artifact', schema: WorldArtifactSchema },
    { type: 'creature', schema: WorldCreatureSchema },
    { type: 'deity', schema: WorldDeitySchema },
    { type: 'timeline_event', schema: TimelineEventSchema },
    { type: 'world_law', schema: WorldLawSchema },
    { type: 'scene', schema: SceneSynthesisSchema },
  ] as const;

  describe('No-Mock Error Guardrail (503 on unauthenticated/offline failure)', () => {
    types.forEach(({ type }) => {
      it(`returns 503 without fake mock fallback when offline for ${type}`, async () => {
        const req = createMockRequest({
          type,
          isPersian: false,
          prompt: 'Create something unique.',
          taskType: type === 'world' ? 'world' : 'scene',
        });
        const res = await POST(req);
        // When GEMINI_API_KEY is not set or network fails, route must return 503 without silent fallback
        assert.equal(res.status, 503);

        const json = await res.json();
        assert.equal(json.success, false);
        assert.ok(json.error?.includes('failed') || json.error?.includes('شکست'));
      });
    });
  });

  describe('Schema Validation on Synthetic AI Outputs', () => {
    it('validates a schema-compliant Genesis world package', () => {
      const mockGenesis = {
        worldName: 'The Ash Citadel of Khoran',
        tagline: 'Where elder magic turns flesh to bronze',
        summary: 'A harsh basalt plateau ruled by rival alchemical legions.',
        themeNotes: 'Grimdark, bronze-age mysticism',
        aiSystemPrompt: 'You are the Chronicler of Khoran.',
        laws: [
          { id: 'law_1', rule: 'Metal cannot be mined; it must be distilled.', description: 'Smelting is forbidden.', category: 'physics', isImmutable: true },
          { id: 'law_2', rule: 'Blood oaths bind the soul across death.', description: 'Traitor souls cannot rest.', category: 'divine', isImmutable: true },
          { id: 'law_3', rule: 'Flight is a capital crime in the capital.', description: 'No levitation permitted.', category: 'society', isImmutable: true },
          { id: 'law_4', rule: 'Every spell demands a memory tithe.', description: 'Casting consumes personal memories.', category: 'magic', isImmutable: true },
        ],
        factions: [
          { id: 'fac_1', name: 'The Bronze Order', description: 'Warrior-monks', alignment: 'Lawful', publicGoals: 'Guard the crucibles', secretAgendas: 'Seize the primeval forge', rivalFactionIds: ['fac_2'], alliedFactionIds: [], territoryIds: ['loc_1'] },
          { id: 'fac_2', name: 'Ash Walkers', description: 'Rebel heretics', alignment: 'Chaotic', publicGoals: 'Abolish memory tithes', secretAgendas: 'Awaken the deep fire', rivalFactionIds: ['fac_1'], alliedFactionIds: [], territoryIds: ['loc_2'] },
          { id: 'fac_3', name: 'Silent Guild', description: 'Merchants of bone', alignment: 'Neutral', publicGoals: 'Trade distilled alloys', secretAgendas: 'Monopolize the deep mines', rivalFactionIds: [], alliedFactionIds: [], territoryIds: ['loc_3'] },
        ],
        locations: [
          { id: 'loc_1', name: 'The Obsidian Spire', region: 'Upper Plateau', description: 'A fortress carved from volcanic glass.', dangerLevel: 4, specialRules: ['Bronze armor mandatory'], connectedLocationIds: ['loc_2', 'loc_3'] },
          { id: 'loc_2', name: 'The Sulfur Chasm', region: 'Deep Lowlands', description: 'A smoking rift where heretics hide.', dangerLevel: 5, specialRules: ['Acidic vapor toxicity'], connectedLocationIds: ['loc_1'] },
          { id: 'loc_3', name: 'The Bone Vault', region: 'Merchant Quarter', description: 'A bazaar constructed from leviathan ribs.', dangerLevel: 2, specialRules: ['No weapons drawn'], connectedLocationIds: ['loc_1', 'loc_4'] },
          { id: 'loc_4', name: 'The Outer Waste', region: 'Horizon', description: 'Endless plains of powdered basalt.', dangerLevel: 3, specialRules: ['Water scarcity'], connectedLocationIds: ['loc_3'] },
        ],
        religions: [
          { id: 'deity_1', name: 'The Crucible Mother', title: 'Architect of Flame', domain: 'forge', sacredSymbol: 'Anvil of bronze', coreDogma: 'Through trial comes purification.', taboos: ['Quenching sacred fires'], divineBlessings: ['Heat resistance'] },
          { id: 'deity_2', name: 'The Blind Judge', title: 'Keeper of Oaths', domain: 'light', sacredSymbol: 'Balanced scale', coreDogma: 'Pledges are immutable truth.', taboos: ['Breaking sworn contracts'], divineBlessings: ['Insight'] },
        ],
        coreCampaignMystery: 'Who poisoned the primeval crucible beneath the Obsidian Spire to spark the metal blight?',
      };

      const parseResult = GenesisWorldSchema.safeParse(mockGenesis);
      assert.equal(parseResult.success, true);
    });

    it('validates schema compliance across all single entity types', () => {
      assert.equal(
        WorldLocationSchema.safeParse({
          id: 'loc_01',
          name: 'The Sunken Crypt',
          region: 'Underrealm',
          description: 'A flooded stone chamber with moss-covered pillars.',
          dangerLevel: 3,
          atmosphere: 'Damp, cold, echoing with dripping water.',
          specialRules: ['Fortitude check required'],
          connectedLocationIds: [],
        }).success,
        true
      );

      assert.equal(
        WorldArtifactSchema.safeParse({
          id: 'art_01',
          name: 'Eye of the Augur',
          title: 'Relic of the First Seer',
          originEra: 'Era 1',
          rarity: 'legendary',
          description: 'A glowing crystal lens that reveals hidden passageways.',
          powers: ['True sight up to 30ft', '+2 to Perception'],
          curseOrCost: 'Induces severe migraines upon prolonged use.',
          attunementRules: 'Requires Arcana 3',
          currentHolderType: 'unknown',
          secretLore: 'Forged from the calcified cornea of an ancient star-gazer.',
        }).success,
        true
      );
    });
  });


  describe('Plan 01 — Genesis Generator', () => {
    it('returns 503 error without silent mock fallback when offline', async () => {
      const req = createMockRequest({
        type: 'genesis',
        isPersian: false,
        prompt: 'A volcanic dark fantasy kingdom ruled by iron inquisitors.',
      });
      const res = await POST(req);
      assert.equal(res.status, 503);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.ok(json.error?.includes('failed') || json.error?.includes('Genesis'));
    });
  });


  describe('Plan 01 — Contradiction Radar (audit_world)', () => {
    const sampleWorld: WorldBible = {
      worldId: 'world_audit',
      worldName: 'Audit World',
      summary: 'A world with a dangling reference.',
      themeNotes: '',
      laws: [
        {
          id: 'law_magic',
          rule: 'Magic is strictly forbidden by imperial law.',
          description: 'Casting is illegal.',
          category: 'magic',
          isImmutable: true,
        },
      ],
      factions: [
        {
          id: 'fac_a',
          name: 'House A',
          description: 'A faction with a broken territory link.',
          alignment: 'neutral',
          territoryIds: ['loc_missing'],
          rivalFactionIds: [],
          alliedFactionIds: [],
          publicGoals: '',
        },
      ],
      locations: [],
      timeline: [],
      npcs: [],
      artifacts: [],
      bestiary: [],
      religions: [],
      dramaBonds: [],
    };

    it('audits a world and returns a ContradictionAuditReport with findings', async () => {
      const req = createMockRequest({
        type: 'audit_world',
        isPersian: false,
        worldBible: sampleWorld,
      });
      const res = await POST(req);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.ok(json.data, 'Expected audit report');

      const parseResult = ContradictionAuditReportSchema.safeParse(json.data);
      assert.equal(parseResult.success, true, 'Audit report must conform to ContradictionAuditReportSchema');
      assert.ok(json.data.score >= 0 && json.data.score <= 100);
      assert.ok(json.data.findings.length >= 1, 'Expected at least the dangling-link finding');
    });

    it('rejects audit_world without a worldBible payload', async () => {
      const req = createMockRequest({ type: 'audit_world', isPersian: false });
      const res = await POST(req);
      assert.equal(res.status, 400);
    });
  });
});

