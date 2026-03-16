import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { getImageUrl, getImageSrcSet, type ImageRecord } from "@/lib/imageUrl";

// PERF: aspect-ratio map eliminates CLS by reserving space before image loads
const ASPECT_RATIOS: Record<string, string> = {
  video: "aspect-video",       // 16:9
  square: "aspect-square",     // 1:1
  "4/3": "aspect-[4/3]",
  "3/2": "aspect-[3/2]",
  "21/9": "aspect-[21/9]",
};

interface OptimizedImageBaseProps {
  alt: string;
  className?: string;
  wrapperClassName?: string;
  aspectRatio?: keyof typeof ASPECT_RATIOS | (string & {});
  loading?: "lazy" | "eager";
  fetchPriority?: "high" | "low" | "auto";
  sizes?: string;
  onLoad?: () => void;
  onError?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  fallback?: React.ReactNode;
}

interface OptimizedImageRecordProps extends OptimizedImageBaseProps {
  /** Use with ImageRecord from R2/Cloudinary */
  image: ImageRecord | null | undefined;
  variant?: "thumb" | "full";
  src?: never;
  srcSet?: never;
}

interface OptimizedImageSrcProps extends OptimizedImageBaseProps {
  /** Use with raw URL */
  src: string;
  srcSet?: string;
  image?: never;
  variant?: never;
}

export type OptimizedImageProps = OptimizedImageRecordProps | OptimizedImageSrcProps;

/**
 * Optimized image component with:
 * - Aspect-ratio wrapper to eliminate CLS
 * - Skeleton placeholder while loading
 * - R2 srcSet support (400w thumb, 1920w full)
 * - Lazy loading by default
 * - Fade-in on load
 * - Fallback support
 */
export function OptimizedImage(props: OptimizedImageProps) {
  const {
    alt,
    className,
    wrapperClassName,
    aspectRatio,
    loading = "lazy",
    fetchPriority,
    sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
    onLoad,
    onError,
    fallback,
  } = props;

  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Resolve src and srcSet
  let resolvedSrc: string;
  let resolvedSrcSet: string | undefined;

  if ("image" in props && props.image !== undefined) {
    const variant = props.variant ?? "thumb";
    resolvedSrc = getImageUrl(props.image, variant);
    resolvedSrcSet = getImageSrcSet(props.image);
  } else {
    resolvedSrc = (props as OptimizedImageSrcProps).src;
    resolvedSrcSet = (props as OptimizedImageSrcProps).srcSet;
  }

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
  }, [resolvedSrc]);

  if (error && fallback) {
    return <>{fallback}</>;
  }

  const isPlaceholder = !resolvedSrc || resolvedSrc === "/placeholder.svg";
  if (isPlaceholder) {
    return fallback ? <>{fallback}</> : null;
  }

  const aspectClass = aspectRatio ? ASPECT_RATIOS[aspectRatio] || `aspect-[${aspectRatio}]` : undefined;

  // PERF: wrapper div with aspect-ratio reserves space, eliminating CLS
  const img = (
    <img
      ref={imgRef}
      src={resolvedSrc}
      srcSet={resolvedSrcSet}
      sizes={resolvedSrcSet ? sizes : undefined}
      alt={alt}
      loading={loading}
      decoding="async"
      // @ts-ignore - fetchPriority is valid HTML but not in React types yet
      fetchpriority={fetchPriority}
      onLoad={handleLoad}
      onError={handleError}
      className={cn(
        "transition-opacity duration-300",
        loaded ? "opacity-100" : "opacity-0",
        aspectClass && "absolute inset-0 w-full h-full object-cover",
        !aspectClass && className,
      )}
    />
  );

  if (aspectClass) {
    return (
      <div
        className={cn(
          "relative overflow-hidden bg-muted",
          aspectClass,
          wrapperClassName,
        )}
      >
        {/* PERF: skeleton placeholder shown until image loads */}
        {!loaded && !error && (
          <div className="absolute inset-0 animate-pulse bg-muted" />
        )}
        {img}
      </div>
    );
  }

  return img;
}
