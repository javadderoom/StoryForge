# Plan 21 — Cartographer Map Object Layers & Erasability

**Status:** implemented (Phase 1 + Phase 2).
**Progress tracker:** hindsight bank `StoryForge`, document `storyforge-plan-21-map-object-layers`.

## The problem

Two complaints from the author, both correct and both structural:

1. **"Everything is permanent."** Objects could not be erased. The only erase
   paths were the Land Brush's *Carve* mode (land only), *Reset Sea* (which
   wiped every terrain feature while the label claimed "landmasses"), and
   undo (LIFO, 50 deep).
2. **"No layer system with objects for land."** `CartographerLayerPanel` was 15
   category visibility booleans; `CartographerEntityPalette` listed only
   manifest entities. The map's own geometry — `mapData.terrainFeatures` and
   `mapData.placements` — had no list UI anywhere in the app.

## Root cause (verified in code)

| # | Finding | Location |
|---|---|---|
| 1 | The spatial index only indexed a terrain feature when it had `x`/`y`. Authored shapes are polygon/polyline (`polygon`/`points`) and never carry `x`/`y`, so they were never indexed → the Select tool could not hit them → the Inspector's *Delete Terrain* button was unreachable for exactly what the author draws. | `PixiCartographerEngine.ts` `rebuildSpatialIndex` |
| 2 | `mapData.placements` (lore pins) were never indexed. A pin was "selected" only in the frame right after placement, then unreachable forever. | same |
| 3 | Trade route lines were indexed per-waypoint only; clicking the route stroke did nothing. | same |
| 4 | `landSculptEngine.applySculptOperation` rebuilt land features from an explicit field list, so non-geometric fields (`elevation` today; `visible`/`locked`/`zIndex` tomorrow) were silently dropped on every brush stroke. | `landSculptEngine.ts` |
| 5 | *Reset Sea* called `onReplaceTerrain([])` — it removed every terrain feature, including the author's ranges, rivers and biomes, despite the label saying "landmasses". | `PixiCartographerCanvas.tsx` |

## Decisions (author-confirmed)

- Scope: Phase 1 + Phase 2 in this pass. Phase 3 deferred (multi-select,
  dragging polygons/pins, vertex editing, right-click context menu).
- The object list lives as a new **"Map Objects" tab inside the World Bible
  Palette drawer**.
- Per-object controls are **persisted with the world**: visibility + lock +
  z-order.
- **"Clear land & water"** removes `continent`, `island`, `ocean`, `sea`,
  `lake` and preserves ranges, valleys, rivers, biomes and lore pins.

## Phase 1 — Erasability

- **New pure module `web/src/lib/engines/world/mapHitTest.ts`** — geometry
  accurate picking: point-in-polygon for fills (honouring `holes`),
  distance-to-segment for polylines, radius for points, pin grabs, route
  strokes.
  - Priority tiers: `0` pins/locations/waypoints → `1` point terrain → `2`
    lines → `3` areas. Ties: nearest → highest z → smallest area.
  - Hidden (`visible === false`) and locked (`locked === true`) objects are
    never picked.
- **`PixiCartographerEngine`** — the spatial index now holds *every* authored
  shape (bbox from `polygon`+`holes`, buffered `points`, or `x`/`y`), plus
  placements and route strokes. RBush stays the coarse filter; `pickAt` runs
  the exact geometry test on the candidates.
- **`PixiCartographerCanvas`** — the Select branch uses `pickAt`, so terrain
  (any geometry), lore pins and trade routes become selectable. The Inspector
  opens, **Delete works**, and every delete is undoable because it goes
  through `commit()`.
- **Delete key** on the canvas deletes the current selection (confirm dialog,
  undoable).
- **"Clear land & water"** replaces *Reset Sea* and now removes land and
  standing water only.

## Phase 2 — Object layers

- **Persisted fields** (zod only — `mapData` is JSON inside the manifest row,
  so there is **no DB migration**):
  - `MapTerrainFeature { visible?: boolean; locked?: boolean; zIndex?: number }`
  - `MapEntityPlacement { visible?: boolean; locked?: boolean; zIndex?: number }`
  - Left `undefined` (no `.default()`) so existing production data is not
    rewritten just by being saved.
- **New pure module `web/src/lib/engines/world/mapObjectOrder.ts`** — draw
  bands (ocean → land → biome → water → line → range), object groups
  (landmass / water / range / valley / biome), effective z, ordering and
  reordering.
- **`renderTerrain` is now ONE z-ordered pass** instead of five hard-coded
  category loops. The default z of every object reproduces the historical
  stacking exactly, so a world that never touches the layer controls looks
  identical — while any object can be raised above the coastline band.
  - Side effect: the missing `valley` / `canyon` / `chasm` renderer was added
    (Cartographer truth audit item #2), and `ocean` / `sea` bodies now draw as
    the base sheet.
- **New "Map Objects" tab in `CartographerEntityPalette`** — grouped list
  (Landmasses / Waters / Ranges / Valleys / Biomes / Lore pins) with per row:
  eye, lock, inline rename, type badge, bring-forward / send-backward,
  delete (confirm), and click = select + centre the camera.
- **The sculpt engine preserves non-geometric fields** — the parent is spread
  rather than rebuilt from a field list, so `visible` / `locked` / `zIndex` /
  `elevation` survive a brush stroke.

## Tests

`node --import tsx scripts/testAll.ts` → **1343 / 1343**.

- `mapHitTest.test.ts` — geometry primitives, picking every authored shape,
  holes, tier priority, hidden/locked exclusion, candidate construction.
- `mapObjectOrder.test.ts` — bands, effective z, render order, groups,
  reordering, centring.
- `landSculptEngine.test.ts` — non-geometric fields survive a stroke.

## Behaviour changes worth knowing

- Clicking a landmass now **selects** it instead of starting a pan. Pan with
  middle mouse, Alt, or by clicking empty parchment.
- A feature with **no geometry at all** (e.g. a `peak` with neither `x`/`y`
  nor points) has nothing to click and shows a warning glyph in the object
  list. It needs geometry before it can appear on the map.
- Locked objects are not pickable on the canvas; unlock them from the object
  list.
- The land/water mask used by the auto-fit solver is unchanged: hiding a
  landmass is a display concern, the geography is still land.

## Follow-ups (not in this pass)

- Phase 3: multi-select and bulk operations, dragging terrain polygons and
  lore pins on the canvas, vertex editing of coastlines, a right-click
  context menu.
- Production worlds contain four features with no geometry (2 `peak`, 1
  `canyon`, 1 `oasis`); they need geometry or a removal — a data change, so
  it needs the author's approval before it touches production.
