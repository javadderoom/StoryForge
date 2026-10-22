/**
 * buildTextures.ts — offline asset pipeline for the Cartographer's materials.
 *
 * Downloads the CC0 source textures from ambientCG, reduces each one to its
 * luminance, re-maps it onto the parchment theme's duotone ramp, and writes a
 * seamless WebP tile into `public/textures/parchment/`.
 *
 * Run it with:  npx tsx scripts/buildTextures.ts
 *
 * The processed tiles are committed to the repository (they are small), so
 * the app never depends on the network at runtime. The raw downloads are
 * cached under `.cache/textures/` and are NOT committed.
 *
 * Sources and their CC0 licence are recorded in
 * `public/textures/LICENSES.md`, which this script regenerates.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import sharp from 'sharp';
import {
  MAP_MATERIALS,
  applyMaterialGrade,
  duotoneRamp,
  normalizeLuminance,
  percentileLuminanceRange,
  textureScaleFor,
  type MapMaterial,
} from '../src/lib/engines/world/texturePalette';

const ROOT = path.resolve(__dirname, '..');
const CACHE_DIR = path.join(ROOT, '.cache', 'textures');
const OUT_DIR = path.join(ROOT, 'public', 'textures', 'parchment');
const THEME = 'parchment';

/**
 * Extracts the members of a ZIP archive.
 *
 * Written against Node's built-in zlib rather than a dependency: the archive
 * layout is read from the central directory, and each member is inflated
 * (method 8) or copied (method 0).
 */
function unzip(zipPath: string, targetDir: string): void {
  const buf = fs.readFileSync(zipPath);

  // End of central directory record.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 22 - 0xffff; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error(`${zipPath}: not a zip archive`);

  const entryCount = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);

  for (let i = 0; i < entryCount; i++) {
    if (buf.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buf.readUInt16LE(offset + 10);
    const compressedSize = buf.readUInt32LE(offset + 20);
    const nameLength = buf.readUInt16LE(offset + 28);
    const extraLength = buf.readUInt16LE(offset + 30);
    const commentLength = buf.readUInt16LE(offset + 32);
    const localOffset = buf.readUInt32LE(offset + 42);
    const name = buf.toString('utf8', offset + 46, offset + 46 + nameLength);
    offset += 46 + nameLength + extraLength + commentLength;

    if (name.endsWith('/')) continue;

    // The local header repeats the name/extra lengths.
    const localNameLength = buf.readUInt16LE(localOffset + 26);
    const localExtraLength = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const raw = buf.subarray(dataStart, dataStart + compressedSize);

    let content: Buffer;
    if (method === 0) content = Buffer.from(raw);
    else if (method === 8) content = zlib.inflateRawSync(raw);
    else throw new Error(`${name}: unsupported compression method ${method}`);

    const outPath = path.join(targetDir, path.basename(name));
    fs.writeFileSync(outPath, content);
  }
}

/**
 * Downloads the asset's tileable colour map.
 *
 * The colour map inside the 1K-JPG archive is the SEAMLESS tile. The
 * `_SQ_Color.jpg` preview that the media CDN serves is a square crop of the
 * same surface, and its edges do not wrap - which shows up on the map as a
 * grid of seams.
 */
async function download(assetId: string): Promise<string> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, `${assetId}_tile.jpg`);
  if (fs.existsSync(file) && fs.statSync(file).size > 10_000) {
    console.log(`  cached  ${assetId}`);
    return file;
  }

  console.log(`  fetch   ${assetId} …`);
  const zipUrl = `https://ambientcg.com/get?file=${assetId}_1K-JPG.zip`;
  const res = await fetch(zipUrl);
  if (!res.ok) {
    throw new Error(`${assetId}: HTTP ${res.status} from ambientCG`);
  }
  const zip = Buffer.from(await res.arrayBuffer());
  const zipPath = path.join(CACHE_DIR, `${assetId}.zip`);
  fs.writeFileSync(zipPath, zip);

  const extractDir = path.join(CACHE_DIR, `${assetId}_extracted`);
  fs.mkdirSync(extractDir, { recursive: true });
  await unzip(zipPath, extractDir);

  const colour = fs
    .readdirSync(extractDir)
    .find((name) => /_Color\.jpg$/i.test(name));
  if (!colour) {
    throw new Error(`${assetId}: no colour map in the archive`);
  }
  fs.copyFileSync(path.join(extractDir, colour), file);
  return file;
}

/**
 * Blurs a square greyscale tile WITHOUT breaking its seams.
 *
 * A plain blur samples across the edge and pulls the border inwards, which
 * leaves a visible grid of seams on the map. Blurring a WRAPPED 3×3 copy and
 * cropping the centre back out makes the blur wrap with the tile.
 */
async function blurWrapped(grey: Buffer, size: number, sigma: number): Promise<Buffer> {
  const side = size * 3;
  const big = Buffer.alloc(side * side);
  for (let y = 0; y < side; y++) {
    const sy = y % size;
    for (let x = 0; x < side; x++) {
      big[y * side + x] = grey[sy * size + (x % size)];
    }
  }

  // `toColourspace('b-w')` is load-bearing: sharp promotes a one-channel raw
  // input to three channels through the blur, and indexing that buffer as
  // greyscale silently scrambles the tile.
  const blurred = await sharp(big, { raw: { width: side, height: side, channels: 1 } })
    .blur(sigma)
    .toColourspace('b-w')
    .raw()
    .toBuffer();

  if (blurred.length !== side * side) {
    throw new Error(
      `blurWrapped: expected ${side * side} greyscale bytes, got ${blurred.length}`
    );
  }

  const out = Buffer.alloc(size * size);
  for (let y = 0; y < size; y++) {
    const start = (y + size) * side + size;
    blurred.copy(out, y * size, start, start + size);
  }
  return out;
}

/**
 * Reduces the source to luminance, stretches its actual range across the
 * material's duotone ramp, and returns the result as a raw RGB buffer.
 *
 * The stretch is what makes the difference between a texture and a flat
 * colour: a bright source (paper, snow) has a narrow luminance range, and
 * without normalising it the ramp collapses to one shade.
 */
async function processMaterial(
  sourceFile: string,
  material: MapMaterial
): Promise<{ data: Buffer; width: number; height: number }> {
  const ramp = duotoneRamp(material.shadow, material.highlight);

  let pipeline = sharp(sourceFile).greyscale();

  const { data: grey, info } = await pipeline
    .resize(material.resolution, material.resolution, { fit: 'cover' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  let lum: Buffer = grey;
  if (material.blur > 0) {
    lum = await blurWrapped(grey, material.resolution, material.blur);
  }

  const histogram = new Uint32Array(256);
  for (let i = 0; i < lum.length; i++) {
    histogram[lum[i]]++;
  }
  const range = percentileLuminanceRange(histogram, lum.length);

  const rgb = Buffer.allocUnsafe(lum.length * 3);
  for (let i = 0; i < lum.length; i++) {
    const t = applyMaterialGrade(
      normalizeLuminance(lum[i], range),
      material.contrast,
      material.brightness
    );
    const idx = Math.round(t * 255);
    rgb[i * 3] = ramp[idx * 3];
    rgb[i * 3 + 1] = ramp[idx * 3 + 1];
    rgb[i * 3 + 2] = ramp[idx * 3 + 2];
  }

  return { data: rgb, width: info.width, height: info.height };
}

function licenceDocument(materials: MapMaterial[]): string {
  const rows = materials
    .map((m) => {
      const scale = textureScaleFor(m);
      return [
        `| \`${m.key}\` | [\`${m.source}\`](https://ambientcg.com/view?id=${m.source}) | \`${m.source}_1K-JPG_Color.jpg\` | ${m.shadow} → ${m.highlight} | ${m.resolution}² | ${m.tileSize} units | ${scale.toFixed(3)} |`,
      ].join('');
    })
    .join('\n');

  return `# Map texture sources

Every tile in \`parchment/\` is derived from a **CC0 1.0 Universal** (public
domain dedication) source on [ambientCG](https://ambientcg.com). CC0 requires
no attribution, but the sources are listed here so the provenance of every
byte shipped to the browser is traceable.

Each source was reduced to its luminance and re-mapped onto the duotone ramp
shown below, then written as a seamless WebP tile. No source file is
redistributed — only the processed derivative.

The **tileable** colour map inside each asset's \`1K-JPG\` archive is used, not
the \`_SQ_Color.jpg\` preview on the CDN: the preview is a square crop whose
edges do not wrap, which shows up on the map as a grid of seams.

| Material | Source (CC0) | File | Ramp | Tile | Coverage | Matrix scale |
|---|---|---|---|---|---|---|
${rows}

## Regenerating

\`\`\`
npx tsx scripts/buildTextures.ts
\`\`\`

The script downloads each source, extracts the colour map from the archive,
caches the raw files in \`web/.cache/textures/\` (git-ignored) and rewrites this
file. Only \`sharp\` is required, and it is declared in \`devDependencies\`.
`;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const materials = Object.values(MAP_MATERIALS);
  const usedSources = new Set<string>();

  for (const material of materials) {
    usedSources.add(material.source);
  }

  // One download per distinct source (ocean and inland water share a source).
  const sourceFiles = new Map<string, string>();
  for (const assetId of usedSources) {
    sourceFiles.set(assetId, await download(assetId));
  }

  console.log('\nprocessing:');
  let totalBytes = 0;
  for (const material of materials) {
    const sourceFile = sourceFiles.get(material.source)!;
    const { data, width, height } = await processMaterial(sourceFile, material);
    const outFile = path.join(OUT_DIR, `${material.key}.webp`);
    await sharp(data, { raw: { width, height, channels: 3 } })
      .webp({ quality: material.resolution >= 1024 ? 80 : 74, effort: 6 })
      .toFile(outFile);
    const bytes = fs.statSync(outFile).size;
    totalBytes += bytes;
    console.log(
      `  ${material.key.padEnd(8)} ${String(width).padStart(4)}×${height}  ${(bytes / 1024).toFixed(1)} KB`
    );
  }

  fs.writeFileSync(
    path.join(ROOT, 'public', 'textures', 'LICENSES.md'),
    licenceDocument(materials),
    'utf8'
  );

  console.log(
    `\n${materials.length} tiles written to public/textures/${THEME}/ (${(totalBytes / 1024).toFixed(1)} KB total)`
  );
}

main().catch((err) => {
  console.error('\nbuildTextures failed:', err);
  process.exit(1);
});
