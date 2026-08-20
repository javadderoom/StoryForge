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
          targetDC: typeof c.targetDC === 'number' ? c.targetDC : (typeof c.target_dc === 'number' ? c.target_dc : (c.riskLevel === 'high' ? 14 : c.riskLevel === 'low' ? 10 : 12)),
          requiredStatId: c.requiredStatId || c.required_stat_id || c.statId || c.stat_id,
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
            targetDC: 10,
            requiredStatId: 'agility',
          },
          {
            id: 'choice_en_2',
            text: 'Carefully slip your brass lockpick into the tumblers of the ironwood door.',
            style: 'tactical',
            riskLevel: 'medium',
            targetDC: 12,
            requiredStatId: 'cunning',
          },
          {
            id: 'choice_en_3',
            text: 'Draw your notched boot blade and prepare to ambush whoever breaches the threshold.',
            style: 'aggressive',
            riskLevel: 'high',
            targetDC: 14,
            requiredStatId: 'might',
          },
        ],
        extractedMemories: [
          {
            category: 'character',
            importance: 6,
            summary: 'Heard heavy armored footsteps halting outside dungeon door',
          },
        ],
      };
    }

    return {
      narrative:
        'سرمای سنگ‌های بازالتی دژ به استخوانت می‌رسد؛ نوری لرزان از زیر درگاه چوبی کهن به داخل می‌تابد. از پشت در، صدای چرخش کلید در قفل به گوش می‌رسد و سایه‌ای سنگین پشت میله‌های پنجره کوچک بالایی پدیدار می‌شود.',
      choices: [
        {
          id: 'choice_fa_1',
          text: 'نَفَسَت را در سینه حبس کن و در فرورفتگی تاریک دیوار سنگی پناه بگیر.',
          style: 'defensive',
          riskLevel: 'low',
          targetDC: 10,
          requiredStatId: 'agility',
        },
        {
          id: 'choice_fa_2',
          text: 'به آرامی میله قفل‌گشایی را داخل مکانیزم در چوبی بلغزان.',
          style: 'tactical',
          riskLevel: 'medium',
          targetDC: 12,
          requiredStatId: 'cunning',
        },
        {
          id: 'choice_fa_3',
          text: 'خنجر چکمه‌ات را بیرون بکش و برای شبیخون در آستانه درگاه آماده شو.',
          style: 'aggressive',
          riskLevel: 'high',
          targetDC: 14,
          requiredStatId: 'might',
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
