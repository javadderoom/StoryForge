import dotenv from 'dotenv';
dotenv.config();
process.env.ENABLE_DB = 'true';

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { put } from '@vercel/blob';
import { getPrisma } from '../src/lib/db/client';

async function main() {
  const args = process.argv.slice(2);
  const npcIdArg = args.find((a) => a.startsWith('--npc='))?.split('=')[1] || 'npc_borzou';
  const fileArg = args.find((a) => a.startsWith('--file='))?.split('=')[1] || 'public/images/npcs/borzou.jpg';

  const inputPath = path.resolve(process.cwd(), fileArg);
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found at: ${inputPath}`);
  }

  console.log(`🖼️ Processing image for NPC: ${npcIdArg} from ${fileArg}`);

  // 1. Optimize image to 480x640 WebP
  const optimizedBuffer = await sharp(inputPath)
    .resize(480, 640, { fit: 'cover', position: 'top' })
    .webp({ quality: 80, effort: 6 })
    .toBuffer();

  const sizeKb = (optimizedBuffer.length / 1024).toFixed(1);
  console.log(`✅ Compressed to 480x640 WebP: ${sizeKb} KB`);

  let finalUrl = '';

  // 2. Upload to Vercel Blob if token exists
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    console.log('☁️ Uploading to Vercel Blob...');
    const blobName = `npcs/${npcIdArg}_${Date.now()}.webp`;
    const blob = await put(blobName, optimizedBuffer, {
      access: 'public',
      contentType: 'image/webp',
    });
    finalUrl = blob.url;
    console.log(`🚀 Uploaded to Vercel Blob successfully: ${finalUrl}`);
  } else {
    // Local fallback
    const localDir = path.resolve(process.cwd(), 'public/images/npcs');
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    const localFileName = `${npcIdArg}.webp`;
    const localFilePath = path.join(localDir, localFileName);
    fs.writeFileSync(localFilePath, optimizedBuffer);
    finalUrl = `/images/npcs/${localFileName}`;
    console.log(`⚠️ BLOB_READ_WRITE_TOKEN not set in web/.env.`);
    console.log(`💾 Saved locally to: ${localFilePath}`);
    console.log(`🔗 Local URL: ${finalUrl}`);
    console.log(`ℹ️ Add BLOB_READ_WRITE_TOKEN to web/.env to upload to Vercel Blob.`);
  }

  // 3. Update NPC in database manifest
  const prisma = getPrisma();
  if (prisma) {
    const story = await prisma.story.findUnique({
      where: { id: 'story_mt4ofllt' },
    });

    if (story) {
      const manifest = story.manifest as any;
      const wb = manifest.worldBible || {};
      const npc = (wb.npcs || []).find((n: any) => n.id === npcIdArg || n.name.includes(npcIdArg));

      if (npc) {
        npc.imageUrl = finalUrl;
        await prisma.story.update({
          where: { id: 'story_mt4ofllt' },
          data: { manifest },
        });
        console.log(`📝 Updated ${npc.name} (${npc.id}) imageUrl to: ${finalUrl}`);

        if (story.worldId) {
          const worldWb = await prisma.worldBible.findUnique({
            where: { worldId: story.worldId },
          });
          if (worldWb) {
            await prisma.worldBible.update({
              where: { id: worldWb.id },
              data: { npcs: wb.npcs as any },
            });
            console.log('🌐 Synced to WorldBible record');
          }
        }
      } else {
        console.warn(`Could not find NPC ${npcIdArg} in story manifest`);
      }
    }
  }

  console.log('🎉 Done!');
}

main().catch(console.error).finally(() => process.exit(0));
