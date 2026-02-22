/**
 * Client-side image variant generation using Canvas API.
 * Generates thumb (400w) and full (1920w) WebP variants.
 */

export interface ImageVariant {
  blob: Blob;
  width: number;
  height: number;
}

export interface ImageVariants {
  full: ImageVariant;
  thumb: ImageVariant;
}

interface VariantOptions {
  fullMaxWidth?: number;
  thumbMaxWidth?: number;
  fullQuality?: number;
  thumbQuality?: number;
}

const DEFAULT_OPTIONS: Required<VariantOptions> = {
  fullMaxWidth: 1920,
  thumbMaxWidth: 400,
  fullQuality: 0.80,
  thumbQuality: 0.75,
};

/**
 * Load a File as an HTMLImageElement.
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Resize an image to a target max width using Canvas.
 * - Maintains aspect ratio
 * - Never upscales
 * - Strips EXIF (canvas doesn't preserve it)
 * - Corrects EXIF orientation (modern browsers handle this)
 * - Outputs WebP with fallback to JPEG
 */
function resizeToBlob(
  img: HTMLImageElement,
  maxWidth: number,
  quality: number,
): Promise<ImageVariant> {
  return new Promise((resolve, reject) => {
    let { width, height } = img;

    // Never upscale
    if (width > maxWidth) {
      const ratio = maxWidth / width;
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Canvas context unavailable'));
      return;
    }

    ctx.drawImage(img, 0, 0, width, height);

    const tryFormat = (format: string, q: number) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            if (format === 'image/webp') {
              tryFormat('image/jpeg', q);
              return;
            }
            reject(new Error('Failed to create blob'));
            return;
          }
          resolve({ blob, width, height });
        },
        format,
        q,
      );
    };

    tryFormat('image/webp', quality);
  });
}

/**
 * Generate thumb and full variants from a source image file.
 * All output is WebP, EXIF-stripped, properly oriented.
 */
export async function generateImageVariants(
  file: File,
  options: VariantOptions = {},
): Promise<ImageVariants> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Skip non-image files
  if (!file.type.startsWith('image/')) {
    throw new Error('Not an image file');
  }

  const img = await loadImage(file);

  const [full, thumb] = await Promise.all([
    resizeToBlob(img, opts.fullMaxWidth, opts.fullQuality),
    resizeToBlob(img, opts.thumbMaxWidth, opts.thumbQuality),
  ]);

  const originalKB = (file.size / 1024).toFixed(0);
  const fullKB = (full.blob.size / 1024).toFixed(0);
  const thumbKB = (thumb.blob.size / 1024).toFixed(0);
  console.log(
    `[VARIANTS] ${originalKB}KB → full: ${fullKB}KB (${full.width}×${full.height}), thumb: ${thumbKB}KB (${thumb.width}×${thumb.height})`,
  );

  return { full, thumb };
}
