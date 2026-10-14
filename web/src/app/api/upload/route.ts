import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { requireStudioWrite } from '@/lib/auth/studioAuth';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const guard = await requireStudioWrite(req);
    if (!guard.ok) {
      return guard.response;
    }

    const formData = await req.formData();
    const file = formData.get('file');
    const folder = ((formData.get('folder') as string) || 'uploads')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .toLowerCase();

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { success: false, error: 'No image file provided in request.' },
        { status: 400 }
      );
    }

    // Target dimensions (defaults to 480x640 mobile portrait for optimal size and speed)
    const widthParam = formData.get('width');
    const heightParam = formData.get('height');
    const targetWidth = widthParam ? parseInt(widthParam.toString(), 10) : 480;
    const targetHeight = heightParam ? parseInt(heightParam.toString(), 10) : 640;

    // Read incoming file buffer and run through sharp optimization pipeline
    const rawBuffer = Buffer.from(await file.arrayBuffer());
    const optimizedBuffer = await sharp(rawBuffer)
      .resize(targetWidth, targetHeight, { fit: 'cover', position: 'top' })
      .webp({ quality: 80, effort: 6 })
      .toBuffer();

    // Determine filename
    const originalName = file instanceof File ? file.name : 'image.webp';
    const baseClean = originalName
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .toLowerCase() || 'asset';

    const timestamp = Date.now();
    const rand = Math.random().toString(36).substring(2, 8);
    const blobPath = `${folder}/${baseClean}_${timestamp}_${rand}.webp`;

    // 1. If Vercel Blob token is set, upload directly to Vercel Blob
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(blobPath, optimizedBuffer, {
        access: 'public',
        contentType: 'image/webp',
      });

      return NextResponse.json({
        success: true,
        url: blob.url,
        pathname: blob.pathname,
        sizeBytes: optimizedBuffer.length,
      });
    }

    // 2. Dev fallback: If BLOB_READ_WRITE_TOKEN is not set locally, store in public/uploads/
    if (process.env.NODE_ENV !== 'production') {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', folder);
      await fs.mkdir(uploadDir, { recursive: true });

      const localFileName = `${baseClean}_${timestamp}_${rand}.webp`;
      const localFilePath = path.join(uploadDir, localFileName);

      await fs.writeFile(localFilePath, optimizedBuffer);

      const localUrl = `/uploads/${folder}/${localFileName}`;
      return NextResponse.json({
        success: true,
        url: localUrl,
        pathname: localFileName,
        sizeBytes: optimizedBuffer.length,
        isLocalFallback: true,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'BLOB_READ_WRITE_TOKEN environment variable is not configured on the server.',
      },
      { status: 500 }
    );
  } catch (error: any) {
    console.error('[API /api/upload] Error uploading image:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to upload image' },
      { status: 500 }
    );
  }
}
