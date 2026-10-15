process.env.ENABLE_DB = 'true';
import { getPrisma } from '../src/lib/db/client';

async function main() {
  const p = getPrisma()!;
  const story = await p.story.findUnique({ where: { id: 'story_mt4ofllt' } });
  if (!story || !story.manifest) {
    console.log('Story not found');
    return;
  }
  const manifest = story.manifest as any;
  if (manifest.saga?.chapters) {
    for (const ch of manifest.saga.chapters) {
      if (ch.scopeTier === 'wilderness') {
        ch.scopeTier = 'regional';
        console.log(`Updated chapter ${ch.id} scopeTier from wilderness to regional`);
      }
    }
  }
  await p.story.update({
    where: { id: 'story_mt4ofllt' },
    data: { manifest: manifest as any },
  });
  console.log('Story manifest updated in DB successfully.');
}
main().catch(console.error);
