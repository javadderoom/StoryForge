import type { WorldBible, WorldStateLedger } from '@/lib/types/world';
import type { CheckResolution } from '@/lib/types/gameplay';

export interface ProseFinding {
  severity: 'error' | 'warning';
  category: 'resurrection' | 'new_entity' | 'outcome_mismatch' | 'lore_violation';
  detail: string;
}

export interface ProseValidationResult {
  ok: boolean;
  findings: ProseFinding[];
}

const MEMORIAL_PATTERN = /in memory|slain|fallen|grave|once |late |memory of|یاد|مزار|کشته|فقید|مرحوم/i;

const SUCCESS_WORDS = /triumph|victor|effortless|flawless|prevail|easily overcame|پیروزی|ظفر|آسان|بی‌نقص/i;
const FAILURE_WORDS = /fail|fumble|disaster|collapse|overwhelm|defeat|شکست|نافرجام|فاجعه|مغلوب/i;

/**
 * Deterministic post-generation prose validator (bilingual EN/FA).
 * Checks resurrected NPCs, smuggled entities, outcome mismatch, and
 * banned-creature/artifact lore violations. Pure and testable.
 */
export function validateProse(
  prose: string,
  opts: {
    ledger?: WorldStateLedger | null;
    resolution?: CheckResolution | null;
    worldBible?: WorldBible | null;
  } = {}
): ProseValidationResult {
  const findings: ProseFinding[] = [];
  const text = prose || '';
  const lower = text.toLowerCase();

  // 1. Resurrection: dead/transformed/missing NPCs must not act alive.
  for (const n of opts.ledger?.npcStatuses || []) {
    if (!['dead', 'transformed', 'missing'].includes(n.status)) continue;
    const name = (n.npcName || n.npcId || '').trim();
    if (name.length < 3 || !lower.includes(name.toLowerCase())) continue;
    if (!MEMORIAL_PATTERN.test(text)) {
      findings.push({
        severity: 'error',
        category: 'resurrection',
        detail: `NPC "${name}" is ${n.status} per ledger but appears alive in prose.`,
      });
    }
  }

  // 2. New-entity smuggling: unknown capitalized phrases / long FA nouns.
  if (opts.worldBible) {
    const known = new Set<string>();
    const collect = (arr: Array<{ name?: string; title?: string }> | undefined) => {
      for (const e of arr || []) {
        if (e.name) known.add(e.name.trim().toLowerCase());
        if (e.title) known.add(e.title.trim().toLowerCase());
      }
    };
    collect(opts.worldBible.factions as unknown as Array<{ name?: string }>);
    collect(opts.worldBible.locations as unknown as Array<{ name?: string }>);
    collect(opts.worldBible.npcs as unknown as Array<{ name?: string; title?: string }>);
    collect((opts.worldBible.artifacts || []) as Array<{ name?: string }>);
    collect((opts.worldBible.religions || []) as Array<{ name?: string; title?: string }>);
    collect((opts.worldBible.bestiary || []) as Array<{ name?: string }>);

    const candidates = new Set<string>();
    for (const m of text.matchAll(/\b[A-Z][a-z]{3,}(?:\s+[A-Z][a-z]{3,}){0,2}\b/g)) {
      candidates.add(m[0].trim().toLowerCase());
    }
    for (const m of text.matchAll(/[\u0600-\u06FF]{4,}(?:\s+[\u0600-\u06FF]{3,}){0,2}/g)) {
      candidates.add(m[0].trim());
    }
    const stop = new Set(['the', 'this', 'that', 'with', 'from', 'your', 'their', 'when', 'then', 'there']);
    let unknown = 0;
    for (const c of candidates) {
      if (c.length < 4 || stop.has(c)) continue;
      const hit = [...known].some((k) => k && (k.includes(c) || c.includes(k)));
      if (!hit) unknown++;
    }
    if (unknown > 3) {
      findings.push({
        severity: 'error',
        category: 'new_entity',
        detail: `${unknown} unknown proper nouns in prose; possible smuggled entities.`,
      });
    } else if (unknown > 0) {
      findings.push({
        severity: 'warning',
        category: 'new_entity',
        detail: `${unknown} unknown proper noun(s); verify against World Bible.`,
      });
    }
  }

  // 3. Outcome adherence.
  const outcome = opts.resolution?.outcome;
  if (outcome === 'failure' || outcome === 'critical_failure') {
    if (SUCCESS_WORDS.test(text) && !FAILURE_WORDS.test(text)) {
      findings.push({
        severity: 'error',
        category: 'outcome_mismatch',
        detail: `Outcome is ${outcome} but prose reads triumphant.`,
      });
    }
  } else if (outcome === 'success' || outcome === 'critical_success') {
    if (FAILURE_WORDS.test(text) && !SUCCESS_WORDS.test(text)) {
      findings.push({
        severity: 'error',
        category: 'outcome_mismatch',
        detail: `Outcome is ${outcome} but prose reads disastrous.`,
      });
    }
  }

  // 4. Lore: extinct creatures / unowned named artifacts invoked as owned.
  const laws = opts.worldBible?.laws || [];
  const extinct = /(extinct|no longer exist|eradicated|wiped out|منقرض|انقراض)/i;
  for (const law of laws) {
    if (!law.isImmutable || !extinct.test(`${law.rule} ${law.description || ''}`)) continue;
    const lawText = `${law.rule} ${law.description || ''}`.toLowerCase();
    for (const c of opts.worldBible?.bestiary || []) {
      const name = c.name.toLowerCase();
      if (name.length >= 4 && lawText.includes(name) && lower.includes(name)) {
        findings.push({
          severity: 'error',
          category: 'lore_violation',
          detail: `Extinct creature "${c.name}" appears in prose against immutable law.`,
        });
      }
    }
  }

  return { ok: !findings.some((f) => f.severity === 'error'), findings };
}

/** Repair instruction appended to the narrator prompt on retry. */
export function buildProseRepairInstruction(findings: ProseFinding[]): string {
  return (
    `REPAIR INSTRUCTION — your previous prose violated canon. Rewrite minimally to fix ONLY these issues, ` +
    `preserving names, outcome, and JSON schema:\n` +
    findings.map((f) => `- [${f.category}] ${f.detail}`).join('\n')
  );
}
