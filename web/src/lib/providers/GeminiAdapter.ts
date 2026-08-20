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

  constructor(apiKey?: string, modelName = 'gemini-2.5-flash') {
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

      const defaultNarrative = prompt.isEnglish
        ? 'The scene shifts as the consequences of your choice unfold before you...'
        : 'صحنه به آرامی در برابرت ورق می‌خورد...';

      const defaultChoiceText = prompt.isEnglish ? 'Proceed forward...' : 'ادامه مسیر...';

      return {
        narrative: parsed.narrative || defaultNarrative,
        choices: (parsed.choices || []).map((c: any, index: number) => ({
          id: c.id || `choice_${index + 1}`,
          text: c.text || defaultChoiceText,
          style: c.style || 'tactical',
          riskLevel: c.riskLevel || 'medium',
        })),
        extractedMemories: parsed.extractedMemories || [],
      };
    } catch (error) {
      console.error('Gemini API generation error:', error);
      return this.generateMockScene(prompt);
    }
  }

  /**
   * Mock fallback generator adapted to the requested language.
   */
  private generateMockScene(prompt: GenerationPromptPayload): GeneratedSceneResponse {
    if (prompt.isEnglish) {
      return {
        narrative:
          'The ancient volcanic masonry hums with cold resonance as the torchlight flickers violently in the sudden draft. Every breath sends a plume of grey frost into the gloom of the dungeon. Across the flagstone corridor, the rhythmic cadence of armored greaves halts abruptly outside the heavy ironwood door.',
        choices: [
          {
            id: 'choice_en_1',
            text: 'Hold your breath and press your spine deep into the shadow of the basalt alcove.',
            style: 'defensive',
            riskLevel: 'low',
          },
          {
            id: 'choice_en_2',
            text: 'Carefully slip your brass lockpick into the tumblers of the ironwood door.',
            style: 'agile',
            riskLevel: 'medium',
          },
          {
            id: 'choice_en_3',
            text: 'Draw your notched boot blade and prepare to ambush whoever breaches the threshold.',
            style: 'aggressive',
            riskLevel: 'high',
          },
        ],
        extractedMemories: [
          {
            category: 'player',
            importance: 6,
            summary: 'Player surveilled the lower dungeon corridor unseen.',
          },
        ],
      };
    }

    return {
      narrative:
        'دیوارهای سنگی کهن با لرزشی خفیف در تاریکی سوسو می‌زنند و شعله مشعل‌ها در گذر ناگهانی باد می‌رقصد. هر بازدم، ابری از بخار سرد در سیاه‌چال پدید می‌آورد. صدای منظم گام‌های نگهبان از پشت درگاه چوبی به گوش می‌رسد؛ چکمه‌های آهنی‌اش روی سنگ‌ریزه‌ها کشیده می‌شوند.',
      choices: [
        {
          id: 'choice_fa_1',
          text: 'نفست را در سینه حبس کن و در فرورفتگی تاریک دیوار سنگی پناه بگیر.',
          style: 'defensive',
          riskLevel: 'low',
        },
        {
          id: 'choice_fa_2',
          text: 'به آرامی میله قفل‌گشایی را داخل مکانیزم در چوبی بلغزان.',
          style: 'agile',
          riskLevel: 'medium',
        },
        {
          id: 'choice_fa_3',
          text: 'خنجر چکمه‌ات را بیرون بکش و برای شبیخون در آستانه درگاه آماده شو.',
          style: 'aggressive',
          riskLevel: 'high',
        },
      ],
      extractedMemories: [
        {
          category: 'player',
          importance: 6,
          summary: 'بازیکن مسیر راهروی سیاه‌چال را مخفیانه زیر نظر گرفت.',
        },
      ],
    };
  }
}
