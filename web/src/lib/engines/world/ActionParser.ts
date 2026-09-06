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
    // Fallback: multiple concatenated JSON objects e.g. { "op": ... } { "op": ... }
    const objects: any[] = [];
    const braceRegex = /\{[\s\S]*?\}(?=\s*(?:\{|$))/g;
    const matches = sanitized.match(braceRegex);
    if (matches) {
      for (const m of matches) {
        try {
          const p = JSON.parse(sanitizeJsonSnippet(m));
          if (p && typeof p === 'object') objects.push(p);
        } catch {
          /* skip unparseable slice */
        }
      }
    }
    return objects;
  }
}

export function parseActionBlocks(reply: string): ActionBlock[] {
  const actions: ActionBlock[] = [];
  // Match fenced blocks with storyforge-action / json / jsonc or no tag
  const matches = [
    ...reply.matchAll(/```(?:storyforge-action|json|jsonc)?[\s\r\n]*([\s\S]*?)```/gi),
  ];

  const rawBlocks = matches.map((m) => m[1]);

  // If no fenced blocks found, attempt to find raw action JSON structures
  if (rawBlocks.length === 0) {
    const rawActionRegex = /\{\s*"op"\s*:\s*"(?:create|update|delete)"[\s\S]*?\}/g;
    const rawMatches = reply.match(rawActionRegex);
    if (rawMatches) {
      rawBlocks.push(...rawMatches);
    }
  }

  for (const block of rawBlocks) {
    const rawList = extractJsonObjectsFromBlock(block);
    for (const obj of rawList) {
      if (!obj || typeof obj !== 'object') continue;
      const validOp = obj.op === 'create' || obj.op === 'update' || obj.op === 'delete';
      let entity = normalizeEntityName(obj.entity);
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
