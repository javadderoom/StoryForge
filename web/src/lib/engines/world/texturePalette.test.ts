import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_TEXTURE_STRENGTH,
  MAP_MATERIALS,
  TERRAIN_TYPE_MATERIAL,
  applyMaterialGrade,
  duotoneRamp,
  materialForTerrainType,
  normalizeLuminance,
  parseHexColor,
  percentileLuminanceRange,
  rampLookup,
  resolveTextureStrength,
  textureScaleFor,
  type MapMaterialKey,
} from './texturePalette';

describe('texturePalette — colour parsing', () => {
  it('parses six-digit hex', () => {
    assert.deepEqual(parseHexColor('#ff8000'), { r: 255, g: 128, b: 0 });
  });

  it('parses three-digit hex', () => {
    assert.deepEqual(parseHexColor('#f80'), { r: 255, g: 136, b: 0 });
  });

  it('rejects nonsense', () => {
    assert.throws(() => parseHexColor('nope'));
    assert.throws(() => parseHexColor('#12345'));
  });
});

describe('texturePalette — duotone ramp', () => {
  it('maps the darkest level to the shadow colour', () => {
    const ramp = duotoneRamp('#000000', '#ffffff');
    assert.deepEqual(rampLookup(ramp, 0), { r: 0, g: 0, b: 0 });
    assert.deepEqual(rampLookup(ramp, 255), { r: 255, g: 255, b: 255 });
  });

  it('maps the midpoint to the middle of the ramp', () => {
    const ramp = duotoneRamp('#000000', '#ffffff');
    const mid = rampLookup(ramp, 128);
    assert.ok(mid.r >= 126 && mid.r <= 130, `expected ~128, got ${mid.r}`);
  });

  it('is monotonic', () => {
    const ramp = duotoneRamp('#102030', '#f0d0b0');
    let previous = -1;
    for (let i = 0; i < 256; i++) {
      const c = rampLookup(ramp, i);
      assert.ok(c.r >= previous, `red must not fall at level ${i}`);
      previous = c.r;
    }
  });

  it('clamps out-of-range levels', () => {
    const ramp = duotoneRamp('#000000', '#ffffff');
    assert.deepEqual(rampLookup(ramp, -20), { r: 0, g: 0, b: 0 });
    assert.deepEqual(rampLookup(ramp, 999), { r: 255, g: 255, b: 255 });
  });
});

describe('texturePalette — luminance normalisation', () => {
  it('finds the robust range of a histogram', () => {
    // 1000 mid pixels, 2 bright outliers (0.2% — under the 0.5% cut).
    const histogram = new Uint32Array(256);
    histogram[40] = 1000;
    histogram[250] = 2;
    const range = percentileLuminanceRange(histogram, 1002);
    // The 99.5th percentile must ignore the 2 bright outliers.
    assert.ok(range.hi < 250, `expected the outliers to be excluded, got ${range.hi}`);
    assert.ok(range.lo <= 40);
  });

  it('keeps outliers that are a real part of the image', () => {
    // 1000 mid pixels, 60 bright ones (5.7%) — those are signal, not noise.
    const histogram = new Uint32Array(256);
    histogram[40] = 1000;
    histogram[250] = 60;
    const range = percentileLuminanceRange(histogram, 1060);
    assert.equal(range.hi, 250);
  });

  it('falls back to a window around the level for a flat image', () => {
    const histogram = new Uint32Array(256);
    histogram[128] = 500;
    const range = percentileLuminanceRange(histogram, 500);
    // A flat source must land in the middle of the ramp, not at one end.
    assert.equal(normalizeLuminance(128, range), 0.5);
  });

  it('normalises a level into 0..1', () => {
    assert.equal(normalizeLuminance(50, { lo: 50, hi: 150 }), 0);
    assert.equal(normalizeLuminance(150, { lo: 50, hi: 150 }), 1);
    assert.equal(normalizeLuminance(100, { lo: 50, hi: 150 }), 0.5);
  });

  it('normalises safely against a zero span', () => {
    assert.equal(normalizeLuminance(100, { lo: 100, hi: 100 }), 0.5);
  });
});

describe('texturePalette — material grading', () => {
  it('pivots contrast around the midpoint', () => {
    assert.equal(applyMaterialGrade(0.5, 1, 0), 0.5);
    assert.ok(applyMaterialGrade(0.25, 2, 0) < 0.25);
    assert.ok(applyMaterialGrade(0.75, 2, 0) > 0.75);
  });

  it('clamps the result', () => {
    assert.equal(applyMaterialGrade(1, 4, 0), 1);
    assert.equal(applyMaterialGrade(0, 4, 0), 0);
  });

  it('shifts the level with brightness', () => {
    assert.ok(applyMaterialGrade(0.5, 1, 20) > 0.5);
    assert.ok(applyMaterialGrade(0.5, 1, -20) < 0.5);
  });
});

describe('texturePalette — texture strength', () => {
  it('falls back to the default', () => {
    assert.equal(resolveTextureStrength(undefined), DEFAULT_TEXTURE_STRENGTH);
    assert.equal(resolveTextureStrength(null), DEFAULT_TEXTURE_STRENGTH);
    assert.equal(resolveTextureStrength(Number.NaN), DEFAULT_TEXTURE_STRENGTH);
  });

  it('clamps into 0..1', () => {
    assert.equal(resolveTextureStrength(-3), 0);
    assert.equal(resolveTextureStrength(4), 1);
    assert.equal(resolveTextureStrength(0.5), 0.5);
  });
});

describe('texturePalette — the material table', () => {
  it('defines every material with a usable ramp', () => {
    for (const [key, material] of Object.entries(MAP_MATERIALS)) {
      assert.equal(material.key, key);
      assert.ok(material.tileSize > 0, `${key} needs a tile size`);
      assert.ok(material.alpha > 0 && material.alpha <= 1, `${key} needs a sane alpha`);
      assert.ok(material.resolution >= 256, `${key} needs a usable resolution`);
      // The ramp must be buildable — a malformed colour would throw here.
      assert.equal(duotoneRamp(material.shadow, material.highlight).length, 768);
    }
  });

  it('makes one texture repeat cover exactly tileSize world units', () => {
    for (const material of Object.values(MAP_MATERIALS)) {
      const scale = textureScaleFor(material);
      // Pixi inverts the fill matrix before use (see
      // pixi.js/lib/scene/graphics/shared/utils/generateTextureFillMatrix.js),
      // so the shader samples uv = worldPos / (scale * resolution): a repeat is
      // `scale * resolution` world units wide. That must be the tile size the
      // material was authored for — getting it backwards stretches every tile
      // by (resolution / tileSize)² and the map reads as flat paint.
      const worldUnitsPerRepeat = scale * material.resolution;
      assert.ok(
        Math.abs(worldUnitsPerRepeat - material.tileSize) < 1e-6,
        `${material.key}: one repeat covers ${worldUnitsPerRepeat} units, expected ${material.tileSize}`
      );
      assert.ok(scale > 0, `${material.key}: the matrix scale must be positive`);
    }
  });

  it('maps every filled terrain type to a material', () => {
    assert.equal(materialForTerrainType('continent'), 'land');
    assert.equal(materialForTerrainType('island'), 'land');
    assert.equal(materialForTerrainType('ocean'), 'ocean');
    assert.equal(materialForTerrainType('lake'), 'water');
    assert.equal(materialForTerrainType('forest'), 'forest');
    assert.equal(materialForTerrainType('desert'), 'desert');
    assert.equal(materialForTerrainType('swamp'), 'swamp');
    assert.equal(materialForTerrainType('tundra'), 'tundra');
  });

  it('leaves ink-only terrain without a material', () => {
    assert.equal(materialForTerrainType('river'), null);
    assert.equal(materialForTerrainType('mountain_range'), null);
    assert.equal(materialForTerrainType('valley'), null);
    assert.equal(materialForTerrainType('peak'), null);
  });

  it('only references materials that exist', () => {
    for (const [type, key] of Object.entries(TERRAIN_TYPE_MATERIAL)) {
      assert.ok(key in MAP_MATERIALS, `${type} points at the unknown material ${key}`);
      assert.ok(Object.values(MAP_MATERIALS).some((m) => m.key === (key as MapMaterialKey)));
    }
  });
});
