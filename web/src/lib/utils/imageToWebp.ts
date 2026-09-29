/**
 * Converts any browser-supported image File (PNG, JPEG, WebP, GIF, BMP, SVG, etc.)
 * into a compressed .webp File using HTML5 Canvas.
 *
 * @param file The input File from an <input type="file" />.
 * @param quality Compression quality between 0.1 and 1.0 (default: 0.85).
 * @param maxWidth Max proportional width (default: 2048).
 * @param maxHeight Max proportional height (default: 2048).
 */
export async function convertImageFileToWebP(
  file: File,
  quality = 0.85,
  maxWidth = 2048,
  maxHeight = 2048
): Promise<File> {
  // If the browser doesn't have DOM canvas (SSR guard), return file as is
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        let width = img.naturalWidth;
        let height = img.naturalHeight;

        // Downscale proportionally if larger than maximum bounds
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context unavailable'));
          return;
        }

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Export to WebP
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to convert image to WebP'));
              return;
            }

            // Replace existing extension with .webp
            const cleanBase = file.name.replace(/\.[^/.]+$/, '').trim() || 'image';
            const sanitizedName = cleanBase.replace(/[^a-zA-Z0-9_-]/g, '_');
            const webpFile = new File([blob], `${sanitizedName}.webp`, {
              type: 'image/webp',
              lastModified: Date.now(),
            });

            resolve(webpFile);
          },
          'image/webp',
          quality
        );
      };

      img.onerror = () => {
        reject(new Error('Selected file could not be decoded as an image.'));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('Failed to read the selected file.'));
    };

    reader.readAsDataURL(file);
  });
}
