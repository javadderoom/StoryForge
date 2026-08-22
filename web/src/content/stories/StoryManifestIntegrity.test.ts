import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { StoryManifestSchema } from '../../lib/types/story';
import { getEmptyStoryManifest } from '../../lib/storyFactory';

describe('StoryManifestIntegrity - Default Story Factory', () => {
  const stories = [
    { name: 'Empty Manifest (Persian)', manifest: getEmptyStoryManifest('fa') },
    { name: 'Empty Manifest (English)', manifest: getEmptyStoryManifest('en') },
  ];

  stories.forEach(({ name, manifest }) => {
    describe(`Manifest Integrity: ${name}`, () => {
      it('strictly conforms to StoryManifestSchema without Zod errors', () => {
        const result = StoryManifestSchema.safeParse(manifest);
        if (!result.success) {
          console.error(result.error.format());
        }
        assert.equal(result.success, true, `Schema validation failed for ${name}`);
      });

      it('ensures initialSceneId matches an existing beat', () => {
        const beatSceneIds = manifest.initialStoryBeats.map((b) => b.sceneId);
        assert.ok(
          beatSceneIds.includes(manifest.initialSceneId),
          `initialSceneId "${manifest.initialSceneId}" must exist in initialStoryBeats`
        );
      });

      it('ensures all NPCs reference valid existing locations and factions', () => {
        const locIds = new Set(manifest.worldBible.locations.map((l) => l.id));
        const facIds = new Set(manifest.worldBible.factions.map((f) => f.id));

        manifest.worldBible.npcs.forEach((npc) => {
          assert.ok(
            locIds.has(npc.currentLocationId),
            `NPC ${npc.id} references non-existent currentLocationId "${npc.currentLocationId}"`
          );
          if (npc.factionId) {
            assert.ok(
              facIds.has(npc.factionId),
              `NPC ${npc.id} references non-existent factionId "${npc.factionId}"`
            );
          }
        });
      });

      it('ensures all artifacts reference valid holder entities', () => {
        const locIds = new Set(manifest.worldBible.locations.map((l) => l.id));
        const npcIds = new Set(manifest.worldBible.npcs.map((n) => n.id));
        const facIds = new Set(manifest.worldBible.factions.map((f) => f.id));

        (manifest.worldBible.artifacts || []).forEach((art) => {
          if (art.currentHolderType === 'location') {
            assert.ok(
              locIds.has(art.currentHolderId),
              `Artifact ${art.id} holder location "${art.currentHolderId}" not found in locations`
            );
          } else if (art.currentHolderType === 'npc') {
            assert.ok(
              npcIds.has(art.currentHolderId),
              `Artifact ${art.id} holder NPC "${art.currentHolderId}" not found in npcs`
            );
          } else if (art.currentHolderType === 'faction') {
            assert.ok(
              facIds.has(art.currentHolderId),
              `Artifact ${art.id} holder faction "${art.currentHolderId}" not found in factions`
            );
          }
        });
      });

      it('ensures all bestiary creatures reference valid habitat locations', () => {
        const locIds = new Set(manifest.worldBible.locations.map((l) => l.id));

        (manifest.worldBible.bestiary || []).forEach((creature) => {
          creature.habitatLocationIds.forEach((hId) => {
            assert.ok(
              locIds.has(hId),
              `Creature ${creature.id} references non-existent habitat "${hId}"`
            );
          });
        });
      });

      it('ensures all deities reference valid factions and holy locations', () => {
        const locIds = new Set(manifest.worldBible.locations.map((l) => l.id));
        const facIds = new Set(manifest.worldBible.factions.map((f) => f.id));

        (manifest.worldBible.religions || []).forEach((deity) => {
          deity.affiliatedFactionIds.forEach((fId) => {
            assert.ok(
              facIds.has(fId),
              `Deity ${deity.id} references non-existent faction "${fId}"`
            );
          });
          deity.holyLocationIds.forEach((lId) => {
            assert.ok(
              locIds.has(lId),
              `Deity ${deity.id} references non-existent holy location "${lId}"`
            );
          });
        });
      });

      it('ensures all drama bonds connect two distinct, existing NPCs', () => {
        const npcIds = new Set(manifest.worldBible.npcs.map((n) => n.id));

        (manifest.worldBible.dramaBonds || []).forEach((bond) => {
          assert.ok(
            npcIds.has(bond.sourceNpcId),
            `Drama bond ${bond.id} source NPC "${bond.sourceNpcId}" does not exist`
          );
          assert.ok(
            npcIds.has(bond.targetNpcId),
            `Drama bond ${bond.id} target NPC "${bond.targetNpcId}" does not exist`
          );
          assert.notEqual(
            bond.sourceNpcId,
            bond.targetNpcId,
            `Drama bond ${bond.id} cannot connect an NPC to themselves`
          );
          assert.ok(
            bond.affinity >= -100 && bond.affinity <= 100,
            `Drama bond affinity ${bond.affinity} must be within [-100, 100]`
          );
        });
      });

      it('ensures RPG system defines essential stats and positive resources', () => {
        assert.ok(manifest.rpgSystem.stats.length >= 3, 'RPG system must define at least 3 stats');
        assert.ok(manifest.rpgSystem.resources.length >= 2, 'RPG system must define at least 2 resources');

        const hpResource = manifest.rpgSystem.resources.find((r) => r.id === 'hp' || r.id === 'health');
        assert.ok(hpResource, 'RPG system must include a health/hp resource');
        assert.ok(hpResource.max > 0, 'HP max must be positive');
      });
    });
  });
});
