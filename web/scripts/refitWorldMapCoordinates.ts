/**
 * Plan 19: refit world-map coordinates for legacy auto-allocation remnants.
 *
 * The historical Cartographer allocation (`ensureLocationCoordinates`) placed
 * unplaced locations on 10 hardcoded anchors + orbital offsets — coordinates
 * with zero relation to lore, topology, or terrain. This script runs the
 * deterministic Plan 19 layout solver and (optionally) persists the result.
 *
 * Dry-run by default: prints the audit summary + per-location diff table and
 * writes NOTHING. `--apply` persists the locations collection through
 * StoryRepository.updateLoreCollection (which also bumps worldBibleVersion so
 * in-flight play sessions stay pinned to the previous canon).
 *
 * Usage:
 *   npx tsx scripts/refitWorldMapCoordinates.ts --worldId=<uuid>
 *   npx tsx scripts/refitWorldMapCoordinates.ts --storyId=<id>
 *   npx tsx scripts/refitWorldMapCoordinates.ts --all                      # dry-run every world
 *   npx tsx scripts/refitWorldMapCoordinates.ts --worldId=<uuid> --apply
 *   npx tsx scripts/refitWorldMapCoordinates.ts --all --mode=full --apply  # also re-solve unknown pins
 */

// tsx CLI scripts don't auto-load .env — do it explicitly (Node 20.6+).
// IMPORTANT (ESM): static imports evaluate before any module body statement, so
// the repositories below are imported dynamically AFTER env loading — the DB
// gate (`ENABLE_DB === 'true'`) is read at storyRepository module-eval time.
const loadEnv = (process as unknown as { loadEnvFile?: (p?: string) => void }).loadEnvFile;
try {
  loadEnv?.call(process, '.env');
} catch {
  /* .env optional */
}

import type { WorldBible, WorldLocation } from '../src/lib/types/world';
import type { RefitMode } from '../src/lib/engines/world/mapLayoutSolver';

interface Options {
  worldId: string | null;
  storyId: string | null;
  applyAll: boolean;
  mode: RefitMode;
  seedOverride: number | null;
}

interface RefitTarget {
  label: string;
  /** worldId when known (required for persistence). */
  worldId: string | null;
  wb: WorldBible | null;
}

function parseOptions(): Options {
  const args = process.argv.slice(2);
  const readValue = (key: string): string | null => {
    const inline = args.find((a) => a.startsWith(`--${key}=`));
    if (inline) return inline.slice(key.length + 3).trim() || null;
    const idx = args.indexOf(`--${key}`);
    if (idx >= 0 && args[idx + 1] && !args[idx + 1].startsWith('--')) return args[idx + 1];
    return null;
  };
  const modeArg = (readValue('mode') ?? 'legacy').toLowerCase();
  if (modeArg !== 'legacy' && modeArg !== 'full') {
    console.error(`Invalid --mode "${modeArg}" (expected legacy | full).`);
    process.exit(1);
  }
  const seedArg = readValue('seed');
  const seed = seedArg !== null ? Number(seedArg) : NaN;
  if (seedArg !== null && !Number.isFinite(seed)) {
    console.error(`Invalid --seed "${seedArg}" (expected an integer).`);
    process.exit(1);
  }
  return {
    worldId: readValue('worldId'),
    storyId: readValue('storyId'),
    applyAll: args.includes('--apply'),
    mode: modeArg as RefitMode,
    seedOverride: Number.isFinite(seed) ? seed >>> 0 : null,
  };
}

async function collectTargets(opts: Options): Promise<RefitTarget[]> {
  const { StoryRepository } = await import('../src/lib/db/repositories/storyRepository');
  if (opts.worldId) {
    const wb = await StoryRepository.getWorldBibleByWorldId(opts.worldId);
    return [{ label: `worldId=${opts.worldId}`, worldId: opts.worldId, wb }];
  }
  if (opts.storyId) {
    const wb = await StoryRepository.getWorldBible(opts.storyId);
    let worldId: string | null = null;
    try {
      worldId = await StoryRepository.resolveWorldIdForStory(opts.storyId);
    } catch {
      /* worlds with no shared row stay null */
    }
    return [{ label: `storyId=${opts.storyId}`, worldId, wb }];
  }
  const worlds = await StoryRepository.getAllWorlds();
  const targets: RefitTarget[] = [];
  for (const w of worlds) {
    const wb = await StoryRepository.getWorldBibleByWorldId(w.id);
    targets.push({ label: `world ${w.name} (${w.id})`, worldId: w.id, wb });
  }
  return targets;
}

function padCell(value: string, width: number): string {
  const s = value.length > width ? `${value.slice(0, width - 1)}…` : value;
  return s.padEnd(width, ' ');
}

function mapDataOf(wb: WorldBible) {
  return wb.mapData ?? wb.ontology?.mapData ?? null;
}

async function refitTarget(
  target: RefitTarget,
  opts: Options,
  mods: {
    StoryRepository: typeof import('../src/lib/db/repositories/storyRepository')['StoryRepository'];
    solveMapLayout: typeof import('../src/lib/engines/world/mapLayoutSolver')['solveMapLayout'];
    stableSeedFromString: typeof import('../src/lib/engines/world/mapLayoutSolver')['stableSeedFromString'];
    auditWorldMapLayout: typeof import('../src/lib/engines/world/mapLayoutAuditor')['auditWorldMapLayout'];
    classifyCoordinates: typeof import('../src/lib/engines/world/mapLayoutAuditor')['classifyCoordinates'];
  }
): Promise<boolean> {
  console.log(`\n${'='.repeat(65)}`);
  console.log(`  World: ${target.label}`);
  console.log('='.repeat(65));

  const wb = target.wb;
  if (!wb) {
    console.warn('  No WorldBible found — skipping.');
    return false;
  }

  const audit = mods.auditWorldMapLayout(wb, mapDataOf(wb));
  const c = audit.counts;
  console.log(
    `  Audit: manual=${c.manual} solver=${c.solver} legacy_auto=${c.legacy_auto} unplaced=${c.unplaced} unknown=${c.unknown}`
  );
  for (const issue of audit.issues.slice(0, 6)) {
    console.log(`    • ${issue.en}${issue.fa ? `  |  ${issue.fa}` : ''}`);
  }
  const t = audit.topologySeparation;
  console.log(
    `  Topology: connectedMean=${t.connectedMean}px unconnectedMedian=${t.unconnectedMedian}px informative=${t.informative} computable=${t.computable}`
  );

  if (c.legacy_auto === 0 && c.unplaced === 0 && opts.mode === 'legacy') {
    console.log('  Nothing to refit in legacy mode (no remnants, no unplaced pins).');
    return false;
  }

  // Seed: explicit flag > worldId hash > worldName hash (deterministic per world).
  const seed =
    opts.seedOverride ??
    mods.stableSeedFromString(target.worldId ?? wb.worldName ?? target.label);

  const result = mods.solveMapLayout({
    locations: wb.locations ?? [],
    tradeRoutes: wb.tradeRoutes ?? [],
    mapData: mapDataOf(wb),
    mode: opts.mode,
    seed,
  });

  console.log(`\n  Solve result — ${result.summaryText}`);
  console.log(
    `  free=${result.freeNodeCount} anchors=${result.anchorCount} restarts=${result.restarts} iterations=${result.iterations} energy=${Number.isFinite(result.energy) ? Math.round(result.energy) : 'inf'}`
  );
  console.log('');
  console.log('  | Name                       | Provenance   | Before               | After      | Tags                      |');
  console.log('  |----------------------------|--------------|----------------------|------------|---------------------------|');
  for (const diff of result.diffs) {
    const cls = diff.before
      ? mods.classifyCoordinates({ coordinates: diff.before } as Pick<WorldLocation, 'coordinates' | 'coordinatesSource'>)
      : 'unplaced';
    const before = diff.before ? `(${diff.before.x},${diff.before.y})` : '(no pin)';
    const after = `(${diff.after.x},${diff.after.y})`;
    console.log(
      `  | ${padCell(diff.name, 26)} | ${padCell(cls, 12)} | ${padCell(before, 20)} | ${padCell(after, 10)} | ${padCell(diff.tags.join(','), 25)} |`
    );
  }
  if (result.diffs.length === 0) {
    console.log('  | (no placement candidates for this mode)                                                              |');
  }
  const movedCount = result.diffs.filter((d) => d.moved).length;

  if (!opts.applyAll) {
    console.log(`\n  DRY-RUN: ${movedCount} location(s) would move. Re-run with --apply to persist.`);
    return movedCount > 0;
  }

  if (!target.worldId) {
    console.error('  ✗ Cannot persist without a worldId (shared World row missing for this target).');
    return false;
  }

  const placementMap = new Map(result.placements.map((p) => [p.locationId, p]));
  const updatedLocations = (wb.locations || []).map((loc): WorldLocation => {
    const placement = placementMap.get(loc.id);
    if (!placement) return loc;
    return {
      ...loc,
      coordinates: placement.position,
      coordinatesSource: 'solver',
    };
  });

  const res = await mods.StoryRepository.updateLoreCollection(target.worldId, 'locations', updatedLocations);
  if (res && 'error' in res && res.error) {
    console.error(`  ✗ Persist failed: ${res.error}`);
    return false;
  }
  if (res && 'isMock' in res && res.isMock) {
    console.warn('  ⚠ Database inactive (mock path) — nothing was written.');
    return false;
  }
  console.log(`  ✓ Persisted ${updatedLocations.length} locations (canon version bumped).`);
  return movedCount > 0;
}

async function main() {
  const opts = parseOptions();

  // Dynamic imports AFTER env loading (ENABLE_DB is read at module-eval time).
  const { StoryRepository } = await import('../src/lib/db/repositories/storyRepository');
  const solverMod = await import('../src/lib/engines/world/mapLayoutSolver');
  const auditorMod = await import('../src/lib/engines/world/mapLayoutAuditor');

  console.log('='.repeat(65));
  console.log('  StoryForge — Plan 19 World Map Coordinate Refit');
  console.log('='.repeat(65));
  console.log(
    `Mode: ${opts.applyAll ? 'PERSIST (--apply)' : 'DRY-RUN (pass --apply to save)'} | refit=${opts.mode}`
  );
  if (!opts.worldId && !opts.storyId) {
    console.log('Scope: --all (every world); use --worldId= or --storyId= to narrow.');
  }

  const targets = await collectTargets(opts);
  if (targets.length === 0) {
    console.warn('No worlds/stories matched (is DATABASE_URL set and the DB reachable?).');
    return;
  }

  let changed = 0;
  for (const target of targets) {
    const didChange = await refitTarget(target, opts, {
      StoryRepository,
      solveMapLayout: solverMod.solveMapLayout,
      stableSeedFromString: solverMod.stableSeedFromString,
      auditWorldMapLayout: auditorMod.auditWorldMapLayout,
      classifyCoordinates: auditorMod.classifyCoordinates,
    });
    if (didChange) changed += 1;
  }

  console.log(`\n${'='.repeat(65)}`);
  console.log(`Worlds with refit candidates: ${changed}`);
  if (!opts.applyAll && changed > 0) {
    console.log('Re-run with --apply to persist.');
  }
  console.log('='.repeat(65));
}

main().catch((e) => {
  console.error('Fatal refit error:', e);
  process.exit(1);
});
