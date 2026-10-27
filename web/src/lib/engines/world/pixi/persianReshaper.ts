/**
 * persianReshaper.ts
 *
 * Lightweight, zero-dependency Arabic & Persian Cursive Glyph Reshaper.
 * Maps standard Arabic/Persian Unicode characters to their proper Presentation Forms-B/A
 * contextual glyphs (Isolated, Initial, Medial, Final) and handles Right-to-Left bidirectional
 * ordering for curved spline typography.
 */

export interface GlyphFormTable {
  isolated: number;
  final: number;
  initial: number;
  medial: number;
  nonConnectingToNext?: boolean;
}

const GLYPH_MAP: Record<string, GlyphFormTable> = {
  // Alef Madda
  '\u0622': { isolated: 0xfe81, final: 0xfe82, initial: 0xfe81, medial: 0xfe82, nonConnectingToNext: true },
  // Alef Hamza Above
  '\u0623': { isolated: 0xfe83, final: 0xfe84, initial: 0xfe83, medial: 0xfe84, nonConnectingToNext: true },
  // Vav Hamza
  '\u0624': { isolated: 0xfe85, final: 0xfe86, initial: 0xfe85, medial: 0xfe86, nonConnectingToNext: true },
  // Alef Hamza Below
  '\u0625': { isolated: 0xfe87, final: 0xfe88, initial: 0xfe87, medial: 0xfe88, nonConnectingToNext: true },
  // Yeh Hamza
  '\u0626': { isolated: 0xfe89, final: 0xfe8a, initial: 0xfe8b, medial: 0xfe8c },
  // Alef
  '\u0627': { isolated: 0xfe8d, final: 0xfe8e, initial: 0xfe8d, medial: 0xfe8e, nonConnectingToNext: true },
  // Beh
  '\u0628': { isolated: 0xfe8f, final: 0xfe90, initial: 0xfe91, medial: 0xfe92 },
  // Peh (Persian)
  '\u067E': { isolated: 0xfb56, final: 0xfb57, initial: 0xfb58, medial: 0xfb59 },
  // Teh Marbuta
  '\u0629': { isolated: 0xfe93, final: 0xfe94, initial: 0xfe93, medial: 0xfe94, nonConnectingToNext: true },
  // Teh
  '\u062A': { isolated: 0xfe95, final: 0xfe96, initial: 0xfe97, medial: 0xfe98 },
  // Theh
  '\u062B': { isolated: 0xfe99, final: 0xfe9a, initial: 0xfe9b, medial: 0xfe9c },
  // Jeem
  '\u062C': { isolated: 0xfe9d, final: 0xfe9e, initial: 0xfe9f, medial: 0xfea0 },
  // Tcheh / Cheh (Persian)
  '\u0686': { isolated: 0xfb7a, final: 0xfb7b, initial: 0xfb7c, medial: 0xfb7d },
  // Hah
  '\u062D': { isolated: 0xfea1, final: 0xfea2, initial: 0xfea3, medial: 0xfea4 },
  // Khah
  '\u062E': { isolated: 0xfea5, final: 0xfea6, initial: 0xfea7, medial: 0xfea8 },
  // Dal
  '\u062F': { isolated: 0xfea9, final: 0xfeaa, initial: 0xfea9, medial: 0xfeaa, nonConnectingToNext: true },
  // Thal
  '\u0630': { isolated: 0xfeab, final: 0xfeac, initial: 0xfeab, medial: 0xfeac, nonConnectingToNext: true },
  // Reh
  '\u0631': { isolated: 0xfead, final: 0xfeae, initial: 0xfead, medial: 0xfeae, nonConnectingToNext: true },
  // Zain
  '\u0632': { isolated: 0xfeaf, final: 0xfeb0, initial: 0xfeaf, medial: 0xfeb0, nonConnectingToNext: true },
  // Zhe (Persian)
  '\u0698': { isolated: 0xfb8a, final: 0xfb8b, initial: 0xfb8a, medial: 0xfb8b, nonConnectingToNext: true },
  // Seen
  '\u0633': { isolated: 0xfeb1, final: 0xfeb2, initial: 0xfeb3, medial: 0xfeb4 },
  // Sheen
  '\u0634': { isolated: 0xfeb5, final: 0xfeb6, initial: 0xfeb7, medial: 0xfeb8 },
  // Sad
  '\u0635': { isolated: 0xfeb9, final: 0xfeba, initial: 0xfebb, medial: 0xfebc },
  // Dad
  '\u0636': { isolated: 0xfebd, final: 0xfebe, initial: 0xfebf, medial: 0xfec0 },
  // Tah
  '\u0637': { isolated: 0xfec1, final: 0xfec2, initial: 0xfec3, medial: 0xfec4 },
  // Zah
  '\u0638': { isolated: 0xfec5, final: 0xfec6, initial: 0xfec7, medial: 0xfec8 },
  // Ain
  '\u0639': { isolated: 0xfec9, final: 0xfeca, initial: 0xfecb, medial: 0xfecc },
  // Ghain
  '\u063A': { isolated: 0xfecd, final: 0xfece, initial: 0xfecf, medial: 0xfed0 },
  // Feh
  '\u0641': { isolated: 0xfed1, final: 0xfed2, initial: 0xfed3, medial: 0xfed4 },
  // Qaf
  '\u0642': { isolated: 0xfed5, final: 0xfed6, initial: 0xfed7, medial: 0xfed8 },
  // Keheh (Persian Kaf)
  '\u06A9': { isolated: 0xfb8e, final: 0xfb8f, initial: 0xfb90, medial: 0xfb91 },
  // Kaf (Arabic)
  '\u0643': { isolated: 0xfed9, final: 0xfeda, initial: 0xfedb, medial: 0xfedc },
  // Gaf (Persian)
  '\u06AF': { isolated: 0xfb92, final: 0xfb93, initial: 0xfb94, medial: 0xfb95 },
  // Lam
  '\u0644': { isolated: 0xfedd, final: 0xfede, initial: 0xfedf, medial: 0xfee0 },
  // Meem
  '\u0645': { isolated: 0xfee1, final: 0xfee2, initial: 0xfee3, medial: 0xfee4 },
  // Noon
  '\u0646': { isolated: 0xfee5, final: 0xfee6, initial: 0xfee7, medial: 0xfee8 },
  // Vav
  '\u0648': { isolated: 0xfeed, final: 0xfeee, initial: 0xfeed, medial: 0xfeee, nonConnectingToNext: true },
  // Heh
  '\u0647': { isolated: 0xfee9, final: 0xfeea, initial: 0xfeeb, medial: 0xfeec },
  // Persian Farsi Yeh
  '\u06CC': { isolated: 0xfbfc, final: 0xfbfd, initial: 0xfbfe, medial: 0xfbff },
  // Arabic Yeh
  '\u064A': { isolated: 0xfef1, final: 0xfef2, initial: 0xfef3, medial: 0xfef4 },
  // Alef Maksura
  '\u0649': { isolated: 0xfeef, final: 0xfef0, initial: 0xfeef, medial: 0xfef0, nonConnectingToNext: true },
};

/**
 * Returns true if text contains any Persian or Arabic characters.
 */
export function isRtlText(text: string): boolean {
  return /[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFC]/.test(text);
}

/**
 * Shapes a Persian/Arabic string into contextual cursive presentation form glyphs.
 * E.g. "زرین" -> [ز_isolated, ر_isolated, یـ_initial, ـن_final]
 */
export function reshapePersianWord(word: string): string[] {
  const result: string[] = [];
  const chars = Array.from(word);

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const prevCh = i > 0 ? chars[i - 1] : null;
    const nextCh = i < chars.length - 1 ? chars[i + 1] : null;

    const currentEntry = GLYPH_MAP[ch];
    if (!currentEntry) {
      result.push(ch);
      continue;
    }

    // Special Lam-Alef Ligature
    if (ch === '\u0644' && nextCh) {
      const prevEntry = prevCh ? GLYPH_MAP[prevCh] : null;
      const prevConnects = Boolean(prevEntry && !prevEntry.nonConnectingToNext);

      let lamAlefCode: number | null = null;
      if (nextCh === '\u0622') {
        lamAlefCode = prevConnects ? 0xfef6 : 0xfef5;
      } else if (nextCh === '\u0623') {
        lamAlefCode = prevConnects ? 0xfef8 : 0xfef7;
      } else if (nextCh === '\u0625') {
        lamAlefCode = prevConnects ? 0xfefa : 0xfef9;
      } else if (nextCh === '\u0627') {
        lamAlefCode = prevConnects ? 0xfefc : 0xfefb;
      }

      if (lamAlefCode !== null) {
        result.push(String.fromCharCode(lamAlefCode));
        i++; // skip next alef
        continue;
      }
    }

    const prevEntry = prevCh ? GLYPH_MAP[prevCh] : null;
    const nextEntry = nextCh ? GLYPH_MAP[nextCh] : null;

    // Previous letter connects to current letter if it exists and is dual-joining
    const prevConnects = Boolean(prevEntry && !prevEntry.nonConnectingToNext);
    // Current letter can connect to next letter if it is dual-joining AND next letter is an Arabic letter
    const nextConnects = Boolean(nextEntry && !currentEntry.nonConnectingToNext);

    let charCode: number;
    if (prevConnects && nextConnects) {
      charCode = currentEntry.medial;
    } else if (prevConnects && !nextConnects) {
      charCode = currentEntry.final;
    } else if (!prevConnects && nextConnects) {
      charCode = currentEntry.initial;
    } else {
      charCode = currentEntry.isolated;
    }

    result.push(String.fromCharCode(charCode));
  }

  return result;
}

/**
 * Prepares a string for spline typography:
 * If the string contains RTL characters, it:
 * 1. Reshapes cursive Persian/Arabic letters into contextual connected glyphs.
 * 2. Reverses the glyph array so that when placed along the spline (which marches from start to end),
 *    the first letter of the Persian word appears on the right and reads naturally Right-to-Left!
 *
 * For non-RTL (Latin) text, returns the characters in normal order.
 */
export function prepareSplineGlyphs(text: string): { glyphs: string[]; isRtl: boolean } {
  if (!text || text.length === 0) {
    return { glyphs: [], isRtl: false };
  }

  const hasRtl = isRtlText(text);
  if (!hasRtl) {
    return {
      glyphs: Array.from(text),
      isRtl: false,
    };
  }

  // Split text into tokens by spaces to preserve word boundaries
  const words = text.split(/(\s+)/);
  const shapedWords: string[] = [];

  for (const token of words) {
    if (token.trim().length === 0) {
      shapedWords.push(token);
    } else if (isRtlText(token)) {
      const shaped = reshapePersianWord(token);
      shapedWords.push(shaped.join(''));
    } else {
      shapedWords.push(token);
    }
  }

  const combinedShaped = shapedWords.join('');
  // In RTL spline march, reverse the characters so that the natural reading order
  // progresses from right to left along the visible curve!
  const glyphs = Array.from(combinedShaped).reverse();

  return {
    glyphs,
    isRtl: true,
  };
}
