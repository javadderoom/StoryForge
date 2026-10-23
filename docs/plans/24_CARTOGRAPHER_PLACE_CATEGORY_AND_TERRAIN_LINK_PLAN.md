# Plan 24 — Cartographer Place Categories and Semantic Terrain Links

Status: in progress — category metadata, terrain links, category-aware rendering/picking and the semantic audit are implemented; backfill/reconciliation actions are pending
Depends on: Plan 19 (coordinate refit), Plan 21 (map-object layers), Plan 23 (multi-selection)

## Problem

The Cartographer currently has two independent models that look like one model in
the UI:

1. **Places** — `WorldLocation` records in the World Bible. These are the
   story-facing entities referenced by `StoryBeat.locationId`,
   `NPCDossier.currentLocationId`, trade-route endpoints, parent/child
   locations, travel and prompt assembly.
2. **Map geometry** — `MapTerrainFeature` records in
   `worldBible.mapData.terrainFeatures`. These are the drawn continents, rivers,
   mountain ranges, forests, lakes and other physical shapes.

Before the Cartographer existed, authors created rivers, steppes, seas and other
non-city places as ordinary `WorldLocation` records with a different
`category`. That was correct for the story graph: a river can be a place a scene
happens at, a route crosses, or an NPC visits.

The Cartographer then introduced `MapTerrainFeature.type` for the same physical
world. The two models were never connected.

The result is three visible inconsistencies:

- A river or steppe stored as a `WorldLocation` is rendered with the same
  settlement shield as a city, because the renderer treats every location as a
  settlement pin.
- The Cartographer Inspector hardcodes seven settlement-oriented categories
  (`capital`, `stronghold`, `trade_port`, `sanctuary`, `settlement`, `dungeon`,
  `ruins`) and ignores the real ontology registry.
- The “Map Objects” list groups terrain types as `landmass / water / range /
  valley / biome`. Those are **render groups**, not place categories. Comparing
  them with the manifest’s place categories is inherently confusing.

## Current taxonomy

### Place categories

The canonical place categories live in
`worldBible.ontology.placeCategories` and are normalized by
`normalizeOntology()` in `web/src/lib/context/StudioStoryContext.tsx`:

| ID | Meaning |
| --- | --- |
| `settlement` | Cities, towns, trade docks, civilian hubs |
| `stronghold` | Fortresses, watchtowers, frontier outposts |
| `ruins` | Fallen civilizations, shrines, sunken cities |
| `dungeon` | Crypts, prisons, mines, cave networks |
| `plains` | Fertile lowlands, pastures, steppe, rolling hills |
| `waterway` | Major rivers, freshwater lakes, transit valleys |
| `seas` | Oceans, seas, gulfs, straits, archipelagos |
| `wilderness` | Deserts, arid steppes, forests, wetlands, frozen ridges |
| `anomaly` | Whirlpools, rifts, exotic physical phenomena |

Custom place categories are allowed and are already stored in the ontology.
`capital`, `trade_port` and `sanctuary` are commonly used examples that are not
in the default list.

### Terrain types

`MapTerrainType` in `web/src/lib/types/world.ts` is a rendering vocabulary:

`continent`, `island`, `ocean`, `sea`, `lake`, `river`, `mountain_range`,
`peak`, `volcano`, `valley`, `canyon`, `chasm`, `forest`, `desert`, `tundra`,
`swamp`, `wasteland`, `plains`, `oasis`, `arcane_anomaly`.

A place category and a terrain type are not the same thing. One place can be
realized by several terrain features (a kingdom with a river, a forest and a
mountain range); one terrain feature belongs to at most one semantic place.

## Decision

Keep the dual model. Do **not** move all locations into a new entity, and do not
convert existing non-city places into terrain-only records.

The rule is:

> `WorldLocation` is what the story can refer to.
> `MapTerrainFeature` is how that place is drawn.
> `MapTerrainFeature.locationId` is the optional bridge between them.

This preserves every existing story reference, route endpoint and NPC station.
It also lets purely decorative terrain exist without inventing a story location
for every rock and lake.

## Proposed data model

### 1. Optional semantic link on terrain

Add one optional field to `MapTerrainFeature`:

```ts
/**
 * The WorldLocation this geometry realizes. Point places use
 * WorldLocation.coordinates instead; area/line places use this link.
 */
locationId?: string;
```

One place can own many features. Each feature has at most one owning place.
Do not add a redundant `mapFeatureIds` array to `WorldLocation`; the terrain
side remains the single source of truth for the link.

### 2. Rendering metadata on place categories

Extend `CustomPlaceCategory` with optional rendering hints:

```ts
geometryKind?: 'point' | 'line' | 'area' | 'region';
renderAs?: 'settlement' | 'label' | 'line' | 'water' | 'anomaly';
mapTerrainTypes?: MapTerrainType[];
```

All fields are optional so existing worlds remain valid. Canonical categories
receive defaults in `getDefaultOntology()`; custom categories default to
`point` + `settlement` so no existing pin disappears.

Suggested defaults:

| Place category | `geometryKind` | `renderAs` | `mapTerrainTypes` |
| --- | --- | --- | --- |
| `settlement` | `point` | `settlement` | — |
| `stronghold` | `point` | `settlement` | — |
| `ruins` | `point` | `settlement` | — |
| `dungeon` | `point` | `settlement` | — |
| `capital` | `point` | `settlement` | — |
| `trade_port` | `point` | `settlement` | — |
| `sanctuary` | `point` | `settlement` | — |
| `plains` | `area` | `label` | `plains`, `forest`, `desert`, `tundra`, `wasteland` |
| `wilderness` | `area` | `label` | `forest`, `desert`, `tundra`, `swamp`, `wasteland` |
| `waterway` | `line` | `line` | `river`, `lake` |
| `seas` | `area` | `water` | `ocean`, `sea`, `lake` |
| `anomaly` | `area` | `anomaly` | `arcane_anomaly` |

“Steppe” does not need a new terrain primitive immediately: the `plains`
terrain type plus the `plains` or `wilderness` place category covers it. If
authors need a distinct visual material, add `steppe` to `MapTerrainType` and
the texture palette as a separate change.

## UI behaviour

### Category source of truth

All of these must read `normalizeOntology(worldBible.ontology,
isPersian).placeCategories`:

- Studio locations directory, form and facets;
- Cartographer Inspector’s category selector;
- Cartographer entity palette filters;
- Oracle Easy Insert / `ActionNormalizer`;
- any legend or category badge.

The hardcoded `SETTLEMENT_CATEGORIES` list in
`CartographerInspector.tsx` must be removed. It currently omits `plains`,
`waterway`, `seas`, `wilderness`, `anomaly` and every custom category.

### Object list labels

- **Map Objects** shows terrain type/group (`Landmass`, `Water`, `Range`,
  `Valley`, `Biome`) and is the drawing layer.
- **Locations** shows place categories (`Settlement`, `Waterway`, `Wilderness`,
  etc.) and is the story layer.
- A terrain row may show its linked place name; a location row may show its
  linked terrain count.
- Do not label a terrain type as a “category” in the UI.

### Inspector

- Terrain Inspector gets an optional **Narrative place** selector
  (`locationId`).
- Location Inspector gets a read-only **Drawn as** summary listing linked
  terrain features, plus a “Link existing terrain” action.
- Point places continue to use coordinates and have no terrain link
  requirement.

## Renderer behaviour

`renderSettlements` must become category-aware instead of drawing every
location as a shield:

- `renderAs: 'settlement'` → existing shield/pin and label;
- `renderAs: 'label'` → label at the linked area/region centroid, or at
  `coordinates` when no geometry exists;
- `renderAs: 'line'` → highlighted linked river/valley line and label;
- `renderAs: 'water'` → linked water area label; no shield;
- `renderAs: 'anomaly'` → anomaly glyph or linked area; no shield.

If a non-point place has no linked geometry, render a temporary muted label
(e.g. “Unlinked: Ashen Ford”) rather than a city shield. This makes the
reconciliation backlog visible instead of silently pretending the river is a
town.

`mapHitTest` and `mapSelection` must use the same rule so a non-point place is
picked through its linked geometry or label, not through a phantom settlement
pin.

## Backfill / migration

No destructive migration.

1. Normalize names (lowercase, trim, collapse punctuation) and match each
   non-point `WorldLocation` to terrain features with the same or a very similar
   name.
2. If exactly one match exists, set `MapTerrainFeature.locationId`.
3. If several matches exist, leave all candidates unlinked and surface the
   location in a reconciliation panel.
4. If no match exists, leave the location unlinked and show the temporary label.
   Optionally offer “Create terrain from this place” using the category’s
   default terrain type and a centroid/area derived from the place’s coordinates
   or child locations.
5. Never rewrite or delete the location as part of backfill.
6. A separate, explicit “Convert place to terrain only” action may be added for
   genuinely unused locations, after showing all references that would be
   affected.

The reconciliation report should include:

- non-point locations with no linked terrain;
- terrain features with a `locationId` pointing at a missing location;
- duplicate normalized names;
- non-point locations still rendered as settlement pins;
- story beats, NPC stations and routes that reference missing locations.

## Validation

Add a map/story integrity audit, either in the existing layout auditor or a new
`auditWorldMapSemantics()`:

- every `StoryBeat.locationId` and `initialStoryBeats[].locationId` resolves;
- every `MapEntityPlacement.entityId` resolves for its `entityType`;
- every trade-route endpoint and intermediate stop resolves;
- every `MapTerrainFeature.locationId` resolves;
- every location category resolves in the ontology (or is reported as custom);
- non-point categories are not rendered as settlement pins;
- duplicate semantic names and terrain names are reported.

Warnings should be non-blocking in the Studio. Publish may optionally fail when
a story beat references a missing location, because that is a broken narrative
edge.

## Implementation phases

### Phase 1 — Category truth and inspector alignment

- Extend `CustomPlaceCategory` with optional rendering metadata.
- Add canonical defaults in `getDefaultOntology()`.
- Replace the hardcoded Cartographer category list with the ontology registry.
- Make Studio and Cartographer category labels/colors consistent.
- Add tests for `normalizeOntology()` preserving custom categories and adding
  new canonical ones.

### Phase 2 — Link model and inspector

- Add `MapTerrainFeature.locationId?: string` to the type and Zod schema.
- Add the terrain “Narrative place” selector and location “Drawn as” summary.
- Add copy/paste and group-move handling: copying a linked terrain should keep
  the same `locationId` only when the linked location is copied in the same
  batch; otherwise drop the link (the copy is not the original place).
- Add validation for dangling links.

### Phase 3 — Category-aware rendering and picking

- Split settlement rendering from location rendering.
- Render point categories as shields, area/line categories through linked
  terrain, and unlinked non-point categories as muted labels.
- Update hit testing and marquee selection to follow the same rule.
- Add tests for each `renderAs` mode and unlinked fallback.

### Phase 4 — Backfill and reconciliation UI

- Implement name/containment matching.
- Add the reconciliation panel and explicit “Create terrain from place”.
- Add the semantic audit report.
- Run against the production story snapshot, then against the live world after
  author confirmation.

## Non-goals

- Do not merge `WorldLocation` and `MapTerrainFeature` into one entity.
- Do not delete non-city `WorldLocation` records.
- Do not make `MapTerrainType` the same enum as place category.
- Do not attach story beats directly to terrain feature IDs; locations remain
  the narrative anchors.
- Do not make every decorative terrain feature a story location.

## Acceptance criteria

- The Cartographer Inspector lists exactly the ontology place categories,
  including custom ones.
- A `waterway` location with a linked `river` terrain feature renders as a
  river/line label, not a settlement shield.
- A `plains`/`wilderness` location with a linked area feature renders as an
  area label.
- A point settlement still renders exactly as it does today.
- Existing locations, story beats, NPC stations and trade routes keep their IDs
  and references.
- Unlinked non-point locations are visible in a reconciliation report and are
  never silently converted.
- `tsc --noEmit`, the map/location test suites and `next build --webpack` pass.

## Implemented so far

- `web/src/lib/engines/world/placeCategories.ts` — canonical category
  metadata, ontology overrides, custom-category fallback.
- `web/src/lib/types/world.ts` — `PlaceGeometryKind`, `PlaceRenderAs`,
  category rendering fields, `MapTerrainFeature.locationId`.
- `StudioStoryContext.getDefaultOntology()` — canonical categories now carry
  geometry/render metadata; `normalizeOntology()` upgrades existing worlds and
  preserves custom categories.
- `CartographerInspector` — category dropdown now reads
  `ontology.placeCategories`; terrain inspector has a **Narrative Place**
  selector; location inspector shows linked terrain and warns when a non-point
  place has none.
- `CartographerEntityPalette` — shows linked place names on terrain rows and a
  reconciliation banner for unlinked places / broken links.
- `entitiesRenderer.renderSettlements()` — point categories keep shields; area,
  line, water and anomaly categories render as quiet labels instead.
- `mapHitTest` and `mapSelection` — non-point places are no longer phantom
  settlement click targets or marquee/Ctrl+A members; linked terrain remains
  selectable.
- `mapSelection.cloneMapClipboard()` — a copied terrain keeps `locationId` only
  when the linked place is copied in the same batch.
- `mapSemantics.ts` — `auditMapSemantics()` and
  `getMapSemanticReconciliation()` cover missing beat/pin/route/terrain
  references, unlinked non-point places and duplicate names.
- Tests: `placeCategories.test.ts`, `mapSemantics.test.ts`, plus new hit-test,
  selection and clipboard cases. Full suite: 1440 tests, 1435 passing, 5
  unrelated DB tests cancelled.

### Still pending

- Automatic name/containment backfill of `locationId`.
- Explicit “Create terrain from this place” and “Convert place to terrain only”
  actions.
- A dedicated reconciliation panel with per-row fixes (the palette currently
  surfaces the counts; the inspector handles one object at a time).
- Optional publish gating on broken scene/pin/route references.

## Open questions

1. Should `capital`, `trade_port` and `sanctuary` become canonical categories
   with rendering defaults, or remain recommended custom examples?
2. Should “steppe” become a first-class terrain type with its own material, or
   remain a `plains`/`wilderness` place mapped to the `plains` terrain?
3. Should a non-point location with no linked geometry render a muted label, a
   region centroid icon, or nothing plus a warning badge?
4. Should publish block on missing `StoryBeat.locationId`, or only warn?
5. Can one terrain feature belong to multiple places (e.g. a mountain range
   spanning three kingdoms), or is one owner enough? The proposed model assumes
   one owner; a `locationIds?: string[]` extension can be added later if real
   worlds require it.