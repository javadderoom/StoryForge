import type { PlayerState } from '@/lib/types/gameplay';
import type { StoryNpcOverride } from '@/lib/types/story';
import type { WorldBible } from '@/lib/types/world';

/**
 * Shared stopwords + tokenizer for undiscovered-secret guards (`ActionValidator`
 * and `aotBranchAudit`).
 *
 * Persian punctuation (، ؛ ؟ « » ـ) falls inside U+0600..U+06FF, so splitting on
 * `/[^a-z\u0600-\u06FF]+/` previously left trailing commas on Persian tokens
 * (`نیست،`, `آرتاوان،`) and had zero Persian stopwords — causing routine desert/
 * caravan prose to trigger `secret_leak` false positives.
 */
export const SECRET_STOPWORDS = new Set([
  // English stopwords
  'about', 'their', 'that', 'this', 'with', 'from', 'have', 'has', 'the',
  'and', 'you', 'your', 'will', 'into', 'they', 'them', 'then', 'than',
  'what', 'when', 'know', 'secret', 'secrets', 'where', 'which', 'while',
  'there', 'these', 'those', 'being', 'could', 'would', 'should', 'under',
  'after', 'before', 'between', 'through', 'during', 'without', 'within',
  // Persian function words, auxiliaries, and common prose glue (>=5 chars)
  'است', 'نیست', 'هستند', 'نیستند', 'داشت', 'دارد', 'دارند', 'داشته',
  'باشد', 'باشند', 'خواهد', 'خواهند', 'تواند', 'توانند', 'شوند', 'شود',
  'کرده', 'کردند', 'می‌کند', 'می‌کنند', 'می‌شود', 'می‌شوند', 'می‌دهد',
  'می‌برد', 'می‌داند', 'می‌شناسد', 'می‌گیرد', 'برساند', 'بگیرد', 'بگذرد',
  'درباره', 'درباره‌ی', 'دربارهٔ', 'پیرامون', 'نزدیک', 'مقابل', 'بیرون',
  'درون', 'میانه', 'میان', 'همراه', 'همهٔ', 'تمامی', 'بسیار', 'اندکی',
  'دیگری', 'دیگران', 'کسی', 'چیز', 'چیزی', 'همین', 'همان', 'چنان', 'چگونه',
  'اینکه', 'آنکه', 'چراکه', 'هنگام', 'هنگامی', 'هنوز', 'اکنون', 'شاید',
  'مانند', 'به‌جز', 'بدون', 'برابر', 'پشت', 'کنار', 'بالای', 'پایین',
  'روی', 'سوی', 'سمت', 'برای', 'توسط', 'حتی', 'فقط', 'تنها', 'بلکه',
  'زیرا', 'اگرچه', 'وقتی', 'زمانی', 'پیش', 'پس', 'خیلی', 'کاملاً', 'واقعاً',
  'خودش', 'ایشان', 'آنان', 'آن‌ها', 'آنها', 'این‌ها', 'اینها', 'ماجرا',
  // Common geographical / caravan setting nouns that appear in routine Act 1 scenes
  'هیرام', 'زروان', 'کاروان', 'کاروان‌ها', 'کاروانیان', 'مسیر', 'جاده',
  'بیابان', 'دشت', 'شتران', 'شترهای', 'شترها', 'ستوران', 'مسافران',
]);

/** Normalizes Arabic/Persian variants and strips diacritics for matching. */
export function normalizeMatchText(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '') // diacritics & tatweel
    .replace(/\u064A/g, '\u06CC') // ي -> ی
    .replace(/\u0643/g, '\u06A9') // ك -> ک
    .replace(/\u0629/g, '\u0647'); // ة -> ه
}

/** Splits normalized text into letter/digit tokens, separating Persian punctuation. */
export function tokenizeMatchWords(text: string): string[] {
  return normalizeMatchText(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

export function extractDistinctiveSecretTerms(
  description: string,
  extraExclusions?: Set<string>
): string[] {
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const w of tokenizeMatchWords(description)) {
    if (w.length < 5) continue;
    if (SECRET_STOPWORDS.has(w)) continue;
    if (extraExclusions?.has(w)) continue;
    if (seen.has(w)) continue;
    seen.add(w);
    terms.push(w);
  }
  return terms;
}

export interface SecretLeakMatch {
  npcId: string;
  npcName: string;
  secretId: string;
  secretDescription: string;
  matchedById: boolean;
  matchedTerms: string[];
}

interface SecretNpcShape {
  id?: string;
  name?: string;
  secrets?: Array<{ id?: string; description?: string; revealed?: boolean }>;
}

/**
 * Finds the first undiscovered NPC secret echoed in `text` (prose or action).
 * Precision rule: either the secret ID appears verbatim, or the NPC is named
 * AND at least 2 distinctive secret terms appear in `text`.
 */
export function findUndiscoveredSecretMatch(
  text: string,
  playerState: PlayerState,
  worldBible?: WorldBible | null,
  storyNpcOverrides?: Record<string, StoryNpcOverride> | null
): SecretLeakMatch | null {
  const normalizedText = normalizeMatchText(text);
  if (!normalizedText) return null;
  const textTokens = new Set(tokenizeMatchWords(normalizedText));

  const npcs = (worldBible?.npcs ?? []) as unknown as SecretNpcShape[];
  for (const npc of npcs) {
    const npcId = npc.id ?? '';
    const npcName = npc.name ?? npcId ?? 'an NPC';
    const rel = playerState.relationships?.[npcId];
    const knownIds = new Set(rel?.knownSecrets ?? []);

    const secrets: Array<{ id?: string; description?: string; revealed?: boolean }> = [
      ...(npc.secrets ?? []),
    ];
    const overrideSecret = npcId ? storyNpcOverrides?.[npcId]?.storySecret : undefined;
    if (typeof overrideSecret === 'string' && overrideSecret.trim().length >= 12) {
      secrets.push({ id: `override_secret_${npcId}`, description: overrideSecret.trim() });
    }

    const nameWords = tokenizeMatchWords(npc.name ?? '').filter((w) => w.length >= 3);
    const nameWordSet = new Set(nameWords);

    for (const secret of secrets) {
      const description = (secret.description ?? '').trim();
      if (secret.revealed || (secret.id && knownIds.has(secret.id))) continue;
      if (description.length < 12) continue;

      if (secret.id && normalizedText.includes(normalizeMatchText(secret.id))) {
        return {
          npcId,
          npcName,
          secretId: secret.id,
          secretDescription: description,
          matchedById: true,
          matchedTerms: [],
        };
      }

      if (!nameWords.some((w) => normalizedText.includes(w))) continue;

      const terms = extractDistinctiveSecretTerms(description, nameWordSet);
      if (terms.length === 0) continue;

      const matchedTerms: string[] = [];
      for (const term of terms) {
        if (textTokens.has(term) || normalizedText.includes(term)) {
          matchedTerms.push(term);
          if (matchedTerms.length >= 2) break;
        }
      }

      if (matchedTerms.length >= 2) {
        return {
          npcId,
          npcName,
          secretId: secret.id ?? '',
          secretDescription: description,
          matchedById: false,
          matchedTerms,
        };
      }
    }
  }

  return null;
}
