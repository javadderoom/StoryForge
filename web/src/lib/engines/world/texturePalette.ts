/**
 * texturePalette.ts
 *
 * The Cartographer's material table.
 *
 * The map used to be painted with flat colours from the theme palette. The
 * fills are now textured: each region of the map is a *material* (paper, sea
 * water, forest floor, dune sand, wet mud, snow, grass) whose surface comes
 * from a real, freely licensed texture.
 *
 * The textures are NOT used raw. A photograph of turquoise lake water pasted
 * onto an antique chart destroys the map's identity — it stops reading as a
 * map. Instead every source is reduced to its luminance and re-mapped onto a
 * two-colour ramp (shadow -> highlight) chosen from the theme palette. What
 * survives is the *surface detail* — fibre, grain, ripple, fracture — while
 * the whole thing stays in the map's colours. The build script
 * (`scripts/buildTextures.ts`) does that conversion offline; this module owns
 * the material table and the ramp maths, and is pure so it can be tested.
 *
 * All sources are CC0 (ambientCG). See `public/textures/LICENSES.md`.
 */

import type { MapTerrainType } from '@/lib/types/world';

export type MapMaterialKey =
  | 'ocean'
  | 'land'
  | 'water'
  | 'forest'
  | 'desert'
  | 'swamp'
  | 'tundra'
  | 'plains';

export interface MapMaterial {
  key: MapMaterialKey;
  /** The ambientCG asset id the tile is derived from (CC0). */
  source: string;
  /** Duotone ramp: the darkest colour of the material. */
  shadow: string;
  /** Duotone ramp: the lightest colour of the material. */
  highlight: string;
  /** How many world units one repeat of the texture covers. */
  tileSize: number;
  /** Fill alpha of the material — 1 for solid ground, < 1 for washes. */
  alpha: number;
  /** The resolution the tile is written at. Fine washes need less than the big surfaces. */
  resolution: number;
  /**
   * Gaussian blur applied to the source before the ramp, in pixels.
   *
   * A light blur (0.5–1) takes the edge off JPEG grain, which the percentile
   * stretch would otherwise amplify into visible noise on flat surfaces.
   * Anything heavier softens the source's actual structure away — the sea's
   * caustic network became a featureless gradient at sigma 3 — so the sea's
   * softness is dialled with `contrast` and `tileSize` instead.
   */
  blur: number;
  /** Contrast multiplier applied to the source before the ramp. */
  contrast: number;
  /** Brightness offset applied to the source before the ramp. */
  brightness: number;
  label: { en: string; fa: string };
}

/**
 * The material table for the parchment theme.
 *
 * The tints are chosen against `VINTAGE_PARCHMENT`: the sea and the land are
 * two shades of the same aged parchment (the wet and the dry of it), and the
 * biomes are the muted earth pigments an illuminator would have used.
 */
export const MAP_MATERIALS: Record<MapMaterialKey, MapMaterial> = {
  ocean: {
    key: 'ocean',
    source: 'Ice002',
    shadow: '#c6b48c',
    highlight: '#f0e6cb',
    tileSize: 430,
    alpha: 1,
    resolution: 1024,
    blur: 1,
    contrast: 0.4,
    brightness: 0,
    label: { en: 'Open Sea', fa: 'دریای آزاد' },
  },
  land: {
    key: 'land',
    source: 'Paper003',
    shadow: '#e3d8b8',
    highlight: '#fdfbf1',
    tileSize: 520,
    alpha: 1,
    resolution: 1024,
    blur: 1,
    contrast: 0.85,
    brightness: 0,
    label: { en: 'Land', fa: 'خشکی' },
  },
  water: {
    key: 'water',
    source: 'Ice002',
    shadow: '#b9a67e',
    highlight: '#e8dcbc',
    tileSize: 360,
    alpha: 1,
    resolution: 1024,
    blur: 1,
    contrast: 0.45,
    brightness: 0,
    label: { en: 'Inland Water', fa: 'آب‌های داخلی' },
  },
  forest: {
    key: 'forest',
    source: 'Ground106',
    shadow: '#2f3a24',
    highlight: '#8b9a70',
    tileSize: 460,
    alpha: 0.42,
    resolution: 512,
    blur: 0,
    contrast: 1,
    brightness: 0,
    label: { en: 'Forest', fa: 'جنگل' },
  },
  desert: {
    key: 'desert',
    source: 'Ground101',
    shadow: '#a8814a',
    highlight: '#f0dcae',
    tileSize: 720,
    alpha: 0.42,
    resolution: 512,
    blur: 0,
    contrast: 0.9,
    brightness: 0,
    label: { en: 'Desert', fa: 'کویر' },
  },
  swamp: {
    key: 'swamp',
    source: 'Ground025',
    shadow: '#33301f',
    highlight: '#8a8266',
    tileSize: 460,
    alpha: 0.5,
    resolution: 512,
    blur: 0,
    contrast: 1,
    brightness: 0,
    label: { en: 'Swamp', fa: 'مرداب' },
  },
  tundra: {
    key: 'tundra',
    source: 'Snow014',
    shadow: '#bdb8a8',
    highlight: '#f6f3e8',
    tileSize: 640,
    alpha: 0.45,
    resolution: 512,
    blur: 0,
    contrast: 0.8,
    brightness: 0,
    label: { en: 'Tundra', fa: 'تundra' },
  },
  plains: {
    key: 'plains',
    source: 'Grass003',
    shadow: '#8a8a52',
    highlight: '#dcd8a4',
    tileSize: 560,
    alpha: 0.42,
    resolution: 512,
    blur: 0,
    contrast: 0.95,
    brightness: 0,
    label: { en: 'Plains', fa: 'دشت' },
  },
};

/** The default texture strength of a world. */
export const DEFAULT_TEXTURE_STRENGTH = 0.85;

/**
 * Which material paints which terrain type.
 *
 * Only FILLED regions have a material. Rivers, ranges, valleys and peaks are
 * drawn as ink strokes — line work is line work, and a texture on a hairline
 * reads as noise.
 */
export const TERRAIN_TYPE_MATERIAL: Partial<Record<MapTerrainType, MapMaterialKey>> = {
  continent: 'land',
  island: 'land',
  ocean: 'ocean',
  sea: 'ocean',
  lake: 'water',
  forest: 'forest',
  desert: 'desert',
  wasteland: 'desert',
  swamp: 'swamp',
  tundra: 'tundra',
  plains: 'plains',
  oasis: 'plains',
};

/** The material of a terrain type, or null when the type is ink-only. */
export function materialForTerrainType(type: MapTerrainType): MapMaterialKey | null {
  return TERRAIN_TYPE_MATERIAL[type] ?? null;
}

/**
 * Clamps the stored strength into 0..1 and falls back to the default.
 * 0 means "flat colours" — the look the Cartographer had before textures.
 */
export function resolveTextureStrength(value: number | undefined | null): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_TEXTURE_STRENGTH;
  return Math.min(1, Math.max(0, value));
}

// ---------------------------------------------------------------------------
// Duotone ramp
// ---------------------------------------------------------------------------

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Parses `#rrggbb` (or `#rgb`) into 8-bit channels. */
export function parseHexColor(hex: string): Rgb {
  const raw = hex.trim().replace('#', '');
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  const int = parseInt(full, 16);
  if (!Number.isFinite(int) || full.length !== 6) {
    throw new Error(`Invalid hex colour: ${hex}`);
  }
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

/**
 * Builds the 256-entry duotone ramp: every grey level mapped onto the line
 * between the shadow and the highlight colour.
 *
 * Returned as 768 bytes (256 RGB triples) so the build script can apply it
 * to a raw greyscale buffer without allocating per pixel.
 */
export function duotoneRamp(shadow: string, highlight: string): Uint8Array {
  const s = parseHexColor(shadow);
  const h = parseHexColor(highlight);
  const ramp = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    ramp[i * 3] = Math.round(s.r + (h.r - s.r) * t);
    ramp[i * 3 + 1] = Math.round(s.g + (h.g - s.g) * t);
    ramp[i * 3 + 2] = Math.round(s.b + (h.b - s.b) * t);
  }
  return ramp;
}

/** Looks a grey level up in a ramp produced by {@link duotoneRamp}. */
export function rampLookup(ramp: Uint8Array, grey: number): Rgb {
  const g = Math.min(255, Math.max(0, Math.round(grey)));
  return { r: ramp[g * 3], g: ramp[g * 3 + 1], b: ramp[g * 3 + 2] };
}

// ---------------------------------------------------------------------------
// Luminance normalisation
// ---------------------------------------------------------------------------

export interface LuminanceRange {
  lo: number;
  hi: number;
}

/**
 * The robust luminance range of a source: the 0.5th and 99.5th percentiles.
 *
 * A duotone must stretch the source's *actual* range across the whole ramp,
 * otherwise a bright source (paper, snow) clips to white and the tile comes
 * out flat. Percentiles rather than min/max, so a few specular pixels cannot
 * swallow the range.
 */
export function percentileLuminanceRange(
  histogram: Uint32Array,
  total: number,
  lowPercent = 0.005,
  highPercent = 0.995
): LuminanceRange {
  if (total <= 0) return { lo: 0, hi: 255 };

  const lowTarget = total * lowPercent;
  const highTarget = total * (1 - highPercent);

  let lo = 0;
  let acc = 0;
  for (let i = 0; i < 256; i++) {
    acc += histogram[i];
    if (acc >= lowTarget) {
      lo = i;
      break;
    }
  }

  let hi = 255;
  acc = 0;
  for (let i = 255; i >= 0; i--) {
    acc += histogram[i];
    if (acc >= highTarget) {
      hi = i;
      break;
    }
  }

  if (hi <= lo) {
    // The bulk of the image sits in a single level (a flat source, or a
    // source with a few specular outliers). Fall back to a one-level window
    // around it, so that level lands in the MIDDLE of the ramp instead of
    // collapsing to one end of it.
    const mid = Math.min(255, Math.max(0, lo));
    return { lo: Math.max(0, mid - 1), hi: Math.min(255, mid + 1) };
  }
  return { lo, hi };
}

/**
 * Maps a normalised luminance (0..1) through the material's contrast and
 * brightness. Contrast pivots around the midpoint so it deepens or flattens
 * the material without shifting its overall level.
 */
export function applyMaterialGrade(t: number, contrast: number, brightness: number): number {
  const graded = (t - 0.5) * contrast + 0.5 + brightness / 100;
  return Math.min(1, Math.max(0, graded));
}

/** Normalises a grey level into 0..1 against a luminance range. */
export function normalizeLuminance(grey: number, range: LuminanceRange): number {
  const span = range.hi - range.lo;
  if (span <= 0) return 0.5;
  return Math.min(1, Math.max(0, (grey - range.lo) / span));
}

/**
 * The Pixi fill matrix for a material: how many world units one repeat of
 * the texture covers.
 *
 * With `textureSpace: 'global'` the texture is laid down across the whole
 * world and the shapes cut holes in it, so every region of the map shares one
 * continuous sheet of material — exactly like a real map.
 */
export function textureScaleFor(material: MapMaterial): number {
  return material.resolution / material.tileSize;
}
