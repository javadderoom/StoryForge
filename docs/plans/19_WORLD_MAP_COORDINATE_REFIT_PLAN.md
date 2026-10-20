# Plan 19: World Map Coordinate Refit — Meaningful Cartographer Coordinates

Current location coordinates on the Cartographer canvas are **dead values**: auto-allocated remnants of an abandoned placement scheme (`ensureLocationCoordinates` hardcoded anchors + orbital offsets in `cartographerEngine.ts`). They carry no relation to lore, topology, terrain, or each other — yet the gameplay/travel engine derives turn counts from them (`estimateTravelTurns` divides pixel straight-line distance into "km"). Hand-authoring coordinates for every location cannot scale.

This plan replaces dead coordinates with **derived coordinates**: a deterministic, seeded layout solver that reads the truth already present in `WorldBible` (adjacency graph, trade routes, parent/child hierarchy, FA/EN directional lore text, terrain polygons) and computes positions that obey those constraints, with manual pins preserved as hard anchors.

> **Principle:** coordinates are a *projection of lore onto the canvas*, never handwritten integer soup. Like all derived state, they must be recomputable from canon, deterministic per world, and auditable.

---

## 1. Executive Summary & Problem Diagnosis

### 1.1 What is wrong today

| Symptom | Root cause | File |
| :--- | :--- | :--- |
| Distances between location pins are meaningless | `ensureLocationCoordinates` assigns 10 hardcoded anchor points + orbital offsets (`idx % 10`, ±35/25px rings) to unplaced locations | `web/src/lib/engines/world/cartographerEngine.ts` (~L381–422) |
| Travel ETA cannot discriminate distances | `estimateTravelTurns` divides pin distance by 45 and clamps 2..6; garbage inputs collapse into the same bucket | `travelEngine.ts:246`, `cartographerEngine.ts:470` |
| No provenance: remnants are indistinguishable from author intent | No stored "who placed this pin" signal on `WorldLocation.coordinates` | `types/world.ts:201` |
| Manual placement has no protection | Solver/manual tools have no notion of "this pin was dragged by a human" | `PixiCartographerCanvas.tsx:499` |
| Map plausibility is unaudited | No check that connected locations are closer than unconnected ones, that directional lore ("north of the capital") holds, or that pins avoid water | — |

### 1.2 What "right values" means (measurable)

Coordinates are correct when:

1. **Topology** — connected pairs / consecutive route stops are on average substantially closer than unconnected pairs.
2. **Hierarchy** — child locations orbit their parent deterministically (rings at 80px + 24px per ring; ≤ ~200px envelope for realistic fan-outs), never collision-clash with it.
3. **Directional lore** — FA/EN text claims ("در شمالِ پایتخت", "north of the capital") are satisfied or at least not violated systematically.
4. **Terrain plausibility** — pins do not sit inside ocean/sea/lake polygons.
5. **Readability** — all pins inside canvas margins (`CANVAS_WIDTH=2400`, `CANVAS_HEIGHT=1600`, 160px inset) with ≥ 56px separation (pin boxes are ±24px).
6. **Travel-math sanity** — with a per-world `kmPerSpatialUnit` scale set, neighbor journeys derive 2–6 turn ETAs instead of always clamp-saturating at 6.

### 1.3 Goals

- A **deterministic constraint solver** (`mapLayoutSolver.ts`) — zero model calls, seeded PRNG, runs client-side in milliseconds.
- A **layout auditor** (`mapLayoutAuditor.ts`) classifying legacy remnants and producing issue reports.
- **Provenance stamps** on `WorldLocation`: `coordinatesSource: 'manual' | 'solver' | 'legacy_auto'` (JSON field; no DB migration).
- Cartographer **auto-fit action** with explicit human confirmation, on-canvas preview via the existing local-draft flow, and a one-click **undo** snapshot.
- A **CLI refit script** (`scripts/refitWorldMapCoordinates.ts`) for batch migration across worlds, dry-run by default.
- **Scale calibration hook**: `WorldMapSettings.kmPerSpatialUnit` (default 1 → zero behavior change until a world opts in).

### 1.4 Non-goals

- No new DB tables or Prisma migrations (coordinates live in the `WorldBible.locations` JSON column).
- No AI-generated layout pass in this plan (a validated one-call Gemini assist is a possible follow-up; the solver is the authority either way).
- Automatic coordinate rewriting at gameplay time — coordinates change only via Author action.
- No change to `travelEngine`'s ETA model beyond the scale multiplication.
- No Flutter changes (the reader consumes `totalTurns` resolved server-side).
- No Cartographer settings UI for scale editing yet (the setting exists for engine math; a visual editor is a follow-up).

---

## 2. Design Principles

1. **Determinism**: same world + same seed → identical output bytes. All loops sorted by id; all randomness from a seeded `mulberry32` PRNG. This mirrors the house philosophy of remake-safe derived state (`travelEngine.ts` progress math).
2. **Manual is sacred**: pins stamped `manual` (dragged in the canvas) are hard anchors the solver reads but never moves.
3. **Legacy is detectable, not guessed**: old auto coords are identified by exact match against the anchor set / orbital-offset signature, and stamped `legacy_auto` when found — the stamp then makes detection trivial forever after.
4. **Constraints from canon, not taste**: the solver reads `connectedLocationIds`, `tradeRoutes`, `parentLocationId`, `region`, `category`, and free-text directionals. It invents no lore.
5. **Human confirms, computer proposes**: the Cartographer never silently rewrites coordinates; a confirm dialog presents counts, and the apply path is undoable in-session.
6. **Validation before persistence**: solver output passes the auditor before it may be written (client or CLI); failures surface as issues instead of silent garbage.
7. **Additive schema**: all new fields optional; old worlds, old sessions, and old clients keep working untouched.

---

## 3. Data & Schema Changes

### 3.1 `WorldLocation` (types/world.ts, ~L201)

```ts
coordinates?: { x: number; y: number };
/** Plan 19: who decided this pin's position. 'manual' = dragged in Cartographer
 * (solver never moves it); 'solver' = Plan 19 refit output; 'legacy_auto' =
 * remnant of the pre-Plan-19 auto allocation (safe to refit). */
coordinatesSource?: 'manual' | 'solver' | 'legacy_auto';
```

Zod: `coordinatesSource: z.enum(['manual', 'solver', 'legacy_auto']).optional()` in `WorldLocationSchema`.

### 3.2 `WorldMapSettings` (types/world.ts, ~L741)

```ts
/** Plan 19: canvas spatial units per km for travel math. 1 canvas unit ≙ 1 km
 * (legacy behavior). Tune per world once pins are meaningful (typ. 0.3–0.6). */
kmPerSpatialUnit?: number;
```

Zod: `kmPerSpatialUnit: z.number().positive().max(1000).optional()`.

### 3.3 Anchor export (cartographerEngine.ts)

- Export `LEGACY_AUTO_ANCHORS: ReadonlyArray<MapPoint>` (the same 10 anchors).
- `ensureLocationCoordinates` stamps `coordinatesSource: 'legacy_auto'` on positions it allocates, keeps existing coordinates exactly as-is.

---

## 4. The Constraint Model (`mapLayoutSolver.ts`)

New file: `web/src/lib/engines/world/mapLayoutSolver.ts`. Pure module — no React, no server imports.

### 4.1 Public API

```ts
export type RefitMode = 'legacy' | 'full';

export interface SolveRequest {
  locations: WorldLocation[];
  tradeRoutes: WorldTradeRoute[];
  mapData?: WorldMapData | null;      // terrain polygons for water avoidance
  canvas?: { width?: number; height?: number; inset?: number };
  mode: RefitMode;                    // 'legacy': legacy_auto + missing coords; 'full': everything non-manual
  seed: number;                       // stable per-world (hash of world id)
  minSeparation?: number;             // default 56
}
export interface SolveDiff {
  locationId: string;
  name: string;
  before: { x: number; y: number } | null;
  after: { x: number; y: number };
  moved: boolean;
  tags: string[];                     // e.g. ['legacy_auto', 'was_unplaced', 'topology', 'directional...']
}
export interface SolveResult {
  placements: Array<{ locationId: string; position: MapPoint; tags: string[] }>; // top-level + orbiting children
  diffs: SolveDiff[];
  freeNodeCount: number;
  anchorCount: number;
  iterations: number;
  restarts: number;
  energy: number;
  minSeparation: number;
  stats: { edgeCount: number; directionalCount: number; energies: number[] };
  summaryText: string;
}
export function solveMapLayout(req: SolveRequest): SolveResult;
export function extractDirectionalConstraints(locations, weight?): DirectionalConstraint[];
export function stableSeedFromString(input: string): number;   // FNV-1a
export function createRng(seed: number): () => number;          // mulberry32
export function buildMapMasks(mapData): MapMasks;
export function isWaterPoint(masks, p): boolean;
export function prefersWaterRegion(loc): boolean;               // sea/ocean-style names
export function matchesLegacyAnchorSignature(p, anchors?): boolean;
```

### 4.2 Constraint extraction

**Edges (springs)** — determinism first, strongest last:

| Family | Source | Ideal length | Weight |
| :--- | :--- | :--- | :--- |
| Adjacency | `connectedLocationIds` (deduped by sorted pair) | 420 | 1.0 |
| Trade route | consecutive stops of each route (both mapped) | 460 | 1.1 |
| Region kinship | same `region` text (exact string match) | 620 | 0.12 |
| Directional | lore text (below) | — (clamp) | 0.6 |

**Directional extraction** (`extractDirectionalConstraints`): each location's own text block (`description`, `region`, `specialRules`, first 240 chars of `atmosphere`) is scanned for `DIR + other-name` within ~20 characters:

- EN: longest-first direction tokens `northeast|northwest|southeast|southwest|north|south|east|west` followed by `(?:of |-)`; FA: `شمال|جنوب|شرق|غرب` (+ ezafe/optional ی).
- Candidate names are matched with the **same normalizer as the validator** (reuse the exported `normalizeForMatch` from `travelEngine.ts`; single source of truth, ZWNJ- and diacritic-insensitive).
- Produces asymmetric clamp constraints: `A north of B` ⇒ require `B.y − A.y ≥ 240`; `southeast` compiles to two axis clamps (x>0, y>0). Interpretation: the location is placed DIR of the target ("A is north of B" ⇒ A above B).
- Limitation (accepted, weight 0.6): text like "the capital lies south of it" written inside A's description yields the inverted constraint. The auditor reports the count, not fatal errors.

**Category interactions**: setters for `category: 'settlement'|'stronghold'` pins get +40% collision mass (they should not be crowded by wilderness/dungeon nodes when space is tight).

**Terrain**: `mapData.terrainFeatures` polygons are split into:
- `landMasks` — `polygon` of `continent` / `island` (carved `holes` count as water),
- `waterMasks` — `polygon` of `ocean` / `sea` / `lake`.
Places must not rest inside water, and must not rest outside every landmass when one is painted. Exception — `prefersWaterRegion(loc)`: sea/ocean/lake/gulf-style locations **modeled as locations** (a common pattern: the sea itself is a travel node, e.g. «دریای باختر») invert the rule and steer **into** water polygons. Detection is name-based in FA + EN (deterministic, no schema change), shared by the solver (`waterLegal`) and the auditor (symmetric violation reporting). All arithmetic uses ray-cast point-in-polygon with degenerate/zero-area guards.

**Hierarchy**: nodes with `parentLocationId` (resolved inside the world) are **excluded from global layout**; they orbit their parent deterministically: 8 children per ring, ring radius `80 + 24 * ring` (keeps adjacent siblings ≥ ~60px apart), golden-angle distribution. Children keep manual positions if present. Orbit bases **chain**: a parent that is itself somebody's child uses its own *new* orbit position (multi-pass resolution, ≤ depth passes) so nested hierarchies (continent → region → bridge → shops) never orbit a stale pre-refit pin.

### 4.3 The solver

Seeded Fruchterman–Reingold with annealed temperature + projection passes:

1. **Init** (per restart r): sunflower spiral `(r = c·√i, θ = i·goldenAngle + restartOffset)`, clipped to the canvas inset; nodes with manual/legacy-stable coordinates irrelevant (they are anchors, outside the free set). Restarts: 6, offsets from a seeded per-restart PRNG.
2. **400 iterations ×** (deterministic order):
   - spring forces per edge family,
   - local repulsion (range-bounded, magnitude capped by temperature),
   - directional clamp force when projection < 240,
   - weak global cohesion toward the live centroid (keeps sparse/vacuum constraint sets centered on the canvas instead of hugging borders; rate 0.01, comparator weight 2·10⁻⁵),
   - water/land steering toward the legal side of the mask (`waterLegal`, compass-sampled),
   - per-axis displacement clamp to `T`,
   - boundary clamp inside `[inset, size − inset]`,
   - temperature decay `T = 30 → 2` linear.
3. **Collision projection**: 60 passes pushing each violating sorted pair apart by 60% of overlap (mass-weighted), clamping bounds after each pass.
4. **Water projection**: repeat ≤ 20 passes — pins on the illegal side of the mask teleport to the nearest legal sampled position; a short 6-pass repair runs again after the final collision projection.
5. **Select** lowest final energy of the 6 restarts (springs + overlaps + directional deficits + cohesion), round to integer px.
6. Compute `diffs` with classification tags (`solver`, `legacy_auto`, `was_unplaced`, `topology`, `directional`, `water`, `child_orbit`).

**Complexity**: O(iterations × N² + restarts × N²). For the expected N ≤ 120 top-level locations this is well under ~50ms; no worker needed.

**Determinism guarantee tests**: same request → identical `diffs` byte-for-byte; different seed → legal but different arrangement allowed.

### 4.4 The auditor (`mapLayoutAuditor.ts`)

```ts
export type CoordinateClass = 'manual' | 'solver' | 'legacy_auto' | 'unplaced' | 'unknown';
export function classifyCoordinates(loc, anchors?): CoordinateClass;
export function auditWorldMapLayout(wb, mapData?, options?): MapAuditReport;

export interface MapAuditReport {
  counts: { manual, solver, legacy_auto, unplaced, unknown };
  minSeparationViolations: Array<{ a: string; b: string; distance: number }>;
  parentFlungIds: string[];
  waterViolationIds: string[];
  directional: { satisfied: number; violated: number; unresolvable: number };
  topologySeparation: { connectedMean: number; unconnectedMedian: number; informative: boolean; computable: boolean };
  legacyDetected: boolean;
  issues: MapAuditIssue[];             // { code, fa, en, exampleIds } — bilingual for UI
}
```

- **Remnant signature finding (validated against the real database)**: the allocator never emits a position exactly ON an anchor — with `offset = floor(idx / 10)`, the allocated point is `anchor + (k·70 − 35, k·50 − 25)` for the same integer `k ≥ 0`. The raw anchor coordinate is therefore *not* a remnant (classification `unknown`, safe default). Detection rule: `(Δx + 35) % 70 === 0 && (Δy + 25) % 50 === 0` relative to any anchor with the SAME shared quotient `k ≥ 0`.
- `legacyDetected`: any `legacy_auto` or `unplaced` count exists.
- `informative`: `connectedMean < unconnectedMedian × 0.9` (only when both are computable) — the headline "this map carries topological information" metric.
- Water checks are symmetric with the solver: land-bearing pins on water are violations, and `prefersWaterRegion` pins (seas modeled as locations) on dry land are violations too.
- The same report surfaces in the Cartographer auto-fit confirm dialog and the CLI.

---

## 5. Cartographer UX (client integration)

### 5.1 Trigger — `CartographerHeader.tsx`

New action button (icon `Wand2`, RTL-title "چیدمان خودکار مختصات / Auto-fit coordinates") beside the AI Oracle button, with props `onAutoFit`, `canUndoAutoFit`, `onUndoAutoFit`.

### 5.2 Flow — `cartographer/page.tsx` (`handleAutoFit`)

1. Build the request from local `story.worldBible` + `mapData` (falling back through `ontology.mapData`) + `stableSeedFromString(selectedWorldId || worldId || worldName)`, `mode: 'legacy'`.
2. Audit first; if no legacy_auto and no unplaced pins, an info toast short-circuits (never silent no-ops).
3. Show `notify.confirm` summarizing: N legacy remnants, M unplaced, K manual pins preserved, plus the audit's first issues (bilingual).
4. On confirm → run solver → **apply locally** through the existing `updateWorldBible` draft flow (the Pixi canvas re-renders instantly from state — this *is* the preview), stamping `coordinatesSource: 'solver'` on moved pins.
5. Keep an **undo snapshot** (touched ids with their previous `coordinates` + `coordinatesSource`) in page state; the header shows an "Undo auto-fit" pill while a snapshot exists. Undo restores both coordinates AND provenance stamps exactly; re-apply keeps only the newest snapshot; `saveToServer` makes the current state canon.
6. Success toast with `result.summaryText`; the save hint reminds the author to persist.

Manual pin drags (`PixiCartographerCanvas.tsx` `commitDragEnd`) now pass `coordinatesSource: 'manual'` so refits protect them.

### 5.3 Issues panel

The modal's confirm step displays the top issues from the audit (overlaps, directional violations count, legacy detection) so the author sees *why* the refit is recommended.

---

## 6. CLI Migration (`scripts/refitWorldMapCoordinates.ts`)

Following the `backfillStructuredAbilities.ts` house pattern:

```bash
# Dry run (default): prints per-location diff table + audit summary, writes nothing
npx tsx scripts/refitWorldMapCoordinates.ts --all                    # every world (default scope)
npx tsx scripts/refitWorldMapCoordinates.ts --worldId=<uuid>         # single world
npx tsx scripts/refitWorldMapCoordinates.ts --storyId=<id>
# Apply: persists locations via StoryRepository.updateLoreCollection(worldId, 'locations', ...)
# (which also bumps worldBibleVersion, keeping in-flight sessions pinned)
npx tsx scripts/refitWorldMapCoordinates.ts --worldId=<uuid> --apply
npx tsx scripts/refitWorldMapCoordinates.ts --worldId=<uuid> --mode=full --seed=12345 --apply
```

- Accepts `--worldId` or `--storyId` (resolved via `resolveWorldIdForStory`); `--all` scans every world and is the default scope when no selector is given.
- `--mode=legacy|full` (default `legacy`); optional `--seed=<n>` overrides the per-world stable seed for experimentation.
- Loads world locations + trade routes + terrain (`mapData` falling back through `ontology.mapData`) from the shared `WorldBible` row.
- **Dry-run by default**; `--apply` is the only write path.
- Exits non-zero on total failure; prints audit after apply.

---

## 7. Travel Math Hookup (scale calibration)

`estimateTravelTurns` gains `etaOptions.kmPerSpatialUnit` (default 1); `planJourney` reads `worldBible.mapData?.settings?.kmPerSpatialUnit ?? 1` (falling back through `ontology.mapData` like the Cartographer does). Default 1 preserves today's numbers exactly; per-world tuning becomes possible once the refit lands. The `immediate-hop` rule (`raw ≤ 1` + no waypoints) and the 2..6 clamp are unchanged.

---

## 8. Tests (auto-discovered by `scripts/testAll.ts` under `src/`)

- `mapLayoutSolver.test.ts`
  - determinism: identical seed → byte-identical `placements`/`diffs`/child-orbit positions; other seed → valid but distinct arrangement allowed
  - mode semantics: manual pins never moved; `legacy` touches only `legacy_auto` + missing coords; `full` re-solves all non-manual
  - properties: min separation honored; connected-edge mean < unconnected-pair median; directional clamp satisfied for a simple fixture ("A north of B"); children orbit ≥ 48px from the parent pin and within the 200px ring envelope across nested chain depths
  - water: land pins avoid painted water; sea/ocean-style regions modeled as locations rest **inside** painted water
  - legacy classification: exact-anchor coords are NOT remnants (k-signature `(Δx+35)%70 && (Δy+25)%50`, same shared quotient k ≥ 0); different k values → not remnants; offsets that match no anchor → `unknown`, not `legacy_auto`
- `mapLayoutAuditor.test.ts`
  - stamp priority (`manual` > `solver` > `legacy_auto` > `unplaced` > `unknown`) and the anchor-sync bridge for unknown-provenance pins
  - symmetric water violations: land pins on water AND `prefersWaterRegion` (sea-as-location) pins on dry land, plus `legacyDetected` roll-up and degenerate/unresolvable-data guards
  - directional satisfaction/violation counts including inverted-perspective prose; parent-flung detection
- `travelEngine.test.ts` (extension)
  - `kmPerSpatialUnit = 1` → unchanged ETAs; `0.5` → halves distance-derived days (still clamped); missing settings → default 1

---

## 9. Acceptance Criteria

1. `npm run test` passes with the new suites green.
2. Same-seed refit of an unchanged world produces byte-identical coordinates.
3. With the Cartographer open, "Auto-fit" moves only legacy/unplaced pins, never a manually dragged pin, and shows a preview through the live canvas before "Apply".
4. After undo (unsaved), the previous state is exactly restored — including provenance stamps.
5. The CLI dry-run mutates nothing; `--apply` bumps `worldBibleVersion` and persists reachable locations.
6. Worlds that never set `kmPerSpatialUnit` get byte-identical travel ETAs to pre-Plan-19 code.

---

## 10. Risks & Edge Cases

| Risk | Mitigation |
| :--- | :--- |
| Legacy detection misses coords edited numerically by hand long ago | Audit's `legacyDetected` is only advisory; `--mode full` refits them; provenance stamps make future classification trivial |
| Directional extraction misreads inverted-perspective prose | Low weight (0.6), soft constraint; auditor counts satisfied/violated; further tuning after real-world usage |
| Water polygons make placement infeasible (tiny islands everywhere) | Water-projection falls back to nearest non-water sample; if canvas has no land, water check is skipped for that world |
| Locations outside mapData (map never initialized) | Solver treats the whole inset as land |
| Old sessions referencing legacy locations mid-journey | Coordinates aren't referenced by ActiveTravel timeline math — purely visual + ETA; trips in flight are unaffected |
| Extremely large worlds (300+ top-level locations) | O(N²) forces stay well under ~50 ms to ~200 top-level nodes; beyond that the canvas simply saturates — acceptable for current story scope |

---

## 11. Rollout

1. **Phase 1** — types + zod, anchor export + stamping, `mapLayoutAuditor.ts`.
2. **Phase 2** — `mapLayoutSolver.ts` + full deterministic test suite.
3. **Phase 3** — Cartographer header action, modal flow, undo pill, manual-stamp on drag.
4. **Phase 4** — CLI migration script (dry-run default).
5. **Phase 5** — `kmPerSpatialUnit` engine hookup + tests.
6. **Commit policy**: land code + plan in commits relative to each phase; commit locally at completion; **never push automatically** (repo rule).

Future follow-ups (explicitly out of scope here): validated single-call Gemini layout assist, visual scale editor in map settings, and travel-ETA recalibration guides.
