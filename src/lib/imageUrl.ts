/**
 * Unified image URL resolver.
 * Handles R2 and Cloudinary images with variant support.
 */

const R2_PUBLIC_BASE = import.meta.env.VITE_R2_PUBLIC_URL || '';

export type ImageVariantType = 'thumb' | 'full';

export interface ImageRecord {
  url: string;
  r2_key_full?: string | null;
  r2_key_thumb?: string | null;
  storage_provider?: string | null;
  cached_thumbnail_url?: string | null;
}

/**
 * Get the best URL for an image, given a desired variant.
 * 
 * Priority:
 * 1. R2 variant key (if storage_provider === 'r2' and key exists)
 * 2. Cloudinary cached_thumbnail_url (for thumb variant, legacy)
 * 3. Original url (Cloudinary or any legacy URL)
 */
export function getImageUrl(
  image: ImageRecord | null | undefined,
  variant: ImageVariantType = 'full',
): string {
  if (!image) return '/placeholder.svg';

  // R2 images
  if (image.storage_provider === 'r2') {
    const key = variant === 'thumb' ? image.r2_key_thumb : image.r2_key_full;
    if (key) {
      // Use R2 public URL if configured, otherwise fall back to url field
      if (R2_PUBLIC_BASE) {
        return `${R2_PUBLIC_BASE.replace(/\/$/, '')}/${key}`;
      }
    }
    // If R2 key exists but no public URL configured, use the stored url
    if (image.url) return image.url;
  }

  // Cloudinary / legacy images
  if (variant === 'thumb' && image.cached_thumbnail_url) {
    return image.cached_thumbnail_url;
  }

  return image.url || '/placeholder.svg';
}

/**
 * Get srcSet for responsive images (R2 only).
 * Returns undefined for legacy images.
 */
export function getImageSrcSet(image: ImageRecord | null | undefined): string | undefined {
  if (!image || image.storage_provider !== 'r2') return undefined;

  const thumbUrl = getImageUrl(image, 'thumb');
  const fullUrl = getImageUrl(image, 'full');

  if (thumbUrl === fullUrl) return undefined;

  return `${thumbUrl} 400w, ${fullUrl} 1920w`;
}
