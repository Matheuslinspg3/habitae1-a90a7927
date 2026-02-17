/**
 * Client-side image normalization before upload.
 * Reduces dimensions, removes EXIF (canvas doesn't preserve it),
 * and compresses as WebP (fallback JPEG).
 * 
 * This is the first line of defense to reduce storage costs.
 * The Cloudinary incoming transformation acts as a safety net.
 */

interface NormalizeOptions {
  /** Maximum dimension (width or height) in pixels. Default: 2048 */
  maxDimension?: number;
  /** Output quality 0-1. Default: 0.82 */
  quality?: number;
  /** Preferred output format. Default: 'image/webp' */
  outputFormat?: 'image/webp' | 'image/jpeg';
}

/**
 * Normalizes an image file before upload:
 * - Resizes to maxDimension (maintains aspect ratio, never upscales)
 * - Removes EXIF/metadata (canvas doesn't preserve it)
 * - Compresses to WebP/JPEG with target quality
 * - Corrects EXIF orientation automatically (canvas handles this)
 * - Returns original if normalized version is larger (e.g. already optimized)
 */
export async function normalizeImageBeforeUpload(
  file: File,
  options: NormalizeOptions = {}
): Promise<File> {
  const {
    maxDimension = 2048,
    quality = 0.82,
    outputFormat = 'image/webp',
  } = options;

  // Skip non-image files
  if (!file.type.startsWith('image/')) return file;

  // Skip SVGs (vector, no need to rasterize)
  if (file.type === 'image/svg+xml') return file;

  // Skip very small files (already optimized, < 100KB)
  if (file.size < 100 * 1024) return file;

  return new Promise<File>((resolve) => {
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(img.src);

      let { width, height } = img;

      // Calculate new dimensions maintaining aspect ratio
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }

      // Drawing to canvas automatically:
      // 1. Removes EXIF metadata
      // 2. Applies EXIF orientation correction
      ctx.drawImage(img, 0, 0, width, height);

      // Try preferred format, then fallback
      const tryFormat = (format: string, q: number) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              // If WebP fails, try JPEG
              if (format === 'image/webp') {
                tryFormat('image/jpeg', q);
                return;
              }
              resolve(file);
              return;
            }

            // Safety: if normalized is LARGER, keep original
            if (blob.size >= file.size) {
              console.log(`[NORMALIZE] Skipped: ${blob.size}B >= original ${file.size}B`);
              resolve(file);
              return;
            }

            const ext = format === 'image/webp' ? 'webp' : 'jpg';
            const normalizedFile = new File(
              [blob],
              file.name.replace(/\.[^.]+$/, `.${ext}`),
              { type: format }
            );

            const reduction = Math.round((1 - normalizedFile.size / file.size) * 100);
            console.log(
              `[NORMALIZE] ${(file.size / 1024).toFixed(0)}KB → ${(normalizedFile.size / 1024).toFixed(0)}KB (${reduction}% reduction, ${width}×${height})`
            );

            resolve(normalizedFile);
          },
          format,
          q
        );
      };

      tryFormat(outputFormat, quality);
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      resolve(file); // Fallback: send original
    };

    img.src = URL.createObjectURL(file);
  });
}

/**
 * Computes SHA-256 hash of a file's contents.
 * Used for deduplication: same content = same hash = same public_id in Cloudinary.
 */
export async function computeFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(hashBuffer)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
