import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { StoryNpcOverrideSchema, StoryManifestSchema } from '@/lib/types/story';
import { buildWorldContextBlocks, buildWorldContextString } from './worldContext';
import type { NPCDossier, WorldBible } from '@/lib/types/world';
import { getEmptyStoryManifest } from '@/lib/storyFactory';

describe('Story-Level NPC Role Overrides', () => {
  it('validates StoryNpcOverrideSchema with defaults', () => {
    const parsed = StoryNpcOverrideSchema.parse({
      npcId: 'npc_captain_vane',
      storyRole: 'Prime Suspect',
      relationshipToProtagonist: 'Former Partner',
    });

    assert.equal(parsed.npcId, 'npc_captain_vane');
    assert.equal(parsed.storyRole, 'Prime Suspect');
    assert.equal(parsed.relationshipToProtagonist, 'Former Partner');
    assert.equal(parsed.narrativeImportance, 'supporting');
  });

  it('validates StoryManifestSchema containing storyNpcOverrides', () => {
    const base = getEmptyStoryManifest('en');
    const manifestWithOverrides = {
      ...base,
      storyNpcOverrides: {
        npc_1: {
          npcId: 'npc_1',
          storyRole: 'Heist Mark',
          relationshipToProtagonist: 'Target of burglary',
          storyGoal: 'Guarding the Obsidian Vault',
          storySecret: 'Has hidden the vault key under the altar',
          customInitialTrust: -15,
          narrativeImportance: 'central' as const,
        },
      },
    };

    const validated = StoryManifestSchema.parse(manifestWithOverrides);
    assert.ok(validated.storyNpcOverrides);
    assert.equal(validated.storyNpcOverrides.npc_1.storyRole, 'Heist Mark');
    assert.equal(validated.storyNpcOverrides.npc_1.customInitialTrust, -15);
    assert.equal(validated.storyNpcOverrides.npc_1.narrativeImportance, 'central');
  });

  it('buildWorldContextBlocks applies story overrides and preserves un-overridden NPCs', () => {
    const npcVane: NPCDossier = {
      id: 'npc_vane',
      name: 'Captain Vane',
      title: 'Harbor Master',
      role: 'guard',
      currentLocationId: 'loc_docks',
      personalityTraits: ['Cynical', 'Sharp'],
      speechStyle: 'Gruff and brief',
      goals: ['Keep the harbor open', 'Collect tariffs'],
      secrets: [],
      initialTrust: 0,
    };

    const npcLyra: NPCDossier = {
      id: 'npc_lyra',
      name: 'Lyra Vance',
      title: 'Apothecary',
      role: 'merchant',
      currentLocationId: 'loc_market',
      personalityTraits: ['Gentle'],
      speechStyle: 'Soft spoken',
      goals: ['Find rare herbs'],
      secrets: [],
      initialTrust: 10,
    };

    const worldBible: WorldBible = {
      worldId: 'world_test',
      worldName: 'Veridia',
      summary: 'A sprawling harbor city.',
      themeNotes: 'Dark noir atmosphere.',
      laws: [],
      factions: [],
      locations: [],
      timeline: [],
      npcs: [npcVane, npcLyra],
    };

    // Story A: Captain Vane is the Prime Suspect, Lyra is un-overridden
    const blocks = buildWorldContextBlocks({
      worldBible,
      storyNpcOverrides: {
        npc_vane: {
          npcId: 'npc_vane',
          storyRole: 'Prime Suspect',
          relationshipToProtagonist: 'Bitter ex-partner',
          storyGoal: 'Destroying the harbor ledger',
          storySecret: 'Was seen at the docks at midnight',
          narrativeImportance: 'central',
        },
      },
    });

    assert.equal(blocks.npcs.length, 2);

    // Overridden NPC line verification
    const vaneLine = blocks.npcs.find((line) => line.includes('Captain Vane'));
    assert.ok(vaneLine, 'Captain Vane must exist in context blocks');
    assert.ok(vaneLine.includes('Story Role: Prime Suspect'));
    assert.ok(vaneLine.includes('Relation to Protagonist: Bitter ex-partner'));
    assert.ok(vaneLine.includes('Story Goal: Destroying the harbor ledger'));
    assert.ok(vaneLine.includes('Secret: Was seen at the docks at midnight'));

    // Un-overridden NPC line verification (falls back to World Bible)
    const lyraLine = blocks.npcs.find((line) => line.includes('Lyra Vance'));
    assert.ok(lyraLine, 'Lyra Vance must exist in context blocks');
    assert.ok(lyraLine.includes('(merchant)'));
    assert.ok(lyraLine.includes('Find rare herbs'));
  });

  it('automatically pins central importance NPCs during tight scope pruning', () => {
    // Create 10 NPCs to exceed the 'street' scope budget of 6 NPCs
    const npcs: NPCDossier[] = Array.from({ length: 10 }, (_, i) => ({
      id: `npc_${i}`,
      name: `NPC Number ${i}`,
      title: `Citizen ${i}`,
      role: 'civilian',
      currentLocationId: `loc_${i}`,
      personalityTraits: [],
      speechStyle: '',
      goals: [`Goal ${i}`],
      secrets: [],
      initialTrust: 0,
    }));

    const worldBible: WorldBible = {
      worldId: 'world_test',
      worldName: 'Veridia',
      summary: 'City',
      themeNotes: 'Atmosphere',
      laws: [],
      factions: [],
      locations: [],
      timeline: [],
      npcs,
    };

    // NPC 9 is at the very end of the list and would normally be pruned out in 'street' scope
    const blocks = buildWorldContextBlocks(
      {
        worldBible,
        storyNpcOverrides: {
          npc_9: {
            npcId: 'npc_9',
            storyRole: 'Main Antagonist',
            narrativeImportance: 'central', // Pinned!
          },
        },
      },
      { scopeTier: 'street', locationIds: ['loc_0'] }
    );

    // Check that npc_9 is included despite being at index 9
    const npc9Line = blocks.npcs.find((line) => line.includes('NPC Number 9'));
    assert.ok(npc9Line, 'NPC Number 9 with central importance must be pinned and retained');
    assert.ok(npc9Line.includes('Story Role: Main Antagonist'));
  });

  it('buildWorldContextString renders the customized story role', () => {
    const worldBible: WorldBible = {
      worldId: 'world_test',
      worldName: 'Veridia',
      summary: 'City',
      themeNotes: 'Theme',
      laws: [],
      factions: [],
      locations: [],
      timeline: [],
      npcs: [
        {
          id: 'npc_boss',
          name: 'Don Corvo',
          title: 'Syndicate Kingpin',
          role: 'ruler',
          currentLocationId: 'loc_citadel',
          personalityTraits: ['Calculating'],
          speechStyle: 'Whispers softly',
          goals: ['Rule the underworld'],
          secrets: [],
          initialTrust: -50,
        },
      ],
    };

    const rendered = buildWorldContextString({
      worldBible,
      storyNpcOverrides: {
        npc_boss: {
          npcId: 'npc_boss',
          storyRole: 'Reluctant Employer',
          relationshipToProtagonist: 'Hired you to recover his stolen daughter',
        },
      },
    });

    assert.ok(rendered.includes('Don Corvo [Story Role: Reluctant Employer]'));
    assert.ok(rendered.includes('Relation to Protagonist: Hired you to recover his stolen daughter'));
  });
});
