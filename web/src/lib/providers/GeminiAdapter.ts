import { GoogleGenAI } from '@google/genai';
import { GenerationPromptPayload } from '../engines/narrative/PromptAssembler';
import { ChoiceOption } from '../types/gameplay';
import { MemoryCategory } from '../types/memory';

export interface GeneratedSceneResponse {
  narrative: string;
  choices: ChoiceOption[];
  extractedMemories: Array<{
    category: MemoryCategory;
    importance: number;
    summary: string;
  }>;
}

export class GeminiAdapter {
  private client: GoogleGenAI | null = null;
  private modelName: string;

  constructor(apiKey?: string, modelName = 'gemini-3.7-flash') {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (key) {
      this.client = new GoogleGenAI({ apiKey: key });
    }
    this.modelName = modelName;
  }

  /**
   * Generates a complete structured narrative scene and choices.
   */
  public async generateScene(prompt: GenerationPromptPayload): Promise<GeneratedSceneResponse> {
    if (!this.client) {
      // Fallback mock response for local testing without API key
      return this.generateMockScene(prompt);
    }

    try {
      const response = await this.client.models.generateContent({
        model: this.modelName,
        contents: [
          { role: 'system', parts: [{ text: prompt.systemPrompt }] },
          { role: 'user', parts: [{ text: prompt.userPrompt }] },
        ],
        config: {
          responseMimeType: 'application/json',
          temperature: 0.75,
        },
      });

      const text = response.text || '{}';
      const parsed = JSON.parse(text);

      return {
        narrative: parsed.narrative || 'The scene unfolds quietly before you.',
        choices: (parsed.choices || []).map((c: any, index: number) => ({
          id: c.id || `choice_${index + 1}`,
          text: c.text || 'Continue forward.',
          style: c.style || 'tactical',
          riskLevel: c.riskLevel || 'medium',
        })),
        extractedMemories: parsed.extractedMemories || [],
      };
    } catch (error) {
      console.error('Gemini API generation error:', error);
      // Return safe graceful fallback
      return this.generateMockScene(prompt);
    }
  }

  /**
   * Mock fallback generator used when no GEMINI_API_KEY is configured.
   */
  private generateMockScene(prompt: GenerationPromptPayload): GeneratedSceneResponse {
    return {
      narrative:
        'The cold stone walls hum with a faint vibration as the torchlight gutters in a sudden draft. Every breath leaves a pale cloud in the subterranean chill. You can hear the steady rhythmic pacing of the sentry beyond the threshold, his iron boots scraping against the gravel floor.',
      choices: [
        {
          id: 'choice_1',
          text: 'Hold your breath and press against the shadowy stone alcove.',
          style: 'defensive',
          riskLevel: 'low',
        },
        {
          id: 'choice_2',
          text: 'Quietly slip the iron lockpick into the cell door mechanism.',
          style: 'agile',
          riskLevel: 'medium',
        },
        {
          id: 'choice_3',
          text: 'Kick the heavy wooden door open and charge the guard.',
          style: 'aggressive',
          riskLevel: 'high',
        },
      ],
      extractedMemories: [
        {
          category: 'player',
          importance: 6,
          summary: 'Player navigated the subterranean cell block.',
        },
      ],
    };
  }
}
