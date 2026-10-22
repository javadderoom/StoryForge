# Plan 23 — Cartographer Multi-Selection, Group Move, Marquee and the Map Clipboard

Status: implemented
Depends on: Plan 21 (map-object layers), Plan 22 (material textures)

## Problem

The Cartographer could select exactly one object. There was no rubber band,
no additive selection, no way to act on several shapes at once, and copying a
landmass meant redrawing it vertex by vertex. The biggest authoring cost on a
large map is not drawing one new island — it is rearranging or duplicating the
twenty objects that already exist.

This plan brings the selection model up to the design-tool baseline authors
already know: marquee drag, Shift/Ctrl-click, Ctrl+A, Ctrl+C/V, Ctrl+D,
Delete for the whole set, and moving the whole set by dragging it or nudging
it with the arrow keys.

## Model

Selection is a list of **references**, not objects:

```ts
type MapObjectRef = { kind: 'terrain' | 'placement' | 'location' | 'trade_route'; id: string };
```

The page resolves refs against the live world bible on every render. Why this
matters:

- the Inspector can keep editing an object without the selection holding a
  stale copy of it;
- undo/redo, world switches and deletes cannot leave a ghost selected — a ref
  whose object vanished simply stops resolving and is pruned;
- the canvas and the engine compare the same key, so a re-render always paints
  exactly what the page believes is selected.

`web/src/lib/engines/world/mapSelection.ts` is pure (no React, no Pixi): ref
bookkeeping, marquee geometry, selectability, clipboard snapshot/clone.

## Interaction contract

| Gesture | Result |
| --- | --- |
| Left-drag on empty parchment (Select tool) | Rubber band. Selects every object the band **touches**. |
| Left-click on empty parchment | Clears the selection. |
| Shift/Ctrl/Cmd + click | Toggles that object in the selection (no drag). |
| Shift/Ctrl/Cmd + drag | Additive rubber band (unions with the current set). |
| Drag any selected object | Moves the ENTIRE selection as one group. |
| Drag an unselected object | Selects it, then moves it (or the set it joins). |
| Arrow keys | Nudges the selection 1 world unit; Shift + arrow nudges 10. |
| Ctrl/Cmd + A | Selects everything visible and unlocked; arms the Select tool. |
| Ctrl/Cmd + C | Snapshots the selection into the in-app clipboard. |
| Ctrl/Cmd + V | Pastes clones offset by 24 world units per consecutive paste. |
| Ctrl/Cmd + D | Duplicates the selection immediately (offset 24). |
| Delete | Bulk delete after ONE confirmation, as ONE undo step. |
| Escape | Clears the selection. |
| Alt + left-drag | Draws a zoom box; on release the view fits that area. |
| Middle/right drag | Pan (unchanged; left-drag is no longer a pan). |

Panning deliberately moved off the primary button: a design-tool marquee and a
left-drag pan cannot share the same gesture. Alt + left-drag is the zoom box
instead. The HUD hint now reads
`Drag: select · Right-drag: pan · Alt-drag: zoom`.

## Marquee geometry

Intersection, not bounding-box containment:

- polygon vs rect: a vertex inside, a rect corner inside the ring, or an edge
  crossing a rect edge;
- a band fully inside a lake **hole** does not select the surrounding
  landmass (the hole wins over the outer ring);
- polyline vs rect: segment/rect crossing (rivers, ranges, valleys, routes);
- point features and pins: circle/rect intersection;
- settlements and routes are only selectable when the renderer actually draws
  them (endpoints exist, coordinates assigned, layer switch on).

`isTerrainVisibleInLayers` / `isPlacementVisibleInLayers` moved into
`mapObjectOrder.ts`; the renderer and the selection now read the same mapping,
so Ctrl+A can never select something that is not on screen.

## Clipboard rules

Copy snapshots a detached payload (`structuredClone`), so editing or deleting
the source after Ctrl+C does not change what Ctrl+V produces.

Paste clones with:

- fresh ids for every object;
- all geometry translated: polygons, holes, polylines, x/y, location
  coordinates, route waypoints;
- names suffixed `(copy)` / `(رونوشت)`;
- references **inside** the batch remapped (copying two towns and the road
  between them produces a road between the two *copied* towns);
- a copied location's adjacency/parent edges dropped when they point outside
  the batch (a new place should not silently inherit the original's
  neighbours);
- pins keep `entityId` (the pin is a map annotation, not the lore entity);
- `coordinatesSource: 'manual'` for a duplicated settlement.

The paste is one `commit()`, so a single Ctrl+Z removes the whole batch.

## Zoom box

Alt + left-drag is a navigation gesture available in every tool: it takes
precedence over drawing, sculpting, selection and group move, so holding Alt
can never drop a vertex. The box is screen-space and dashed (the marquee stays
solid amber), and Escape cancels it.

On release `calculateZoomToRect` converts the box to world space with the
transform currently on screen, fits its world width/height into the viewport
using the tighter axis (so nothing inside the box is cropped), centres it, and
clamps to the normal zoom range. A box under 8 px on either axis is discarded:
an Alt-click must never move the view or clear the selection.

## Group move

Pressing a member of a multi-selection no longer collapses the selection: the
whole set follows the pointer, which is the behaviour every design tool has
taught authors to expect. A press that moves less than 3 screen pixels is still
a click, not a drag.

The world is never mutated while the pointer moves. The canvas keeps a
`SelectionDragState` (refs, origin, live delta) and the engine receives a
`selectionDelta` render option. `renderAll` builds translated *view* arrays for
the selected terrain, pins, settlements and routes, then hands those arrays to
the existing draw routines; no draw function needed to learn about drags.

Translation semantics:

- terrain: polygon, holes, polyline points and the x/y anchor all shift;
- pins: x/y shift;
- settlements: `coordinates` shift and are stamped
  `coordinatesSource: 'manual'` (a hand-placed pin is a hard anchor for the
  auto-fit solver);
- routes: only waypoints shift. Their ends are location ids, so a road follows
  a moved town automatically, and a route dragged on its own bends through its
  waypoints while staying anchored to its towns. A route with no waypoints has
  no free geometry, so pressing it selects it without starting a dead drag.

Mouseup commits ONE translation for the whole set: one world update, one
`Move selection` history entry, one Ctrl+Z to undo. Arrow-key nudges go through
the same path and coalesce within `CARTOGRAPHER_COALESCE_MS`, so holding a key
does not fill the history with one entry per unit; the burst undoes as one
move.

## Bulk delete

One `notify.confirm` (`Delete N objects (3 terrain features, 2 pins)?`) and one
undo step. Deleting a location also removes routes that end there — a route
with a dangling endpoint is not drawn and can never be picked again, so leaving
it behind would create invisible, unselectable debris. Child locations lose
their `parentLocationId` instead of pointing at a missing parent.

## Visual language

Selected objects get a two-pass outline drawn in the interaction layer:

- a wide cream halo (`selectionHalo: #fff7e2`) that stays readable on both the
  pale paper and the indigo sea wash;
- a thin amber line (`selectionInk: #b45309`) on top.

This replaces the old per-kind treatment (settlements had a gold aura and a
white border; terrain and pins had nothing). One ring now means "selected" for
every kind. Route waypoint handles still appear only when the route is
selected, because they are editing affordances, not selection decoration.

## Deliberately deferred

- Cut (Ctrl+X). Copy + Delete is equivalent and avoids an unconfirmed
  destructive shortcut.

## Verification

- `mapSelection.test.ts` — 27 tests: ref union/toggle, selectability filters,
  polygon/polyline/circle marquee intersection (including the lake-hole case),
  clipboard offsets, id remapping inside a batch, dropping external edges,
  clipboard immutability, and translation of terrain geometry / pins /
  settlements / route waypoints while unselected objects keep their identity.
- `pixiMath.test.ts` — zoom-box fit, centring, reversed drags, zoom clamping
  and degenerate-input rejection.
- Full suite — 1402/1402 passing.
- `npx tsc --noEmit` — clean.
- `npx next build --webpack` — clean.
