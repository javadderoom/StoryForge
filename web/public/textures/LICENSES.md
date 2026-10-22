# Map texture sources

Every tile in `parchment/` is derived from a **CC0 1.0 Universal** (public
domain dedication) source on [ambientCG](https://ambientcg.com). CC0 requires
no attribution, but the sources are listed here so the provenance of every
byte shipped to the browser is traceable.

Each source was reduced to its luminance and re-mapped onto the duotone ramp
shown below, then written as a seamless WebP tile. No source file is
redistributed — only the processed derivative.

The **tileable** colour map inside each asset's `1K-JPG` archive is used, not
the `_SQ_Color.jpg` preview on the CDN: the preview is a square crop whose
edges do not wrap, which shows up on the map as a grid of seams.

| Material | Source (CC0) | File | Ramp | Tile | Coverage | Matrix scale |
|---|---|---|---|---|---|---|
| `ocean` | [`Ice002`](https://ambientcg.com/view?id=Ice002) | `Ice002_1K-JPG_Color.jpg` | #c6b48c → #f0e6cb | 1024² | 430 units | 0.420 |
| `land` | [`Paper003`](https://ambientcg.com/view?id=Paper003) | `Paper003_1K-JPG_Color.jpg` | #e3d8b8 → #fdfbf1 | 1024² | 520 units | 0.508 |
| `water` | [`Ice002`](https://ambientcg.com/view?id=Ice002) | `Ice002_1K-JPG_Color.jpg` | #b9a67e → #e8dcbc | 1024² | 360 units | 0.352 |
| `forest` | [`Ground106`](https://ambientcg.com/view?id=Ground106) | `Ground106_1K-JPG_Color.jpg` | #2f3a24 → #8b9a70 | 512² | 460 units | 0.898 |
| `desert` | [`Ground101`](https://ambientcg.com/view?id=Ground101) | `Ground101_1K-JPG_Color.jpg` | #a8814a → #f0dcae | 512² | 720 units | 1.406 |
| `swamp` | [`Ground025`](https://ambientcg.com/view?id=Ground025) | `Ground025_1K-JPG_Color.jpg` | #33301f → #8a8266 | 512² | 460 units | 0.898 |
| `tundra` | [`Snow014`](https://ambientcg.com/view?id=Snow014) | `Snow014_1K-JPG_Color.jpg` | #bdb8a8 → #f6f3e8 | 512² | 640 units | 1.250 |
| `plains` | [`Grass003`](https://ambientcg.com/view?id=Grass003) | `Grass003_1K-JPG_Color.jpg` | #8a8a52 → #dcd8a4 | 512² | 560 units | 1.094 |

## Regenerating

```
npx tsx scripts/buildTextures.ts
```

The script downloads each source, extracts the colour map from the archive,
caches the raw files in `web/.cache/textures/` (git-ignored) and rewrites this
file. Only `sharp` is required, and it is declared in `devDependencies`.
