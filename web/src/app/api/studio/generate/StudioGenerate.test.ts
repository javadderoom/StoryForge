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
  LocationSubZonesEnvelopeSchema,
  PopulateLocationSchema,
  NpcRelationshipWebSchema,
  NpcVoiceGuideSchema,
  NpcStatCalibrationSchema,
  EpochArcSchema,
  TimelineRippleSchema,
  EnhancedArtifactSchema,
  EnhancedCreatureSchema,
  EnhancedReligionSchema,
  ThemeRpgSystemSchema,
  BranchingStoryTreeSchema,
  EpicSagaSynthesisSchema,
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
    { type: 'location_subzones', schema: LocationSubZonesEnvelopeSchema },
    { type: 'populate_location', schema: PopulateLocationSchema },
    { type: 'npc_relationships', schema: NpcRelationshipWebSchema },
    { type: 'npc_voice_guide', schema: NpcVoiceGuideSchema },
    { type: 'npc_stat_calibration', schema: NpcStatCalibrationSchema },
    { type: 'epic_saga_synthesis', schema: EpicSagaSynthesisSchema },
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

      assert.equal(
        LocationSubZonesEnvelopeSchema.safeParse({

          parentLocationId: 'loc_citadel',
          subZones: [
            {
              id: 'sz_vault',
              name: "The Inquisitor's Sunken Vault",
              subType: 'vault',
              dangerLevel: 4,
              atmosphere: 'Damp stone smelling of ancient cedar and dried blood.',
              explorationHooks: ['A locked iron grate leads deeper.', 'A shattered reliquary.'],
              pointsOfInterest: [
                {
                  name: 'Obsidian Sarcophagus',
                  description: 'A heavy stone slab carved with warding glyphs.',
                  skillCheck: {
                    attribute: 'Arcana',
                    dc: 15,
                    failureConsequence: 'Triggers a necrotic burst dealing 2d6 damage.',
                  },
                },
              ],
            },
          ],
        }).success,
        true,
        'LocationSubZonesEnvelopeSchema should accept valid sub-zones payload'
      );

      assert.equal(
        PopulateLocationSchema.safeParse({
          locationId: 'loc_citadel',
          npcs: [
            {
              id: 'npc_inquisitor',
              name: 'Inquisitor Vael',
              title: 'Keeper of the Ashes',
              role: 'Inquisitor',
              currentLocationId: 'loc_citadel',
              personalityTraits: ['Zealous', 'Calculating'],
              speechStyle: 'Low and measured whisper',
              goals: ['Cleanse the heretical archives'],
              secrets: [
                {
                  id: 'sec_1',
                  description: 'Practices blood alchemy in secret',
                  requiredTrustLevel: 25,
                  revealed: false,
                },
              ],
              initialTrust: 0,
            },
          ],
          creature: {
            id: 'creature_ash_hound',
            name: 'Ash Hound',
            speciesCategory: 'monstrosity',
            dangerLevel: 3,
            habitatLocationIds: ['loc_citadel'],
            behavioralTactics: 'Packs hunt from shadows, breathing suffocating cinders.',
            weaknesses: ['Radiant damage', 'Water'],
            resistances: ['Fire', 'Poison'],
            harvestableLoot: [
              { itemId: 'cinder_fang', name: 'Cinder Fang', dropRate: 'Common' },
            ],
            loreDescription: 'Canine horrors bred from the furnace waste.',
          },
          hiddenRelic: {
            id: 'art_cinder_crown',
            name: 'The Cinder Crown',
            title: 'Crown of the First Pyromancer',
            originEra: 'Ancient',
            rarity: 'mythic',
            description: 'A circlet of smoldering iron that grants flame mastery.',
            powers: ['Cast Hellfire without spell slots'],
            curseOrCost: 'Gradually burns away the wearers sense of empathy.',
            attunementRules: 'Must be placed directly on an open burn wound.',
            currentHolderType: 'location',
            currentHolderId: 'loc_citadel',
            secretLore: 'Forged in the heart of a dying volcano.',
          },
        }).success,
        true,
        'PopulateLocationSchema should accept synchronized micro-ecosystem payload'
      );

      assert.equal(
        NpcRelationshipWebSchema.safeParse({
          sourceNpcId: 'npc_inquisitor',
          sourceNpcName: 'Inquisitor Vael',
          bonds: [
            {
              id: 'bond_1',
              sourceNpcId: 'npc_inquisitor',
              targetNpcId: 'npc_heretic',
              targetNpcName: 'Brother Lucian',
              relationTypeId: 'blood_debt',
              affinity: -75,
              secretTension: 'Lucian secretly witnessed Vael cast forbidden pyromancy.',
              isPublic: false,
            },
            {
              id: 'bond_2',
              sourceNpcId: 'npc_inquisitor',
              targetNpcId: 'npc_prior',
              targetNpcName: 'High Prior Donald',
              relationTypeId: 'mentor_apprentice',
              affinity: 60,
              secretTension: 'Donald groomed Vael to succeed him despite growing doubts.',
              isPublic: true,
            },
          ],
        }).success,
        true,
        'NpcRelationshipWebSchema should accept valid relationship web payload'
      );

      assert.equal(
        NpcVoiceGuideSchema.safeParse({
          npcName: 'Inquisitor Vael',
          speechQuirks: ['Speaks in a dry, calculated whisper', 'Never uses colloquial contractions'],
          sampleDialogue: [
            { context: 'greeting', quote: 'Speak your purpose before the hearth grows cold.' },
            { context: 'bargaining', quote: 'Mercy is a commodity of the church; calculate its price.' },
            { context: 'threatened', quote: 'You mistake my restraint for vulnerability.' },
            { context: 'dying', quote: 'The pyre... was always meant for both of us.' },
          ],
          negotiationVulnerabilities: ['Appeals to orthodox canon', 'Mention of the Old Ash Treaty'],
          psychologicalBreakingPoint: 'Threatening the sanctuary of the novice acolytes.',
        }).success,
        true,
        'NpcVoiceGuideSchema should accept valid voice and dialogue guide payload'
      );

      assert.equal(
        NpcStatCalibrationSchema.safeParse({
          npcId: 'npc_inquisitor',
          npcName: 'Inquisitor Vael',
          combatTier: 'elite',
          challengeRating: 6,
          statRatings: {
            Might: 12,
            Agility: 14,
            Arcana: 16,
            Willpower: 18,
          },
          signatureAbilities: ['Ashen Brand', 'Inquisitorial Mandate', 'Hellfire Pyre'],
          equippedGear: [
            { name: 'Cinderglass Rapier', type: 'weapon', description: 'Deals searing radiant damage' },
            { name: 'Smoldering Vestments', type: 'armor', description: 'Woven with fire-resistant silver threads' },
          ],
        }).success,
        true,
        'NpcStatCalibrationSchema should accept valid RPG stat calibration payload'
      );

      // Plan 05: Deep Lore Vaults Schema Tests
      assert.equal(
        EpochArcSchema.safeParse({
          eras: [
            {
              eraName: 'The Dawn of Embers',
              timeframe: '1000 BE - 400 BE',
              description: 'The ancient titans forged the mountain citadels.',
              majorCataclysm: 'The Shattering of the Sky Vault',
              legacyFactions: ['Order of the Forge'],
            },
            {
              eraName: 'The Ash Eclipse',
              timeframe: '400 BE - 0 BE',
              description: 'Dark sorcery engulfed the southern valleys in endless smog.',
              majorCataclysm: 'The Fall of the Sun Throne',
              legacyFactions: ['Cinder Knights'],
            },
            {
              eraName: 'The Present Iron Age',
              timeframe: '0 - Present',
              description: 'Inquisitors police the remnants of arcane magic.',
              majorCataclysm: 'The Great Heresy of 42 AE',
              legacyFactions: ['High Inquisition', 'Ashen Brotherhood'],
            },
          ],
          keyEvents: [
            {
              title: 'The First Spark',
              eraName: 'The Dawn of Embers',
              narrativeSummary: 'The first hearth was ignited with star-metal.',
              lastingConsequences: 'Established the sacred fire liturgy.',
            },
            {
              title: 'Siege of the Black Citadel',
              eraName: 'The Ash Eclipse',
              narrativeSummary: 'A 10-year siege that cracked the mountain fortress.',
              lastingConsequences: 'Buried the lower catacombs forever.',
            },
            {
              title: 'The Ashen Treaty',
              eraName: 'The Ash Eclipse',
              narrativeSummary: 'Peace signed with blood and melted silver.',
              lastingConsequences: 'Outlawed blood alchemy.',
            },
            {
              title: 'The Great Cleansing',
              eraName: 'The Present Iron Age',
              narrativeSummary: 'Inquisition seized the forbidden relic vaults.',
              lastingConsequences: 'Created the underground relic trade.',
            },
          ],
        }).success,
        true,
        'EpochArcSchema should accept valid 3-era historical macro-arc'
      );

      assert.equal(
        TimelineRippleSchema.safeParse({
          sourceEventTitle: 'The Shattering of the Sky Vault',
          modernRepercussions: [
            {
              targetType: 'location',
              targetName: 'Sunken Citadel',
              effectDescription: 'Flooded with toxic volcanic runoff.',
            },
            {
              targetType: 'faction',
              targetName: 'Order of the Forge',
              effectDescription: 'Split into radical zealots and monastic hermits.',
            },
          ],
        }).success,
        true,
        'TimelineRippleSchema should accept valid timeline ripple repercussions'
      );

      assert.equal(
        EnhancedArtifactSchema.safeParse({
          name: 'The Sunken Halberd of Dawn',
          rarity: 'legendary',
          attunementCost: 'Requires 16 Might and a sworn blood oath.',
          activePower: 'Unleashes a cone of blinding radiant flame on hit.',
          doubleEdgedCurse: 'The wielder gradually loses the ability to perceive warmth.',
          vaultLore: {
            creator: 'Grand Artificer Kenneth',
            currentVaultLocation: 'Sunken Reliquary of Saint Valerius',
            unsealingRitual: 'Must submerge the key in pure sulfur under a blood moon.',
            rivalSeekers: ['The Crimson Syndicate', 'Inquisitor Vael'],
          },
        }).success,
        true,
        'EnhancedArtifactSchema should accept valid vault lore and double-edged curse'
      );

      assert.equal(
        EnhancedCreatureSchema.safeParse({
          name: 'Obsidian Chimera',
          speciesCategory: 'monstrosity',
          habitatLocationName: 'Smoldering Crags',
          predatorPreyNiche: 'Apex predator feeding on cinder wolves and basalt goats.',
          nonCombatPacificationMethod: 'Extinguish all nearby flames and offer volcanic sulphur crystals.',
          alchemicalYields: [
            {
              reagentName: 'Chimera Gallbladder',
              rarity: 'rare',
              craftingUse: 'Brewing potions of stone-meld and heat immunity.',
            },
            {
              reagentName: 'Obsidian Horn Fragment',
              rarity: 'epic',
              craftingUse: 'Forging piercing weapons that ignore physical armor.',
            },
          ],
        }).success,
        true,
        'EnhancedCreatureSchema should accept valid ecology and alchemical yields'
      );

      assert.equal(
        EnhancedReligionSchema.safeParse({
          name: 'The Flame of Rectitude',
          domain: 'light',
          sacredTaboos: ['Extinguishing a hearth with water', 'Bearing iron inside the inner sanctum'],
          divineOmensForViolation: 'Blood boils inside the veins of blasphemers upon crossing the temple threshold.',
          divineBlessing: 'Weapons ignite with harmless radiant fire, illuminating hidden lies.',
          sectarianSchisms: [
            {
              cultName: 'The Ash Ascetics',
              heresyDoctrine: 'Believe that only through complete self-immolation can one attain divine grace.',
              headquartersLocation: 'Crater of the Blind Monk',
            },
          ],
        }).success,
        true,
        'EnhancedReligionSchema should accept valid taboos, omens, and sectarian schisms'
      );

      assert.equal(
        ThemeRpgSystemSchema.safeParse({
          themeJustification: 'Cosmic horror and blood alchemy mechanics with Sanity and Corruption pools.',
          stats: [
            { id: 'might', nameFa: 'قدرت بدنی', nameEn: 'Might', description: 'Raw physical power and resilience.', defaultValue: 10 },
            { id: 'guile', nameFa: 'حیله و پنهان‌کاری', nameEn: 'Guile', description: 'Deception, agility, and covert action.', defaultValue: 10 },
            { id: 'arcana', nameFa: 'دانش کهن', nameEn: 'Arcana', description: 'Understanding of forbidden metallurgy and rites.', defaultValue: 10 },
            { id: 'resolve', nameFa: 'اراده و ثبات', nameEn: 'Resolve', description: 'Mental fortitude against madness and dread.', defaultValue: 10 },
          ],
          resources: [
            { id: 'hp', nameFa: 'سلامت جسمانی', nameEn: 'Health Points', maxValue: 100 },
            { id: 'sanity', nameFa: 'پایداری روان', nameEn: 'Sanity Pool', maxValue: 50, decayRule: 'Decreases by 5 on encountering cosmic horrors' },
          ],
          archetypes: [
            {
              name: 'Ashen Inquisitor',
              description: 'A zealous tracker armed with sacred iron and flame.',
              startingStats: { might: 14, resolve: 12, guile: 8, arcana: 10 },
              signaturePerk: 'Unyielding Flame (Immunity to fear)',
              startingInventory: ['Iron Mace', 'Inquisitor Brand', 'Sulfur Flask'],
            },
            {
              name: 'Blood Artificer',
              description: 'A scholar who binds vitriol to blades.',
              startingStats: { arcana: 15, guile: 12, might: 8, resolve: 9 },
              signaturePerk: 'Transmutation Touch',
              startingInventory: ['Alchemical Dagger', 'Crucible Glass', 'Tonic of Clarity'],
            },
            {
              name: 'Shadow Emissary',
              description: 'An envoy of the underworld factions.',
              startingStats: { guile: 15, resolve: 11, might: 9, arcana: 9 },
              signaturePerk: 'Silent Step',
              startingInventory: ['Twin Stilettos', 'Smokebomb', 'Forged Seal'],
            },
          ],
        }).success,
        true,
        'ThemeRpgSystemSchema should accept valid tailored RPG mechanics payload'
      );

      assert.equal(
        BranchingStoryTreeSchema.safeParse({
          title: 'Chronicles of the Ashen Gate',
          premise: 'The hero must uncover the forbidden vault before the eclipse arrives.',
          acts: [
            {
              actNumber: 1,
              actTitle: 'Act 1: The Broken Seal',
              scenes: [
                {
                  sceneId: 'sc_01',
                  title: 'The Gatekeeper Crypt',
                  settingLocationName: 'Sunken Vault',
                  primaryConflict: 'The corrupted sentinels awaken at midnight.',
                  presentedChoices: [
                    {
                      style: 'defensive_diplomatic',
                      textFa: 'پشت ستون‌ها پناه گرفته و ورد خاموش‌سازی بخوانید.',
                      textEn: 'Take cover behind stone pillars and chant the quietus hymn.',
                      statCheck: { stat: 'resolve', dc: 12 },
                      leadToSceneId: 'sc_02_stealth',
                    },
                    {
                      style: 'tactical_agile',
                      textFa: 'به سرعت از زنجیرهای آویزان بالا رفته و سوئیچ را فعال کنید.',
                      textEn: 'Scale the rusted chains to disable the pressure plate.',
                      statCheck: { stat: 'guile', dc: 14 },
                      leadToSceneId: 'sc_02_flank',
                    },
                    {
                      style: 'aggressive_daring',
                      textFa: 'با شمشیر آخته مستقیماً به فرمانده نگهبانان هجوم ببرید.',
                      textEn: 'Charge directly at the sentinel commander with drawn steel.',
                      statCheck: { stat: 'might', dc: 15 },
                      leadToSceneId: 'sc_02_clash',
                    },
                  ],
                },
              ],
            },
            {
              actNumber: 2,
              actTitle: 'Act 2: The Crimson Labyrinth',
              scenes: [
                {
                  sceneId: 'sc_02_clash',
                  title: 'The Crucible Chamber',
                  settingLocationName: 'Underrealm Labyrinth',
                  primaryConflict: 'Rising volcanic gas threatens to overwhelm the party.',
                  presentedChoices: [
                    {
                      style: 'defensive_diplomatic',
                      textFa: 'توزیع ماسک‌های کیمیاگری و پیشروی گام به گام.',
                      textEn: 'Distribute alchemical filters and advance methodically.',
                    },
                    {
                      style: 'tactical_agile',
                      textFa: 'جستجوی دریچه‌های تهویه مخفی در سقف.',
                      textEn: 'Search for hidden ventilation grates in the vault ceiling.',
                    },
                    {
                      style: 'aggressive_daring',
                      textFa: 'شکستن دیواره سنگی مخزن آب برای مهار گاز.',
                      textEn: 'Shatter the cistern wall to flood the gas conduits.',
                    },
                  ],
                },
              ],
            },
            {
              actNumber: 3,
              actTitle: 'Act 3: Eclipse of the Sunken God',
              scenes: [
                {
                  sceneId: 'sc_03_climax',
                  title: 'The Sanctum of Ruin',
                  settingLocationName: 'Sanctum Inner Ring',
                  primaryConflict: 'The final avatar of the ancient deity breaks its bonds.',
                  presentedChoices: [
                    {
                      style: 'defensive_diplomatic',
                      textFa: 'فعال‌سازی آیین مهرو موم با اتصال حلقه‌های قدسی.',
                      textEn: 'Complete the binding ward by reconnecting the sacred pylons.',
                    },
                    {
                      style: 'tactical_agile',
                      textFa: 'هدف‌گیری هسته بلورین هیولا در لحظه شارژ حمله.',
                      textEn: 'Target the crystal core during its breath weapon windup.',
                    },
                    {
                      style: 'aggressive_daring',
                      textFa: 'فدا کردن سلاح جادویی برای فرود آوردن ضربه مرگبار.',
                      textEn: 'Sacrifice your relic weapon for a catastrophic critical strike.',
                    },
                  ],
                },
              ],
            },
          ],
        }).success,
        true,
        'BranchingStoryTreeSchema should accept valid 3-Act branching story graph'
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

