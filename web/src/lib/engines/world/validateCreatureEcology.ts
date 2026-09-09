/**
 * Creature ecology output validator.
 * The `creature_ecology` generator is out-of-context by construction: it emits
 * bare prey/predator name strings with no danger knowledge, and nothing pins
 * its prose to the target's real species category. This validator cross-checks
 * a payload against the target creature + known bestiary and reports:
 * - danger inversions (a danger-4 beast as prey of a danger-2 predator),
 * - category bleed (mining/extraction prose on a non-mineral species),
 * - self references, and unknown names (future ghosts).
 *
 * Match confidence is calibrated: exact name matches yield errors, fuzzy
 * substring matches yield warnings. Justified exceptions (pack, swarm,
 * parasite, ambush, venom) downgrade inversions to warnings.
 */
import type { WorldCreature, EnhancedCreaturePayload } from '@/lib/types/world';

export type EcologyIssueCode = 'danger_inversion' | 'category_bleed' | 'self_reference';

export interface EcologyIssue {
  severity: 'error' | 'warning';
  code: EcologyIssueCode;
  messageEn: string;
  messageFa: string;
}

export interface EcologyValidationResult {
  errors: EcologyIssue[];
  warnings: EcologyIssue[];
  /** Prey/predator/reagent names with no exact bestiary match — future ghosts. */
  ghosts: string[];
  hasError: boolean;
}

/** Mechanism words that justify breaking danger ordering (packs, swarms, ...). */
const EXCEPTION_KEYWORDS =
  /pack|swarm|parasit|ambush|venom|trap|colony|gang|گله|گروه|انبوه|ازدحام|انگل|کمین|زهر|سم|تله|دسته‌جمعی|دسته جمعی/i;

/** Mining / extraction vocabulary that must never describe a non-mineral species. */
const MINERAL_BLEED_KEYWORDS =
  /استخراج|رگه|معدن|معدن‌کاوی|معدنکاوی|کلنگ|حفاری|گمانه|تونل|گودال معدن|mining|mine shaft|excavat|ore vein|pickaxe|quarry/i;

const norm = (s: string) => s.trim().toLowerCase();

function findKnown(
  name: string,
  bestiary: WorldCreature[]
): { creature: WorldCreature; exact: boolean } | null {
  const n = norm(name);
  if (!n) return null;
  const exact = bestiary.find((c) => norm(c.name) === n);
  if (exact) return { creature: exact, exact: true };
  const fuzzy = bestiary.find((c) => {
    const cn = norm(c.name);
    return (n.includes(cn) || cn.includes(n)) && Math.min(n.length, cn.length) >= 4;
  });
  return fuzzy ? { creature: fuzzy, exact: false } : null;
}

function exceptionJustified(niche?: string): boolean {
  return !!niche && EXCEPTION_KEYWORDS.test(niche);
}

export function validateCreatureEcology(
  payload: EnhancedCreaturePayload,
  target: WorldCreature,
  bestiary: WorldCreature[]
): EcologyValidationResult {
  const errors: EcologyIssue[] = [];
  const warnings: EcologyIssue[] = [];
  const ghosts: string[] = [];
  const seenGhosts = new Set<string>();
  const justified = exceptionJustified(payload.predatorPreyNiche);

  const flagGhost = (name: string) => {
    const n = norm(name);
    if (n && !seenGhosts.has(n)) {
      seenGhosts.add(n);
      ghosts.push(name.trim());
    }
  };

  const checkFoodChain = (names: string[] | undefined, role: 'prey' | 'predator') => {
    for (const raw of names ?? []) {
      const name = raw?.trim();
      if (!name) continue;
      if (norm(name) === norm(target.name)) {
        warnings.push({
          severity: 'warning',
          code: 'self_reference',
          messageEn: `"${name}" lists the target creature itself as ${role}.`,
          messageFa: `«${name}» خود گونهٔ هدف را به‌عنوان ${role === 'prey' ? 'طعمه' : 'شکارچی'} فهرست کرده است.`,
        });
        continue;
      }
      const known = findKnown(name, bestiary);
      if (!known) {
        flagGhost(name);
        continue;
      }
      const knownDanger = known.creature.dangerLevel;
      const inverted =
        role === 'prey' ? knownDanger > target.dangerLevel : knownDanger < target.dangerLevel;
      if (!inverted) continue;
      const relation =
        role === 'prey'
          ? `danger-${knownDanger} prey of a danger-${target.dangerLevel} hunter`
          : `danger-${knownDanger} predator of a danger-${target.dangerLevel} creature`;
      const issue: EcologyIssue = {
        severity: 'error',
        code: 'danger_inversion',
        messageEn: `"${name}" is a ${relation} — danger ordering is inverted.`,
        messageFa: `«${name}» ${role === 'prey' ? `طعمه‌ای با خطر ${knownDanger} برای شکارچی خطر ${target.dangerLevel}` : `شکارچی‌ای با خطر ${knownDanger} برای گونه‌ای با خطر ${target.dangerLevel}`} است — ترتیب خطر وارونه است.`,
      };
      if (justified || !known.exact) {
        issue.severity = 'warning';
        if (justified) {
          issue.messageEn += ' An exception mechanism is stated, please verify it reads true.';
          issue.messageFa += ' سازوکار استثنا ذکر شده؛ لطفاً بررسی کنید که منطقی باشد.';
        } else {
          issue.messageEn += ' (fuzzy name match — verify it refers to this entry.)';
          issue.messageFa += ' (تطابق تقریبی نام — بررسی کنید که همین مدخل باشد.)';
        }
        warnings.push(issue);
      } else {
        errors.push(issue);
      }
    }
  };

  checkFoodChain(payload.preySpecies, 'prey');
  checkFoodChain(payload.predatorSpecies, 'predator');

  // Pacification reagents only feed the ghost list (no danger semantics).
  for (const raw of payload.pacificationReagents ?? []) {
    const name = raw?.trim();
    if (name && !findKnown(name, bestiary)) flagGhost(name);
  }

  // Category bleed: mining/extraction prose on a non-mineral species.
  if (target.speciesCategory !== 'mineral' && target.speciesCategory !== 'flora') {
    const prose = `${payload.predatorPreyNiche ?? ''}\n${payload.nonCombatPacificationMethod ?? ''}`;
    if (MINERAL_BLEED_KEYWORDS.test(prose)) {
      errors.push({
        severity: 'error',
        code: 'category_bleed',
        messageEn: `Ecology prose describes mining/extraction, but "${target.name}" is a ${target.speciesCategory}, not a mineral.`,
        messageFa: `متن اکولوژی از استخراج و معدن می‌گوید، اما «${target.name}» کانی نیست.`,
      });
    }
  }

  return { errors, warnings, ghosts, hasError: errors.length > 0 };
}
