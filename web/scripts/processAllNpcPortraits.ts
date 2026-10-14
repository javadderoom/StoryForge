import dotenv from 'dotenv';
dotenv.config();
process.env.ENABLE_DB = 'true';

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { put } from '@vercel/blob';
import { getPrisma } from '../src/lib/db/client';

export interface NpcImageJob {
  npcId: string;
  sourceFile: string;
}

export async function processNpcImages(jobs: NpcImageJob[]) {
  const localDir = path.resolve(process.cwd(), 'public/images/npcs');
  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }

  const prisma = getPrisma();
  const story = prisma
    ? await prisma.story.findUnique({ where: { id: 'story_mt4ofllt' } })
    : null;
  const manifest = story ? (story.manifest as any) : null;
  const wb = manifest?.worldBible || {};
  const npcs = wb.npcs || [];

  for (const job of jobs) {
    const inputPath = path.resolve(job.sourceFile);
    if (!fs.existsSync(inputPath)) {
      console.warn(`⚠️ Source file not found: ${inputPath} for ${job.npcId}`);
      continue;
    }

    console.log(`\n🖼️ Processing portrait for ${job.npcId}...`);

    // 1. Resize & WebP compression (480x640 at 80% quality, effort 6)
    const optimizedBuffer = await sharp(inputPath)
      .resize(480, 640, { fit: 'cover', position: 'top' })
      .webp({ quality: 80, effort: 6 })
      .toBuffer();

    const sizeKb = (optimizedBuffer.length / 1024).toFixed(1);
    console.log(`  ✅ Compressed: ${sizeKb} KB`);

    let finalUrl = '';

    // 2. Upload to Vercel Blob if token available
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blobName = `npcs/${job.npcId}_${Date.now()}.webp`;
      const blob = await put(blobName, optimizedBuffer, {
        access: 'public',
        contentType: 'image/webp',
      });
      finalUrl = blob.url;
      console.log(`  ☁️ Uploaded to Vercel Blob: ${finalUrl}`);
    } else {
      // Local public directory fallback
      const localFileName = `${job.npcId}.webp`;
      const localFilePath = path.join(localDir, localFileName);
      fs.writeFileSync(localFilePath, optimizedBuffer);
      finalUrl = `/images/npcs/${localFileName}`;
      console.log(`  💾 Saved locally to: ${localFilePath}`);
      console.log(`  🔗 Local URL: ${finalUrl}`);
    }

    // 3. Update story manifest & WorldBible record
    const targetNpc = npcs.find((n: any) => n.id === job.npcId);
    if (targetNpc) {
      targetNpc.imageUrl = finalUrl;
      console.log(`  📝 Assigned imageUrl to ${targetNpc.name}`);
    } else {
      console.warn(`  ⚠️ NPC with ID ${job.npcId} not found in story manifest`);
    }
  }

  // Save changes to database
  if (prisma && story && manifest) {
    await prisma.story.update({
      where: { id: 'story_mt4ofllt' },
      data: { manifest },
    });
    console.log('\n✅ Story manifest updated successfully.');

    if (story.worldId) {
      const worldWb = await prisma.worldBible.findUnique({
        where: { worldId: story.worldId },
      });
      if (worldWb) {
        await prisma.worldBible.update({
          where: { id: worldWb.id },
          data: { npcs: npcs as any },
        });
        console.log('✅ WorldBible database record synced.');
      }
    }
  }

  console.log('\n🎉 All NPC portraits processed and linked!');
}

// Auto-run if executed directly via CLI
if (process.argv[1]?.includes('processAllNpcPortraits')) {
  const artifactDir = path.resolve('C:/Users/Javad/.gemini/antigravity/brain/e444a3e6-155d-4dd2-b64a-c7e7570e181b');
  console.log(`Scanning artifact dir: ${artifactDir}`);

  // Find latest files matching pattern
  const files = fs.existsSync(artifactDir) ? fs.readdirSync(artifactDir) : [];

  const findLatest = (prefix: string) => {
    const matches = files
      .filter((f) => f.startsWith(prefix) && (f.endsWith('.jpg') || f.endsWith('.png') || f.endsWith('.webp')))
      .map((f) => ({
        name: f,
        time: fs.statSync(path.join(artifactDir, f)).mtimeMs,
      }))
      .sort((a, b) => b.time - a.time);
    return matches.length > 0 ? path.join(artifactDir, matches[0].name) : null;
  };

  const npcMapping: { npcId: string; prefix: string }[] = [
    { npcId: 'npc_borzou', prefix: 'borzou_sangtarash_portrait' },
    { npcId: 'npc_bahram', prefix: 'bahram_dashban_portrait' },
    { npcId: 'npc_maziar', prefix: 'maziar_mashkdar_portrait' },
    { npcId: 'npc_farrokhzad', prefix: 'farrokhzad_namakchin_portrait' },
    { npcId: 'npc_sohrab', prefix: 'sohrab_choobdast_portrait' },
    { npcId: 'npc_parviz', prefix: 'parviz_kateb_portrait' },
    { npcId: 'npc_farangis', prefix: 'farangis_pardehneshin_portrait' },
  ];

  const jobs: NpcImageJob[] = [];
  for (const item of npcMapping) {
    const found = findLatest(item.prefix);
    if (found) {
      jobs.push({ npcId: item.npcId, sourceFile: found });
    } else {
      console.log(`⏳ Waiting for ${item.npcId} (${item.prefix})...`);
    }
  }

  if (jobs.length > 0) {
    processNpcImages(jobs)
      .then(() => process.exit(0))
      .catch((err) => {
        console.error('Error processing NPC portraits:', err);
        process.exit(1);
      });
  } else {
    console.log('No portraits found to process yet.');
    process.exit(0);
  }
}
