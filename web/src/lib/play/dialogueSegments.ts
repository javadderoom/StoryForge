export interface ProseSegment {
  type: 'narrative' | 'dialogue';
  text: string;
}

const QUOTE_PAIRS: Array<[string, string]> = [
  ['«', '»'],
  ['"', '"'],
  ['“', '”'],
];

const OPENERS = new Map<string, string>(QUOTE_PAIRS);

/** Lines starting with one of these dashes read as spoken dialogue. */
const DASH_LINE = /^\s*(—|–|-)\s+/;

/**
 * Splits scene prose into narrative vs dialogue segments.
 * Dialogue = text inside quotation marks («», "", "", “”) or dash-led lines.
 * An unterminated opening quote styles the trailing text as dialogue.
 * Adjacent same-type segments are merged.
 */
export function segmentProse(input: string): ProseSegment[] {
  const out: ProseSegment[] = [];
  const push = (type: ProseSegment['type'], text: string) => {
    if (!text || !text.trim()) return;
    const last = out[out.length - 1];
    if (last && last.type === type) {
      last.text += '\n' + text;
    } else {
      out.push({ type, text });
    }
  };

  const lines = (input || '').split('\n');
  for (const line of lines) {
    if (DASH_LINE.test(line)) {
      push('dialogue', line.replace(DASH_LINE, '').trim());
      continue;
    }
    let i = 0;
    let buf = '';
    while (i < line.length) {
      const ch = line[i];
      const closer = OPENERS.get(ch);
      if (closer) {
        const end = line.indexOf(closer, i + 1);
        if (buf) {
          push('narrative', buf);
          buf = '';
        }
        if (end === -1) {
          push('dialogue', line.slice(i + 1).trim());
          i = line.length;
        } else {
          push('dialogue', line.slice(i + 1, end).trim());
          i = end + 1;
        }
      } else {
        buf += ch;
        i += 1;
      }
    }
    if (buf) push('narrative', buf);
  }
  return out.map((s) => ({ ...s, text: s.text.trim() })).filter((s) => s.text.length > 0);
}
