import type { WorldStateLedger } from '@/lib/types/world';
import { unexpectedPersianScriptCharacters } from './ProseValidator';

const MEMORIAL_PATTERN =
  /in memory|slain|fallen|grave|once |late |memory of|یاد|مزار|کشته|فقید|مرحوم/i;

/**
 * Words that would spoil a post-roll outcome inside a pre-roll `leadIn`.
 * A choice lead-in MUST remain suspended immediately before outcome resolution.
 */
const LEADIN_OUTCOME_LEAK_PATTERN =
  /\b(succeeds?|succeeded|fails?|failed|fumble[sd]?|triumphs?|triumphed|victorious|defeated|conquered|overwhelmed|effortless(?:ly)?|flawless(?:ly)?|unscathed|eventually|finally)\b|موفق می‌شوی|موفق شدی|پیروز می‌شوی|شکست می‌خوری|شکست خوردی|ناکامی|سرانجام|در نهایت|پیروزمندانه|مغلوب می‌شوی|کشته می‌شوی|کشته می‌شود|بی‌نقص|بدون خراش/i;

const MAX_LEADIN_CHARS = 420;
const MAX_LEADIN_WORDS = 70;
const MIN_LEADIN_CHARS = 12;

function normalizeForComparison(input: string): string {
  return (input || '')
    .replace(/[\u200c\u200b\u200d]/g, ' ')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[«»"'`.,،؛:!؟?\-–—()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function tokenOverlapRatio(a: string, b: string): number {
  const tokensA = new Set(normalizeForComparison(a).split(' ').filter((t) => t.length >= 2));
  const tokensB = new Set(normalizeForComparison(b).split(' ').filter((t) => t.length >= 2));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let shared = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) shared += 1;
  }
  return shared / Math.min(tokensA.size, tokensB.size);
}

/**
 * Cleans and validates an individual choice's pre-roll `leadIn`.
 * Returns `undefined` when invalid or unsafe so defective lead-ins are silently
 * dropped without harming the parent choice or scene.
 */
export function sanitizeChoiceLeadIn(
  rawLeadIn: unknown,
  choiceText: string,
  opts: {
    ledger?: WorldStateLedger | null;
    isPersian?: boolean;
  } = {}
): string | undefined {
  if (typeof rawLeadIn !== 'string') return undefined;

  let cleaned = rawLeadIn
    .replace(/\r\n?/g, '\n')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[«"“'`](.*)[»"”'`]$/, '$1')
    .trim();

  if (cleaned.length < MIN_LEADIN_CHARS || cleaned.length > MAX_LEADIN_CHARS) {
    return undefined;
  }

  const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
  if (wordCount < 3 || wordCount > MAX_LEADIN_WORDS) {
    return undefined;
  }

  if (LEADIN_OUTCOME_LEAK_PATTERN.test(cleaned)) {
    return undefined;
  }

  if (opts.isPersian && unexpectedPersianScriptCharacters(cleaned).length > 0) {
    return undefined;
  }

  const normLead = normalizeForComparison(cleaned);
  const normChoice = normalizeForComparison(choiceText);
  if (!normLead || normLead === normChoice) {
    return undefined;
  }
  if (tokenOverlapRatio(cleaned, choiceText) >= 0.85 && Math.abs(cleaned.length - choiceText.length) < 18) {
    return undefined;
  }

  // Never allow a lead-in to resurrect dead/transformed/missing NPCs.
  if (opts.ledger?.npcStatuses?.length) {
    const lowerLead = cleaned.toLowerCase();
    for (const status of opts.ledger.npcStatuses) {
      if (!['dead', 'transformed', 'missing'].includes(status.status)) continue;
      const name = (status.npcName || status.npcId || '').trim().toLowerCase();
      if (name.length >= 3 && lowerLead.includes(name) && !MEMORIAL_PATTERN.test(cleaned)) {
        return undefined;
      }
    }
  }

  return cleaned;
}

/**
 * Strips an accidental echo of `openingLeadIn` if the model repeated its opening
 * sentence(s) despite prompt instructions.
 */
export function stripDuplicateLeadInPrefix(
  openingLeadIn: string | undefined,
  continuation: string
): string {
  const lead = (openingLeadIn || '').trim();
  const body = (continuation || '').trim();
  if (!lead || !body) return continuation;

  const paragraphs = body.split(/\n{2,}/);
  if (paragraphs.length > 1) {
    const firstPara = paragraphs[0].trim();
    if (
      normalizeForComparison(firstPara) === normalizeForComparison(lead) ||
      tokenOverlapRatio(firstPara, lead) >= 0.85
    ) {
      return paragraphs.slice(1).join('\n\n').trimStart();
    }
  }

  // Also guard single-paragraph continuations starting verbatim with the lead-in.
  if (body.startsWith(lead)) {
    return body.slice(lead.length).trimStart();
  }

  return continuation;
}

/**
 * Joins an already-displayed `openingLeadIn` and the newly generated continuation
 * cleanly into one canonical stored scene prose string.
 */
export function combineLeadInAndContinuation(
  openingLeadIn: string | undefined,
  continuation: string
): string {
  const lead = (openingLeadIn || '').trim();
  const dedupedContinuation = stripDuplicateLeadInPrefix(lead, continuation).trim();
  if (!lead) return dedupedContinuation;
  if (!dedupedContinuation) return lead;
  return `${lead}\n\n${dedupedContinuation}`;
}
