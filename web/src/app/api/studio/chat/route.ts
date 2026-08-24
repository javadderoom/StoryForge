import { NextRequest, NextResponse } from 'next/server';
import { generateChat } from '@/lib/ai/geminiClient';
import {
  buildAdviserSystemPrompt,
  type PersonaId,
} from '@/lib/engines/world/ActionProtocol';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const PERSONA_IDS: PersonaId[] = [
  'oracle',
  'inquisitor',
  'weaver',
  'cosmologist',
  'stylist',
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages: ChatMessage[] = Array.isArray(body.messages) ? body.messages : [];
    const worldContext: string = typeof body.worldContext === 'string' ? body.worldContext : '';
    const isPersian: boolean = !!body.isPersian;
    const customSystemPrompt: string =
      typeof body.customSystemPrompt === 'string' ? body.customSystemPrompt : '';
    const personaRaw: string = typeof body.persona === 'string' ? body.persona : 'oracle';
    const persona: PersonaId = (PERSONA_IDS as string[]).includes(personaRaw)
      ? (personaRaw as PersonaId)
      : 'oracle';
    const activeEntityContext: string =
      typeof body.activeEntityContext === 'string' ? body.activeEntityContext : '';

    if (!messages.length) {
      return NextResponse.json(
        { success: false, error: isPersian ? 'پیامی ارسال نشده است' : 'No messages provided' },
        { status: 400 }
      );
    }

    const systemInstruction =
      customSystemPrompt?.trim() ||
      buildAdviserSystemPrompt(persona, isPersian, {
        worldContext,
        activeEntityContext,
      });

    const result = await generateChat(messages, systemInstruction, {
      temperature: 0.85,
      taskType: 'default',
    });

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: isPersian
            ? 'اتصال به مدل هوش مصنوعی برقرار نشد (کلید یا سهمیه را بررسی کن).'
            : 'AI model unavailable (check API key / quota).',
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      reply: result.data,
      modelUsed: result.modelUsed,
      persona,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Chat failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
