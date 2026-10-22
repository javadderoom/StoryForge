# Plan 22 — Cartographer Material Textures

**Status:** implemented.
**Progress tracker:** hindsight bank `StoryForge`, document `storyforge-plan-22-material-textures`.

## The problem

The map was painted with flat colours: one cream for every landmass, one tan
for every sea, one alpha-blended wash per biome. It read as a diagram of a
parchment map rather than as a map. The brief: replace the flat colours with
real, web-sourced textures.

The naive reading of that brief — paste photographs of water, grass and sand
onto the canvas — destroys the thing that makes the Cartographer work. A
photograph of turquoise lake water on an antique chart stops being a chart. The
texture has to carry **surface** (fibre, grain, ripple, dune, snow crust) while
staying inside the map's palette.

## Decision (author-confirmed)

- **Duotone, not photographic.** Every source is reduced to luminance and
  re-mapped onto a two-colour ramp. Structure survives; colour identity is the
  map's.
- **A strength slider** (0–100%). 0 is exactly the old flat look, 100 is fully
  textured. Default 85%.
- **Parchment theme only.** The ramps are mixed against `VINTAGE_PARCHMENT`;
  the other four themes keep their flat colours until they get their own
  material set.
- Sources must be **CC0** and come from the web, and they are **committed as
  processed derivatives** so the app never fetches a texture at runtime.

## The material set

| Material | Source (CC0) | Tile | Covers | Resolution |
|---|---|---|---|---|
| `ocean` | `Ice002` (ice caustics) | 430 units | open sea background | 1024² |
| `water` | `Ice002` | 360 units | lakes, seas, landmass holes | 1024² |
| `land` | `Paper003` (crumpled paper) | 520 units | continents, islands | 1024² |
| `forest` | `Ground106` (forest floor) | 460 units | forest biome | 512² |
| `desert` | `Ground101` (dune sand) | 720 units | desert, wasteland | 512² |
| `swamp` | `Ground025` (wet mud) | 460 units | swamp biome | 512² |
| `tundra` | `Snow014` (snow) | 640 units | tundra biome | 512² |
| `plains` | `Grass003` (grass) | 560 units | plains, oasis | 512² |

Total payload: **184 KB** of WebP for the whole set. Provenance and ramps are
regenerated into `web/public/textures/LICENSES.md` by the build script.

## The pipeline — `web/scripts/buildTextures.ts`

`npx tsx scripts/buildTextures.ts`:

1. **Download the tileable colour map.** `GET
   https://ambientcg.com/get?file=<AssetId>_1K-JPG.zip`, then extract
   `<AssetId>_1K-JPG_Color.jpg` with a small built-in ZIP reader (Node's
   `zlib.inflateRaw` — no extra dependency; `sharp` is the only one, and it is
   now declared in `devDependencies`).
2. **Greyscale + resize** to the material's resolution.
3. **Optional wrapped blur** (0–1 px, see the trap below).
4. **Percentile stretch** — the 0.5th/99.5th luminance percentiles are mapped
   to 0..1. This is what separates a texture from a wash: a bright source
   (paper, snow) has a narrow range, and without the stretch the ramp collapses
   to a single shade. A flat source falls back to a one-level window so it lands
   in the *middle* of the ramp instead of one end.
5. **Grade** (`contrast`, `brightness` around the ramp midpoint).
6. **Duotone ramp** — 256 entries between `shadow` and `highlight`.
7. **WebP** at quality 80 (1024²) / 74 (512²).

Raw downloads cache in `web/.cache/textures/` (git-ignored). The committed
derivatives are the only textures the app ships.

## Runtime — `web/src/lib/engines/world/`

- **`texturePalette.ts`** (pure, tested) — the material table, `duotoneRamp`,
  `percentileLuminanceRange`, `normalizeLuminance`, `applyMaterialGrade`,
  `resolveTextureStrength`, `textureScaleFor`, `TERRAIN_TYPE_MATERIAL`.
- **`pixi/mapTextureLibrary.ts`** — loads the eight tiles through Pixi's
  `Assets` with the alias `cartographer-parchment-<key>`. Best-effort: a
  missing tile is logged and that material falls back to its flat colour. The
  map always draws.
- **`pixi/PixiCartographerEngine.ts`** — `fillWithMaterial()` paints the flat
  theme colour at `alpha × (1 − strength)`, then the material fill at
  `material.alpha × strength`. A textured `Graphics` fill uses the tile with
  `textureSpace: 'global'` and a per-material `Matrix` scaled by
  `resolution / tileSize`, so one repeat covers exactly `tileSize` world units
  and the texture is pinned to the map (it pans and zooms with the drawing, and
  adjacent regions share one continuous field).
  All filled terrain routes through it: the sea background, landmasses, the
  water holes carved in a landmass, standing water, and the biome washes. Ink —
  coastlines, ranges, rivers, the sea wavelets — is untouched and always draws
  on top.
- **`WorldMapSettings.textureStrength`** (optional, `0..1`, zod-validated) is
  persisted with the map's JSON; no database migration.
- **`CartographerLayerPanel`** — a *Texture Strength* slider, shown for the
  parchment theme only.

## Traps found (all verified the hard way)

| # | Trap | Fix |
|---|---|---|
| 1 | The `_SQ_Color.jpg` on the media CDN is a square **crop**, not the seamless tile. Tiled, it leaves a visible grid of seams. | Use the colour map inside the `1K-JPG` archive, whose edges wrap. |
| 2 | **`sharp.blur()` promotes a 1-channel raw buffer to 3 channels.** Indexing the result as greyscale silently scrambles the tile (it looked like "the blur destroyed the structure"). | `.toColourspace('b-w')` after the blur, plus an explicit length assertion. |
| 3 | A plain blur samples across the tile edge and pulls the border inwards → seams. | Blur a wrapped 3×3 copy and crop the centre back out (`blurWrapped`). |
| 4 | Sigma 3 flattened the sea's caustic network into a featureless gradient — the *structure* is high-frequency. | Blur is only ever 0–1 px (it exists to take the edge off JPEG grain). Softness is dialled with `contrast` and `tileSize`. |
| 5 | At 700 units per repeat the caustics read as **cracked earth**. | Small repeats (430/360) turn the cells into ripples; contrast 0.40/0.45 keeps them a whisper. |
| 6 | A ramp whose midpoint is not the region's old flat colour changes the biome's colour identity (the first forest pass was a dark olive slab). | Every ramp is chosen so its midpoint ≈ the flat colour it replaces. |
| 7 | Pixi's `Assets.load` takes `src`, not `url`; the wrong key fails silently per-tile. | `Assets.load({ alias, src })`, and failures are logged. |

## Verification

- `texturePalette.test.ts` — 22 tests: hex parsing, ramp endpoints/monotonicity,
  percentile range (including the flat-source fallback), normalisation,
  grading, strength clamping, the material table's shape, the terrain→material
  map, and `textureScaleFor`.
- **Art direction** was checked outside the browser: a throwaway `sharp`
  harness composited the real tiles at the real world scale into a mock map
  (sea + landmass + forest + ink) and the result was inspected at each tuning
  step. That is what caught the cracked-earth sea and the olive forest. The
  harness was deleted afterwards; it is not part of the repo.
- Seam checks: every tile's wrap difference is now within ~1–2 grey levels of
  its interior variation (it was 40–55× before the fixes).
- `npx tsc --noEmit` clean, `node --import tsx scripts/testAll.ts` **1365/1365**,
  `npx next build --webpack` green.

## Follow-ups (not done)

- Material sets for `topographic`, `dark_fantasy`, `satellite`, `mystic_astral`
  — the strength setting is per-world and already persisted, so those themes
  can adopt it without a data change.
- A per-material strength override (a strong sea with a whisper-quiet land) if
  the single slider proves too coarse in use.
- Body-texture variety by latitude/biome noise (e.g. two desert tiles) once
  someone is looking at a large map and finds the 720-unit repeat visible.
