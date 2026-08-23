import { NextRequest, NextResponse } from 'next/server';
import { generateChat } from '@/lib/ai/geminiClient';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const ALLOWED_ENTITIES = [
  'faction',
  'location',
  'npc',
  'artifact',
  'creature',
  'deity',
  'timeline_event',
  'world_law',
] as const;

const ENTITY_ENUM = ALLOWED_ENTITIES.join(' | ');

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages: ChatMessage[] = Array.isArray(body.messages) ? body.messages : [];
    const worldContext: string = typeof body.worldContext === 'string' ? body.worldContext : '';
    const isPersian: boolean = !!body.isPersian;
    const customSystemPrompt: string =
      typeof body.customSystemPrompt === 'string' ? body.customSystemPrompt : '';

    if (!messages.length) {
      return NextResponse.json(
        { success: false, error: isPersian ? 'پیامی ارسال نشده است' : 'No messages provided' },
        { status: 400 }
      );
    }

    const base = isPersian
      ? [
          'تو «مشاور جهان‌سازی» استوری‌فورج هستی؛ همراهی خلاق، مشاور ریشه‌دار و منتقد دلسوز برای نویسنده این جهان داستانی تعاملی.',
          'به پرورش ایده، نقد، پاسخ به پرسش‌ها، شناسایی خلأها و ناسازگاری‌ها، و پیشنهاد موجودیت‌های تازه کمک می‌کنی.',
          'پاسخ‌ها را کوتاه، ادبی و کاربردی بنویس. لحن با فضای جهان هم‌راستا باشد.',
          'وقتی نویسنده از تو می‌خواهد موجودیتی موجود را بخوانی، خلاصه کنی یا فهرست کنی، فقط از بخش «کتاب مقدس جهان» در بالا نقل کن. توصیف‌هایی که پیش‌تر در این گفت‌وگو تولید کرده‌ای را واقعیتِ ذخیره‌شده تلقی نکن — آن‌ها پیش‌نویس بوده‌اند. اگر موجودیت درخواستی در کتاب مقدس نیست، صراحتاً بگو که در جهان ذخیره نشده است.',
          'هرگاه نویسنده صراحتاً از تو بخواهد چیزی را به جهان بیفزایی، تغییر دهی یا حذف کنی، دقیقاً یک بلوک دستور ساختاریافته صادر کن (نگاه کن به پروتکل عملیات). در غیر این صورت فقط گفت‌وگو کن و هیچ بلوکی صادر نکن.',
        ]
      : [
          'You are the World-Building Oracle for StoryForge — a creative partner, deep lore consultant, and candid critic to the author of this interactive-fiction world.',
          'You help brainstorm, critique, answer questions about the world, surface gaps and inconsistencies, and propose new entities.',
          'Be concise, literary, and useful. Match the tone of the world.',
          'When the author asks you to READ, summarize, or list an existing entity, quote ONLY from the WORLD BIBLE section above. Do NOT treat descriptions you generated earlier in this chat as saved facts — those were drafts and may not match what is stored. If the requested entity is not present in the WORLD BIBLE, say so plainly.',
          'When the author explicitly asks you to add, change, or remove something in the world, emit EXACTLY ONE structured action block (see protocol). Otherwise just converse and emit no blocks.',
        ];

    const worldSection = worldContext
      ? `\n\nWORLD BIBLE (existing lore — use it for accurate, consistent answers and never contradict it):\n${worldContext}`
      : '';

    const actionSection = isPersian
      ? `\n\nپروتکل عملیات — برای ایجاد، ویرایش یا حذف یک موجودیت جهان، بلوک کد زیر را دقیقاً یک‌بار و بدون متن اضافه صادر کن. فقط زمانی صادر کن که نویسنده صراحتاً درخواست کرده باشد.
قالب ایجاد (create):
\`\`\`storyforge-action
{"op":"create","entity":"faction","prompt":"<دستور خلاقانه برای موجودیت تازه>"}
\`\`\`
قالب ویرایش (update):
\`\`\`storyforge-action
{"op":"update","entity":"deity","match":{"byName":"<نام موجودیت موجود>"},"prompt":"<شرح دقیق و کامل تغییرات درخواستی کاربر، شامل متن کامل اصول، ویژگی‌ها یا فیلدهایی که باید جایگزین یا ویرایش شوند>"}
\`\`\`
قالب حذف (delete):
\`\`\`storyforge-action
{"op":"delete","entity":"faction","match":{"byName":"<نام موجودیت موجود>"}}
\`\`\`
عملیات مجاز: "create"، "update"، "delete". موجودیت‌های مجاز: ${ENTITY_ENUM}. باید همواره فیلد «entity» را ذکر کنی. برای update/delete فیلد "match":{"byName":"<نام موجودیت موجود>"} الزامی است. برای update فیلد "prompt" نیز کاملاً الزامی است و باید تمام جزئیات و متن درخواستی کاربر را کلمه به کلمه شامل شود تا دقیقاً روی موجودیت اعمال شود. برای create می‌توانی اختیاری "anchor":"<نام موجودیت موجود>" بگذاری تا موجودیت جدید به آن گره بخورد. هرگز عملیاتی صادر نکن که درخواست نشده باشد. نکته: خدایان، ایزدان، ادیان، پانتئون‌ها و فرقه‌ها همگی موجودیت «deity» هستند. اگر نویسنده چیزی را که از پیش دارد می‌خواهد تغییر دهد، حتماً از op "update" با match.byName و prompt کامل استفاده کن و هرگز نسخه تکراری نساز.`
      : `\n\nACTION PROTOCOL — To create, modify, or delete a world entity, emit EXACTLY ONE fenced code block with no extra prose. Only emit it when the author explicitly requests it.
Create format:
\`\`\`storyforge-action
{"op":"create","entity":"faction","prompt":"<creative brief for the new entity>"}
\`\`\`
Update format:
\`\`\`storyforge-action
{"op":"update","entity":"deity","match":{"byName":"<existing entity name>"},"prompt":"<exact and full description of the changes requested, including all replacement text, tenets, or modified fields>"}
\`\`\`
Delete format:
\`\`\`storyforge-action
{"op":"delete","entity":"faction","match":{"byName":"<existing entity name>"}}
\`\`\`
Ops: "create", "update", "delete". Entities: ${ENTITY_ENUM}. You MUST include the "entity" field in every action. For update/delete add "match":{"byName":"<existing entity name>"}. For update, the "prompt" field is also MANDATORY and MUST contain the complete details and text of what to change or replace. For create you may optionally add "anchor":"<existing entity name>" to tie it to existing lore. Never emit actions you were not asked for. Note: gods, deities, religions, pantheons, and cults are all the 'deity' entity. To change something the author already has, use op 'update' with match.byName and full prompt — never create a duplicate.`;

    const langLine = isPersian ? '\nپاسخ را به فارسی روان و ادبی بنویس.' : '';

    const systemInstruction = (customSystemPrompt?.trim() || base.join('\n')) + worldSection + actionSection + langLine;

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
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Chat failed' },
      { status: 500 }
    );
  }
}
