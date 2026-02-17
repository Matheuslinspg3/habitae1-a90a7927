import { useRef, useEffect, useState, useCallback } from "react";

/**
 * Hook that triggers an animation class when an element enters viewport.
 * Returns [ref, isVisible].
 * Uses IntersectionObserver for performance.
 */
export function useAnimateIn<T extends HTMLElement = HTMLDivElement>(
  threshold = 0.1,
  triggerOnce = true
): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (triggerOnce) observer.unobserve(el);
        } else if (!triggerOnce) {
          setIsVisible(false);
        }
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, triggerOnce]);

  return [ref, isVisible];
}

/**
 * Hook that provides a stagger delay for list items.
 * Returns getDelay(index) → inline style object.
 */
export function useStaggerDelay(baseDelay = 40, maxItems = 12) {
  const getDelay = useCallback(
    (index: number) => ({
      animationDelay: `${Math.min(index, maxItems) * baseDelay}ms`,
      animationFillMode: "both" as const,
    }),
    [baseDelay, maxItems]
  );

  return { getDelay };
}

/**
 * Hook for favorite pop animation.
 * Returns [isAnimating, trigger].
 */
export function useFavoritePop(): [boolean, () => void] {
  const [isAnimating, setIsAnimating] = useState(false);

  const trigger = useCallback(() => {
    setIsAnimating(true);
    const timeout = setTimeout(() => setIsAnimating(false), 400);
    return () => clearTimeout(timeout);
  }, []);

  return [isAnimating, trigger];
}