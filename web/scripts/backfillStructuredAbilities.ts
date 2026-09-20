/**
 * Migration & Backfill script for existing worlds/stories with prose-only abilities.
 *
 * Scans all stories and shared RPG systems, parses legacy `effectSummary`, `description`,
 * and `trait` strings, and populates structured `RollModifierSpec`s.
 *
 * Idempotent: already-structured abilities and traits are preserved.
 * Non-destructive: prose summaries are never deleted.
 *
 * Usage:
 *   npx tsx scripts/backfillStructuredAbilities.ts             # Dry-run report
 *   npx tsx scripts/backfillStructuredAbilities.ts --write     # Persist changes to database
 *   npx tsx scripts/backfillStructuredAbilities.ts --file=manifest.json --write
 */

import fs from 'node:fs';
import path from 'node:path';

// tsx CLI scripts don't auto-load .env — do it explicitly (Node 20.6+).
const loadEnv = (process as unknown as { loadEnvFile?: (p?: string) => void }).loadEnvFile;
try {
  loadEnv?.call(process, '.env');
} catch {
  /* .env optional */
}

import { StoryRepository } from '../src/lib/db/repositories/storyRepository';
import { backfillRpgSystem } from '../src/lib/engines/game/backfillAbilities';
import { describeRollModifier } from '../src/lib/engines/game/abilityEffects';
import { StoryManifest } from '../src/lib/types';

async function main() {
  const args = process.argv.slice(2);
  const isWrite = args.includes('--write');
  const fileArg = args.find((a) => a.startsWith('--file='));
  const filePath = fileArg ? fileArg.replace('--file=', '').trim() : null;

  console.log('='.repeat(65));
  console.log('  StoryForge — Structured Abilities & Traits Backfill');
  console.log('='.repeat(65));
  console.log(`Mode: ${isWrite ? 'PERSIST (--write)' : 'DRY-RUN (pass --write to save)'}\n`);

  if (filePath) {
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) {
      console.error(`File not found: ${fullPath}`);
      process.exit(1);
    }
    console.log(`Processing single manifest file: ${fullPath}`);
    const raw = fs.readFileSync(fullPath, 'utf8');
    const manifest: StoryManifest = JSON.parse(raw);

    const { rpgSystem: updatedRpg, summary } = backfillRpgSystem(manifest.rpgSystem);
    console.log(`Abilities: ${summary.abilitiesModified}/${summary.abilitiesChecked} backfilled`);
    console.log(`Backgrounds: ${summary.backgroundsModified}/${summary.backgroundsChecked} backfilled`);

    if (isWrite && (summary.abilitiesModified > 0 || summary.backgroundsModified > 0)) {
      manifest.rpgSystem = updatedRpg as any;
      fs.writeFileSync(fullPath, JSON.stringify(manifest, null, 2), 'utf8');
      console.log(`✓ Saved changes to ${fullPath}`);
    }
    return;
  }

  // Database scan
  console.log('Connecting to database...');
  let stories: any[] = [];
  try {
    stories = await StoryRepository.getAllStories(false);
  } catch (err) {
    console.warn('Could not query database stories directly:', err);
    console.log('Tip: You can backfill a JSON file via --file=<path>');
    return;
  }

  if (stories.length === 0) {
    console.log('No stories found in database.');
    return;
  }

  console.log(`Found ${stories.length} stories in database.\n`);

  let totalAbilitiesModified = 0;
  let totalBackgroundsModified = 0;

  for (const s of stories) {
    const fullStory = await StoryRepository.getStoryById(s.id);
    if (!fullStory || !fullStory.rpgSystem) continue;

    const { rpgSystem: updatedRpg, summary } = backfillRpgSystem(fullStory.rpgSystem);

    if (summary.abilitiesModified > 0 || summary.backgroundsModified > 0) {
      console.log(`[Story: ${fullStory.title} (${fullStory.id})]`);
      console.log(`  • Abilities backfilled: ${summary.abilitiesModified} / ${summary.abilitiesChecked}`);
      console.log(`  • Backgrounds backfilled: ${summary.backgroundsModified} / ${summary.backgroundsChecked}`);

      // Log details of updated abilities
      for (const ab of updatedRpg.abilities || []) {
        const specs = ab.rollModifiers || ab.activation?.effects || [];
        if (specs.length > 0) {
          const formatted = specs.map((sp: any) => describeRollModifier(sp)).join('; ');
          console.log(`    ↳ [${ab.type}] "${ab.name}": ${formatted}`);
        }
      }

      totalAbilitiesModified += summary.abilitiesModified;
      totalBackgroundsModified += summary.backgroundsModified;

      if (isWrite) {
        fullStory.rpgSystem = updatedRpg as any;
        const res: any = await StoryRepository.saveStory(fullStory as any);
        if (res && res.error) {
          console.error(`  ✗ Error updating story: ${res.error}`);
        } else {
          console.log(`  ✓ Updated in database`);
        }
      }
      console.log('');
    }
  }

  console.log('='.repeat(65));
  console.log(`Total Abilities Backfilled:   ${totalAbilitiesModified}`);
  console.log(`Total Backgrounds Backfilled: ${totalBackgroundsModified}`);
  if (!isWrite && (totalAbilitiesModified > 0 || totalBackgroundsModified > 0)) {
    console.log(`\nRe-run with --write to persist these changes to the database.`);
  }
  console.log('='.repeat(65));
}

main().catch((e) => {
  console.error('Fatal backfill error:', e);
  process.exit(1);
});
