process.env.ENABLE_DB = 'true';
import { getPrisma } from '../src/lib/db/client';

async function main() {
  const p = getPrisma()!;
  const s = await p.story.findUnique({ where: { id: 'story_mt4ofllt' } });
  if (!s || !s.manifest) {
    console.error('Story not found');
    return;
  }

  const manifest = s.manifest as any;
  const initialBeats = manifest.initialStoryBeats || [];
  const beat = initialBeats.find((b: any) => b.sceneId === 'scene_hiram_trail_01') || initialBeats[0];

  if (!beat) {
    console.error('Opening beat not found');
    return;
  }

  console.log('Current beat sceneId:', beat.sceneId);
  console.log('Current choices:', beat.choices);

  beat.choices = [
    {
      id: 'choice_scene1_borzou',
      text: 'پیوستن به برزو سنگ‌تراش در پیشانی کاروان و پرس‌وجو دربارهٔ زمان رسیدن به رباط سرخ و خطرات دره',
      style: 'inquisitive',
      riskLevel: 'low',
    },
    {
      id: 'choice_scene1_bahram',
      text: 'همراهی با بهرام دشت‌بان و وارسی نحوهٔ گام برداشتن شتران و ردِ سم جانوران در خاک بیابان',
      style: 'tactical',
      riskLevel: 'low',
      requiredStatId: 'cunning',
      targetDC: 9,
    },
    {
      id: 'choice_scene1_maziar',
      text: 'گرفتن جرعه‌ای آب از مازیار مشک‌دار و استعلام وضعیت ذخایر آب کاروان پیش از برآمدن آفتاب',
      style: 'diplomatic',
      riskLevel: 'low',
    },
    {
      id: 'choice_scene1_scout',
      text: 'برکشیدن دستار، رصد ستیغ تپه‌ها و هوشیاری در برابر هرگونه سایه یا تحرک مشکوک در افق بادیه',
      style: 'cautious',
      riskLevel: 'low',
      requiredStatId: 'agility',
      targetDC: 10,
    },
  ];

  await p.story.update({
    where: { id: 'story_mt4ofllt' },
    data: { manifest },
  });

  console.log('Successfully seeded 4 canonical choices on scene_hiram_trail_01!');
}

main().catch(console.error);
