export type SubQQuestionType = 'noul' | 'choice' | 'score';

export interface SubQQuestion {
  type: SubQQuestionType;
  instructions: string;
  criteria?: Record<string, string | null> | string[];
}

export interface SubQDecisionRequest {
  model?: string;
  state: string | Record<string, any> | any[];
  questions: Record<string, SubQQuestion>;
}

export interface SubQAnswer {
  noul?: boolean | { answer?: boolean; probability?: number; [key: string]: any };
  choice?: string;
  score?: number;
  [key: string]: any;
}

export interface SubQDecisionResponse {
  success: boolean;
  answers: Record<string, SubQAnswer>;
  model: string;
  error?: string;
  latencyMs?: number;
}

/**
 * SubQ Decisions API Adapter for Subquadratic's multimodal decision models.
 * Uses `subq-snap-preview` by default over the Decisions endpoint (POST /v1/systemone).
 *
 * Designed for ultra-fast, long-context (up to 384K) structured judgments (noul/choice/score).
 */
export class SubQAdapter {
  private apiKey?: string;
  private endpoint: string;
  private defaultModel: string;

  constructor(
    apiKey = process.env.SUBQ_API_KEY,
    endpoint = process.env.SUBQ_API_ENDPOINT || 'https://api.subq.ai/v1/systemone',
    defaultModel = 'subq-snap-preview'
  ) {
    this.apiKey = apiKey;
    this.endpoint = endpoint;
    this.defaultModel = defaultModel;
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  public async evaluate(
    request: SubQDecisionRequest,
    options?: { timeoutMs?: number; signal?: AbortSignal }
  ): Promise<SubQDecisionResponse> {
    const startTime = Date.now();
    const model = request.model || this.defaultModel;

    if (!this.isConfigured()) {
      return {
        success: false,
        answers: {},
        model,
        error: 'SubQ API key is not configured (missing SUBQ_API_KEY environment variable).',
        latencyMs: 0,
      };
    }

    const timeoutMs = options?.timeoutMs ?? 10000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const mergedSignal = options?.signal || controller.signal;

    try {
      const payload = {
        model,
        state: request.state,
        questions: request.questions,
      };

      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: mergedSignal,
      });

      clearTimeout(timeoutId);

      const latencyMs = Date.now() - startTime;

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        return {
          success: false,
          answers: {},
          model,
          error: `SubQ API responded with HTTP ${res.status}: ${errText.slice(0, 300)}`,
          latencyMs,
        };
      }

      const json = await res.json();
      const rawAnswers = (json?.answers && typeof json.answers === 'object') ? json.answers : {};

      const answers: Record<string, SubQAnswer> = {};
      for (const [key, rawVal] of Object.entries(rawAnswers)) {
        answers[key] = (typeof rawVal === 'object' && rawVal !== null) ? rawVal : { value: rawVal };
      }

      return {
        success: true,
        answers,
        model: json?.model || model,
        latencyMs,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;
      const isAbort = err?.name === 'AbortError' || mergedSignal?.aborted;
      return {
        success: false,
        answers: {},
        model,
        error: isAbort ? `SubQ request timed out after ${timeoutMs}ms.` : (err?.message || 'Unknown network error'),
        latencyMs,
      };
    }
  }
}
