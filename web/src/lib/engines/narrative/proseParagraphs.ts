/**
 * Deterministic paragraph normalisation for generated scene prose.
 *
 * The narrator is instructed to return 3-5 short paragraph blocks, but models
 * routinely return one unbroken block. The renderer (`splitParagraphs`) only
 * breaks on newlines, so a single block is rendered as a single wall of text —
 * one 70-word panel instead of three readable beats.
 *
 * This repairs that without another model call:
 *  - Prose that already contains line breaks is only re-normalised, never re-split.
 *  - Prose below `minWords` is left alone; short turns are meant to be one beat.
 *  - Splits happen only at sentence ends OUTSIDE quotes, so dialogue stays whole.
 *  - Output is 2-4 balanced blocks.
 */

const SENTENCE_TERMINATORS = new Set(['.', '!', '?', '…', '؟', '۔']);
// Closing glyphs only. Opening quotes are deliberately excluded so that a
// quotation mark following a full stop is not swallowed into the previous
// sentence — that would leave the scanner's quote state unbalanced.
const TRAILING_GLYPHS = new Set(['»', '”', '’', "'", ')', ']', ' ']);

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Splits prose into sentences, treating terminators inside quotation marks as
 * intra-quote punctuation rather than block boundaries.
 */
function splitSentences(text: string): string[] {
  const out: string[] = [];
  let buffer = '';
  let inDoubleQuote = false;
  let inGuillemet = false;
  let inCurlyQuote = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    buffer += char;

    if (char === '"') inDoubleQuote = !inDoubleQuote;
    else if (char === '«') inGuillemet = true;
    else if (char === '»') inGuillemet = false;
    else if (char === '“') inCurlyQuote = true;
    else if (char === '”') inCurlyQuote = false;

    if (!SENTENCE_TERMINATORS.has(char)) continue;
    if (inDoubleQuote || inGuillemet || inCurlyQuote) continue;

    // Absorb closing punctuation and trailing whitespace into the sentence.
    let j = i + 1;
    while (j < text.length && TRAILING_GLYPHS.has(text[j])) {
      buffer += text[j];
      j++;
    }
    i = j - 1;

    const sentence = buffer.trim();
    if (sentence) out.push(sentence);
    buffer = '';
  }

  const tail = buffer.trim();
  if (tail) out.push(tail);
  return out;
}

/** Groups sentences into `blockCount` blocks of roughly `targetWords` each. */
function groupSentences(sentences: string[], blockCount: number, targetWords: number): string[] {
  if (sentences.length < blockCount) return [sentences.join(' ')];

  const cuts: number[] = [];
  let accumulated = 0;
  let block = 1;

  for (let i = 0; i < sentences.length - 1; i++) {
    accumulated += countWords(sentences[i]);
    const sentencesRemaining = sentences.length - 1 - i;
    const blocksRemaining = blockCount - block;
    if (blocksRemaining > 0 && accumulated >= targetWords * block && sentencesRemaining >= blocksRemaining) {
      cuts.push(i);
      block++;
    }
  }

  if (cuts.length === 0) return [sentences.join(' ')];

  const blocks: string[] = [];
  let start = 0;
  for (const cut of cuts) {
    blocks.push(sentences.slice(start, cut + 1).join(' '));
    start = cut + 1;
  }
  blocks.push(sentences.slice(start).join(' '));

  // A trailing block of one or two words reads as a stray line, not a paragraph.
  if (blocks.length > 1 && countWords(blocks[blocks.length - 1]) < 3) {
    blocks[blocks.length - 2] = `${blocks[blocks.length - 2]} ${blocks.pop()}`;
  }

  return blocks;
}

export interface NormalizeParagraphsOptions {
  /** Below this word count the prose is left as a single block. Default 55. */
  minWords?: number;
  /** Target words per block used to decide how many blocks to produce. Default 45. */
  wordsPerBlock?: number;
  /** Upper bound on blocks. Default 4. */
  maxBlocks?: number;
}

/**
 * Returns prose with `\n\n` block separators, repairing a single-block blob when
 * it is long enough to deserve structure.
 */
export function normalizeParagraphs(text: string, opts: NormalizeParagraphsOptions = {}): string {
  const raw = (text ?? '').trim();
  if (!raw) return raw;

  // Existing structure wins: only canonicalise the separators.
  if (raw.includes('\n')) {
    return raw.replace(/[ \t]*\n\s*/g, '\n\n').replace(/\n{3,}/g, '\n\n');
  }

  const minWords = opts.minWords ?? 55;
  const wordsPerBlock = Math.max(20, opts.wordsPerBlock ?? 45);
  const maxBlocks = Math.max(2, opts.maxBlocks ?? 4);

  const words = countWords(raw);
  if (words < minWords) return raw;

  const sentences = splitSentences(raw);
  if (sentences.length < 3) return raw;

  const blockCount = Math.min(maxBlocks, Math.max(2, Math.round(words / wordsPerBlock)));
  const blocks = groupSentences(sentences, blockCount, words / blockCount);
  return blocks.join('\n\n');
}
