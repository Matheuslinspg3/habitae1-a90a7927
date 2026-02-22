import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { getImageUrl, getImageSrcSet, type ImageRecord } from "@/lib/imageUrl";

interface OptimizedImageProps {
  image?: ImageRecord | null;
  alt: string;
  className?: string;
  variant?: "thumb" | "full";
  sizes?: string;
  loading?: "lazy" | "eager";
  onLoad?: () => void;
  onError?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  fallback?: React.ReactNode;
}

/**
 * Optimized image component with:
 * - R2 srcSet support (400w thumb, 1920w full)
 * - Lazy loading with IntersectionObserver
 * - Fade-in on load
 * - Fallback support
 */
export function OptimizedImage({
  image,
  alt,
  className,
  variant = "thumb",
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
  loading = "lazy",
  onLoad,
  onError,
  fallback,
}: OptimizedImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const src = getImageUrl(image, variant);
  const srcSet = getImageSrcSet(image);

  const handleLoad = () => {
    setLoaded(true);
    onLoad?.();
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setError(true);
    onError?.(e);
  };

  // Check if already cached (loaded instantly)
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current?.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [src]);

  if (error && fallback) {
    return <>{fallback}</>;
  }

  if (!image || src === "/placeholder.svg") {
    return fallback ? <>{fallback}</> : null;
  }

  return (
    <img
      ref={imgRef}
      src={src}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      alt={alt}
      loading={loading}
      decoding="async"
      onLoad={handleLoad}
      onError={handleError}
      className={cn(
        "transition-opacity duration-300",
        loaded ? "opacity-100" : "opacity-0",
        className,
      )}
    />
  );
}
