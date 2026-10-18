// ---------------------------------------------------------------------------
// Plan 17: Condition catalog — the single source of truth mapping the writer's
// English `kind` contract to the canonical tags stored in PlayerState.conditions.
//
// Canonical tags stay the existing Persian strings (`زخمی`, `تشنه`, …) so old
// sessions and old clients keep rendering unchanged; English kinds exist only
// in the model contract and in this catalog. Unknown kinds are stored as raw
// custom tags and rendered as-is by both clients (AGENTS: no invented data).
// ---------------------------------------------------------------------------

export type ConditionKind =
  | 'wounded'
  | 'bleeding'
  | 'exhausted'
  | 'thirsty'
  | 'poisoned'
  | 'dazed'
  | 'shaken'
  | 'vigilant'
  | 'outsider'
  | 'resolute'
  | 'suspected'
  | 'baseline'
  | 'custom';

export type ConditionZone = 'body' | 'mind' | 'situational';

export interface ConditionDef {
  kind: ConditionKind;
  /** Canonical tag persisted in PlayerState.conditions. */
  tag: string;
  zone: ConditionZone;
  /** Closure rules: this tag implies the listed kinds. */
  implies?: ConditionKind[];
  /** Treated variant tag for wounds/poisons (suffix convention). */
  treatedTag?: string;
  /** Baseline conditions are never injected into the prompt (noise-free). */
  promptSilent?: boolean;
  /** Extra raw strings that resolve to this kind (writer drift tolerance). */
  aliases?: string[];
  narrativeGuidance: { en: string; fa: string };
}

export const CONDITION_CATALOG: readonly ConditionDef[] = [
  {
    kind: 'wounded',
    tag: 'زخمی',
    zone: 'body',
    treatedTag: 'زخمی (پانسمان‌شده)',
    aliases: ['wound', 'injury', 'injured', 'injury_wound'],
    narrativeGuidance: {
      en: 'An open wound; movement aches, strain reopens it. Bandaging converts it to a treated wound.',
      fa: 'زخم باز؛ حرکت دردناک است و فشار زیاد آن را دوباره می‌شکافد. پانسمان آن را به زخم پانسمان‌شده تبدیل می‌کند.',
    },
  },
  {
    kind: 'bleeding',
    tag: 'خونریزی',
    zone: 'body',
    implies: ['wounded'],
    aliases: ['bleed', 'blood_loss', 'hemorrhage'],
    narrativeGuidance: {
      en: 'Active blood loss; never exists without a wound. Stops only when the wound is treated.',
      fa: 'خون‌ریزی فعال؛ هرگز بدون زخم وجود ندارد و فقط با پانسمان/مداوا بند می‌آید.',
    },
  },
  {
    kind: 'exhausted',
    tag: 'خسته',
    zone: 'body',
    aliases: ['exhaustion', 'fatigued', 'fatigue', 'weary', 'drained'],
    narrativeGuidance: {
      en: 'Deep fatigue; breath is short, hands tremble, reactions slow.',
      fa: 'فرسودگی عمیق؛ نفس کوتاه، دست‌ها لرزان و واکنش‌ها کند است.',
    },
  },
  {
    kind: 'thirsty',
    tag: 'تشنه',
    zone: 'body',
    aliases: ['thirst', 'parched', 'dehydrated'],
    narrativeGuidance: {
      en: 'Parched throat, cracked lips, ringing head; water is an obsession.',
      fa: 'گلوی خشک، لب‌های ترک‌خورده و سرگیجه؛ آب به دغدغه‌ای دائمی بدل شده است.',
    },
  },
  {
    kind: 'poisoned',
    tag: 'مسموم',
    zone: 'body',
    treatedTag: 'مسموم (پادزهرخورده)',
    aliases: ['poison', 'venom', 'venomed', 'toxin'],
    narrativeGuidance: {
      en: 'Venom or toxin in the blood; feverish chills and blurred focus until treated.',
      fa: 'زهر در خون؛ لرز و تب و تاری دید تا زمان پادزهر یا مداوا.',
    },
  },
  {
    kind: 'dazed',
    tag: 'گیج',
    zone: 'mind',
    aliases: ['dizzy', 'stunned', 'concussion', 'disoriented'],
    narrativeGuidance: {
      en: 'Concussed, ringing ears, the world tilts; focus is unreliable.',
      fa: 'سرگیجه و وزوز گوش؛ جهان کج می‌شود و تمرکز قابل‌اعتماد نیست.',
    },
  },
  {
    kind: 'shaken',
    tag: 'شوک‌زده',
    zone: 'mind',
    aliases: ['shocked', 'shock', 'terrified', 'horrified', 'panicked'],
    narrativeGuidance: {
      en: 'Mental shock; hands shake, the recent horror replays behind the eyes.',
      fa: 'شوک روانی؛ دست‌ها می‌لرزند و وحشت تازه پشت پلک‌ها تکرار می‌شود.',
    },
  },
  {
    kind: 'vigilant',
    tag: 'هوشیار',
    zone: 'mind',
    aliases: ['alert', 'watchful', 'alertness'],
    narrativeGuidance: {
      en: 'Alert and watchful; notices ambushes and environmental clues earlier.',
      fa: 'هوشیار و مراقب؛ کمین‌ها و نشانه‌های محیطی را زودتر می‌بیند.',
    },
  },
  {
    kind: 'outsider',
    tag: 'ناآشنا',
    zone: 'situational',
    aliases: ['stranger', 'foreigner', 'unfamiliar'],
    narrativeGuidance: {
      en: 'A stranger in this land; customs and hidden paths are still opaque.',
      fa: 'غریبه در این دیار؛ آداب و راه‌های پنهان هنوز مبهم است.',
    },
  },
  {
    kind: 'resolute',
    tag: 'مصمم',
    zone: 'mind',
    aliases: ['determined', 'resolved', 'steely'],
    narrativeGuidance: {
      en: 'Steely resolve; pain and fear are mastered, not absent.',
      fa: 'ارادهٔ پولادین؛ درد و ترس مهار شده‌اند، نه آنکه نباشند.',
    },
  },
  {
    kind: 'suspected',
    tag: 'مظنون',
    zone: 'situational',
    aliases: ['suspect', 'under_suspicion', 'watched'],
    narrativeGuidance: {
      en: 'Under scrutiny; guards and locals watch a little too closely.',
      fa: 'تحت نظر و سوءظن؛ نگهبانان و محلی‌ها با دقت بیش از حد می‌پایند.',
    },
  },
  {
    kind: 'baseline',
    tag: 'تندرست',
    zone: 'body',
    promptSilent: true,
    aliases: ['healthy', 'stable', 'vigorous', 'unencumbered'],
    narrativeGuidance: {
      en: 'Body in prime condition; no encumbrance from injury or fatigue.',
      fa: 'تن سالم و توانمند؛ هیچ جراحت یا فرسودگی بازدارنده‌ای نیست.',
    },
  },
] as const;

const CATALOG_BY_KIND = new Map<string, ConditionDef>(
  CONDITION_CATALOG.map((def) => [def.kind, def])
);

/** Normalizes a raw writer kind to catalog lookup form. */
function normalizeKindToken(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

/**
 * Resolves a writer-supplied kind to a catalog definition. Unknown kinds
 * return a synthetic `custom` definition carrying the raw phrase as its tag —
 * the reconciler stores it verbatim and the clients render it raw.
 */
export function resolveKind(raw: string): ConditionDef {
  const token = normalizeKindToken(raw || '');
  const direct = CATALOG_BY_KIND.get(token);
  if (direct) return direct;
  for (const def of CONDITION_CATALOG) {
    if (def.aliases?.some((a) => normalizeKindToken(a) === token)) return def;
  }
  const tag = (raw || '').trim();
  return {
    kind: 'custom',
    tag: tag || 'حالت ناشناخته',
    zone: 'situational',
    narrativeGuidance: { en: tag, fa: tag },
  };
}

/** Kind → canonical persisted tag. */
export function tagForKind(kind: string): string {
  return resolveKind(kind).tag;
}

/**
 * Tag → catalog definition (exact canonical tag, treated variant, or alias).
 * Returns null for genuinely custom tags so callers keep them verbatim.
 */
export function kindForTag(tag: string): ConditionDef | null {
  const t = (tag || '').trim();
  if (!t) return null;
  for (const def of CONDITION_CATALOG) {
    if (def.tag === t) return def;
    if (def.treatedTag && def.treatedTag === t) return def;
  }
  // Tolerate untranslated English aliases left over from tests/older data.
  const token = normalizeKindToken(t);
  for (const def of CONDITION_CATALOG) {
    if (normalizeKindToken(def.kind) === token) return def;
    if (def.aliases?.some((a) => normalizeKindToken(a) === token)) return def;
  }
  return null;
}

const TREATED_SUFFIX = /\((?:پانسمان‌شده|درمان‌شده|پادزهرخورده)\)/;

/** True when a stored tag carries a treated marker. */
export function isTreated(tag: string): boolean {
  const t = (tag || '').trim();
  if (TREATED_SUFFIX.test(t)) return true;
  return /\b(?:treated|bandaged|healed|dressed|stitched)\b/i.test(t);
}

/** Converts a wound/poison tag to its treated variant (idempotent). */
export function markTreated(tag: string): string {
  const t = (tag || '').trim();
  if (!t || isTreated(t)) return t;
  const def = kindForTag(t);
  if (def?.treatedTag) return def.treatedTag;
  return `${t} (درمان‌شده)`;
}

/** Closes implication rules (bleeding ⇒ wounded) and de-dupes. */
export function closeImplied(tags: string[]): string[] {
  const out: string[] = [];
  const push = (tag: string) => {
    const t = tag.trim();
    if (t && !out.some((existing) => existing === t)) out.push(t);
  };
  for (const raw of tags) push(raw);
  for (const tag of [...out]) {
    const def = kindForTag(tag);
    if (!def?.implies) continue;
    for (const implied of def.implies) push(tagForKind(implied));
  }
  // The baseline never coexists with an active body condition.
  const BODY_ZONES = new Set(['body']);
  const hasBodyCondition = out.some((tag) => {
    const def = kindForTag(tag);
    return def ? BODY_ZONES.has(def.zone) && def.kind !== 'baseline' : false;
  });
  return hasBodyCondition ? out.filter((tag) => tag.trim() !== 'تندرست') : out;
}

/**
 * Normalizes a stored condition list: trims, drops empties, folds known
 * aliases to canonical tags, applies closure rules, de-dupes. Unknown tags
 * survive verbatim.
 */
export function normalizeConditions(tags: string[]): string[] {
  const folded: string[] = [];
  for (const raw of tags ?? []) {
    const t = (raw || '').trim();
    if (!t) continue;
    const def = kindForTag(t);
    // Only fold non-canonical resolvable forms (English kinds/aliases);
    // canonical and treated tags are already the persisted form and stay
    // byte-identical; custom tags resolve to null and survive verbatim.
    if (def && def.tag !== t && def.treatedTag !== t) {
      folded.push(def.tag);
    } else {
      folded.push(t);
    }
  }
  return closeImplied(folded);
}

// ---------------------------------------------------------------------------
// Prose evidence patterns (Plan 17 §3.4). Deterministic, bilingual, and
// intentionally conservative: the reconciler only ADDS conditions the prose
// actually supports, so each pattern is anchored to bodily/mental language.
// ---------------------------------------------------------------------------

export const CONDITION_PROSE_PATTERNS: {
  wound: RegExp;
  bleeding: RegExp;
  treatment: RegExp;
  healing: RegExp;
  poison: RegExp;
  exhaustion: RegExp;
  thirst: RegExp;
  daze: RegExp;
  shock: RegExp;
  negation: RegExp;
} = {
  wound:
    /\b(wound(?:ed|s)?|gash(?:ed|es|ing)?|cut(?:s)?|slash(?:ed|es|ing)?|stab(?:bed|s|bing)?|lacerat(?:e|ed|es|ion|ing)|bruis(?:e|ed|es|ing)|sprain(?:ed|s|ing)?|limp(?:ing|ed|s)?|injur(?:y|ies|ed))\b|(زخم|جراحت|زخمی|مجروح|بریدگ|شکاف|کبودی|پیچ‌خوردگ|لنگید|آسیب)/i,
  bleeding:
    /\b(bleeding|bloodied|dripping blood|blood (?:runs|drips|oozes|spurts|seeps|soaks))\b|(خون‌ریزی|خون ?(?:از|بر|چکه|جاری)|خون‌آلود|خونی)/i,
  treatment:
    /\b(bandag(?:e|es|ed|ing)|dress(?:es|ed|ing) (?:the |his |her |your )?wound|bind(?:s|ing)? (?:the |his |her |your )?wound|splint(?:ed|ing)?|poultice|stitch(?:es|ed|ing)?|tourniquet|wrap(?:s|ped|ping) (?:the |his |her |your )?(?:wound|arm|leg|gash))\b|(باند|پانسمان|مرهم|آتل|بخیه|بستن زخم|بستن جراحت|گاز)/i,
  healing:
    /\b(heal(?:s|ed|ing)?|knit(?:s|ted)?|mend(?:s|ed)?|scar(?:red)? over|closed (?:up|over)|recovered)\b|(التیام|بهبود|درمان کامل|جوش خورد|بسته شد)/i,
  poison: /\b(poison(?:ed|ous)?|venom(?:ed|ous)?|antidote|toxin)\b|(مسموم|زهر|سم|پادزهر|زهرآلود)/i,
  exhaustion:
    /\b(exhaust(?:ed|ion)|fatigue(?:d)?|drained|breathless|wear(?:y|ied))\b|(خسته|فرسوده|فرسودگی|نفس‌برید|کوفته)/i,
  thirst: /\b(thirst(?:y)?|parched|dehydrat(?:ed|ion)|dry (?:throat|mouth))\b|(تشنه|تشنگی|عطش|خشک(?:ی)? گلو)/i,
  daze: /\b(dazed|dizzy|stunned|concuss(?:ed|ion)|disoriented)\b|(گیج|سرگیجه|مبهوت|هاجی‌خاطر)/i,
  shock: /\b(shaken|shocked|terrified|horrified|panick(?:ed|ing)?)\b|(شوک‌زده|شوکه|وحشت‌زده|هراسان|بهت‌زده)/i,
  negation:
    /\b(unharmed|untouched|without a scratch|unscathed|no (?:visible )?(?:wound|injur|blood|scratch)|not a scratch)\b|(بدون زخم|زخمی ?نخورد|زخم ?ندار|آسیب ?نخورد|خط و ?خشی ?برنداشت|سالم و ?بی‌آسیب)/i,
};

/** True when the condition list contains any non-silent condition. */
export function promptVisibleConditions(tags: string[] | undefined): string[] {
  return (tags ?? []).filter((tag) => !kindForTag(tag)?.promptSilent);
}
