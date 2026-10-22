/**
 * Streaming JSON Narrative Extractor
 *
 * Incrementally parses a streaming JSON completion and extracts the `narrative`
 * string token-by-token in real time, emitting clean deltas for SSE transmission.
 * Buffers the full raw stream so the complete structured JSON object
 * (memories, condition changes, trust deltas) can be parsed upon completion.
 */

export class StreamingJsonNarrativeExtractor {
  private fullRaw = '';
  private buffer = '';
  private inNarrative = false;
  private narrativeClosed = false;
  private escaped = false;
  private narrativeText = '';

  /**
   * Ingests a new incoming token chunk from the LLM stream.
   * Calls `onDelta` synchronously with any newly decoded narrative characters.
   */
  public pushChunk(rawChunk: string, onDelta: (delta: string) => void): void {
    if (!rawChunk) return;
    this.fullRaw += rawChunk;

    if (!this.inNarrative && !this.narrativeClosed) {
      this.buffer += rawChunk;
      // Look for the opening of the "narrative" string property
      const match = this.buffer.match(/"narrative"\s*:\s*"/);
      if (match && match.index !== undefined) {
        this.inNarrative = true;
        const startIndex = match.index + match[0].length;
        const tail = this.buffer.slice(startIndex);
        this.buffer = ''; // cleared once matched
        this.processNarrativeChars(tail, onDelta);
      }
    } else if (this.inNarrative) {
      this.processNarrativeChars(rawChunk, onDelta);
    }
  }

  private processNarrativeChars(chars: string, onDelta: (delta: string) => void): void {
    let delta = '';
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      if (this.escaped) {
        if (c === 'n') delta += '\n';
        else if (c === 't') delta += '\t';
        else if (c === 'r') delta += '\r';
        else if (c === '"') delta += '"';
        else if (c === '\\') delta += '\\';
        else if (c === '/') delta += '/';
        else delta += '\\' + c;
        this.escaped = false;
      } else if (c === '\\') {
        this.escaped = true;
      } else if (c === '"') {
        // Unescaped closing quote ends the narrative field
        this.inNarrative = false;
        this.narrativeClosed = true;
        break;
      } else {
        delta += c;
      }
    }
    if (delta.length > 0) {
      this.narrativeText += delta;
      onDelta(delta);
    }
  }

  /** Whether the "narrative" string has completely closed. */
  public isNarrativeComplete(): boolean {
    return this.narrativeClosed;
  }

  /** The cumulative narrative text decoded so far. */
  public getNarrativeText(): string {
    return this.narrativeText;
  }

  /** The full accumulated raw string from the LLM stream. */
  public getFullRawText(): string {
    return this.fullRaw;
  }
}
