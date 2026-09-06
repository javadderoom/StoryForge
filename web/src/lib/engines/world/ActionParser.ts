import {
  ALLOWED_ENTITIES,
  ENTITY_ALIASES,
  type ActionBlock,
  type EntityType,
  type ValidationResult,
} from './ActionProtocol.types';

export function normalizeEntityName(raw: unknown): EntityType | null {
  if (typeof raw !== 'string') return null;
  return ENTITY_ALIASES[raw.trim().toLowerCase()] || null;
}

export function sanitizeJsonSnippet(str: string): string {
  return str
    // Remove single-line comments
    .replace(/\/\/.*$/gm, '')
    // Remove trailing commas before closing braces/brackets
    .replace(/,\s*([}\]])/g, '$1')
    .trim();
}

export function extractJsonObjectsFromBlock(blockText: string): any[] {
  const sanitized = sanitizeJsonSnippet(blockText);
  try {
    const parsed = JSON.parse(sanitized);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    // Robust fallback: depth-counting parser to extract complete top-level JSON objects
    // while correctly handling nested braces inside "data": { ... } or "match": { ... }
    const objects: any[] = [];
    let depth = 0;
    let start = -1;
    let inString = false;
    let escape = false;

    for (let i = 0; i < sanitized.length; i++) {
      const char = sanitized[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (char === '\\') {
        escape = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (char === '{') {
          if (depth === 0) start = i;
          depth++;
        } else if (char === '}') {
          depth--;
          if (depth === 0 && start !== -1) {
            const chunk = sanitized.slice(start, i + 1);
            try {
              const p = JSON.parse(sanitizeJsonSnippet(chunk));
              if (p && typeof p === 'object') objects.push(p);
            } catch {
              /* skip unparseable slice */
            }
            start = -1;
          }
        }
      }
    }
    return objects;
  }
}

/** Helper to infer entity type from payload fields when omitted or unrecognized */
function inferEntityFromData(data: any): EntityType | null {
  if (!data || typeof data !== 'object') return null;
  if ('parentLocationName' in data || 'parentLocationId' in data || 'category' in data) return 'location';
  if ('scope' in data || 'secretAgendas' in data || 'alignment' in data) return 'faction';
  if ('rarity' in data || 'curseOrCost' in data || 'powers' in data) return 'artifact';
  if ('dangerLevel' in data && ('habitat' in data || 'loot' in data)) return 'creature';
  if ('dogma' in data || 'holyLocationIds' in data || 'blessings' in data) return 'deity';
  if ('immutable' in data || 'consequence' in data) return 'world_law';
  if ('eraCategory' in data || 'yearOrEra' in data) return 'timeline_event';
  if ('role' in data || 'personality' in data || 'currentLocationId' in data) return 'npc';
  return null;
}

export function parseActionBlocks(reply: string): ActionBlock[] {
  const actions: ActionBlock[] = [];
  // 1. Match fenced code blocks with any tag (storyforge-action, storyforge_action, json, etc.)
  // or unclosed code fence at end of reply.
  const fenceRegex = /```[^\n\r]*[\r\n]+([\s\S]*?)(?:```|$)/g;
  const rawBlocks: string[] = [];

  for (const match of reply.matchAll(fenceRegex)) {
    if (match[1]?.trim()) {
      rawBlocks.push(match[1].trim());
    }
  }

  // 2. If no fenced blocks found, parse raw reply text directly
  if (rawBlocks.length === 0) {
    rawBlocks.push(reply);
  }

  for (const block of rawBlocks) {
    const rawList = extractJsonObjectsFromBlock(block);
    for (const obj of rawList) {
      if (!obj || typeof obj !== 'object') continue;
      const validOp = obj.op === 'create' || obj.op === 'update' || obj.op === 'delete';
      if (!validOp) continue;

      let entity = normalizeEntityName(obj.entity);
      if (!entity && obj.data) {
        entity = inferEntityFromData(obj.data);
      }
      if (
        !entity &&
        (obj.op === 'update' || obj.op === 'delete') &&
        obj.match &&
        typeof obj.match.byName === 'string'
      ) {
        // entity resolved later by caller via resolveEntityTarget across types
        entity = obj.entity as EntityType;
      }
      const validEntity =
        !!entity ||
        ((obj.op === 'update' || obj.op === 'delete') &&
          obj.match &&
          typeof obj.match.byName === 'string');
      const hasTarget =
        obj.op === 'create'
          ? typeof obj.prompt === 'string' || (obj.data && typeof obj.data === 'object')
          : !!(obj.match && typeof obj.match.byName === 'string');
      if (validOp && validEntity && hasTarget) {
        actions.push({ ...obj, entity } as ActionBlock);
      }
    }
  }
  return actions;
}

export function validateActionBlock(block: ActionBlock): ValidationResult {
  const ops = ['create', 'update', 'delete'];
  if (!ops.includes(block.op)) return { valid: false, error: `invalid op: ${block.op}` };
  if (!ALLOWED_ENTITIES.includes(block.entity))
    return { valid: false, error: `invalid entity: ${block.entity}` };
  if (block.op === 'create' && !block.prompt && (!block.data || typeof block.data !== 'object'))
    return { valid: false, error: 'create requires a prompt or data' };
  if ((block.op === 'update' || block.op === 'delete') && !block.match?.byName)
    return { valid: false, error: `${block.op} requires match.byName` };
  if (block.op === 'update' && !block.prompt && (!block.data || typeof block.data !== 'object'))
    return { valid: false, error: 'update requires a prompt or data' };
  return { valid: true };
}
