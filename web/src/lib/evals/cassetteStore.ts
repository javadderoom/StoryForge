import fs from 'node:fs';
import path from 'node:path';
import { RawSceneData } from '@/lib/engines/narrative/modelCall';

/**
 * Plan 14 — on-disk cassette store for the model seam.
 *
 * Layout: `src/lib/evals/cassettes/<modelId>/<scenarioId>.json`
 *
 * Cassettes let the golden scenarios run deterministically with no API key and
 * no credit spend. They are (re)generated with `npm run eval:record`.
 *
 * Note: filesystem-backed — intended for local dev, CI, and the Studio bench in
 * a dev/authoring environment.
 */

const CASSETTE_ROOT = path.join(process.cwd(), 'src', 'lib', 'evals', 'cassettes');

export function cassettePath(modelId: string, scenarioId: string): string {
  return path.join(CASSETTE_ROOT, sanitize(modelId), `${sanitize(scenarioId)}.json`);
}

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function loadCassette(modelId: string, scenarioId: string): RawSceneData | null {
  const p = cassettePath(modelId, scenarioId);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) as RawSceneData;
  } catch {
    return null;
  }
}

export function saveCassette(modelId: string, scenarioId: string, data: RawSceneData): string {
  const p = cassettePath(modelId, scenarioId);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return p;
}

export function listCassetteModels(): string[] {
  if (!fs.existsSync(CASSETTE_ROOT)) return [];
  return fs
    .readdirSync(CASSETTE_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

export function hasCassette(modelId: string, scenarioId: string): boolean {
  return fs.existsSync(cassettePath(modelId, scenarioId));
}
