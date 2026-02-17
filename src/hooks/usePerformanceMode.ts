import { useState, useEffect, useCallback } from "react";

interface NetworkInfo {
  effectiveType?: string;
  downlink?: number;
  saveData?: boolean;
}

/**
 * Hook to detect low-end devices and slow networks.
 * Returns flags for performance-aware rendering.
 */
export function usePerformanceMode() {
  const [isLowEnd, setIsLowEnd] = useState(false);
  const [isSlowNetwork, setIsSlowNetwork] = useState(false);

  useEffect(() => {
    // Detect low-end: few cores or low memory
    const cores = navigator.hardwareConcurrency || 4;
    const memory = (navigator as any).deviceMemory || 4;
    if (cores <= 2 || memory <= 2) {
      setIsLowEnd(true);
      document.documentElement.classList.add("low-end-mode");
    }

    // Detect slow network
    const conn = (navigator as any).connection as NetworkInfo | undefined;
    if (conn) {
      const checkNetwork = () => {
        const slow = conn.effectiveType === "slow-2g" || conn.effectiveType === "2g" || conn.effectiveType === "3g" || conn.saveData === true;
        setIsSlowNetwork(slow);
      };
      checkNetwork();
      (conn as any).addEventListener?.("change", checkNetwork);
      return () => (conn as any).removeEventListener?.("change", checkNetwork);
    }
  }, []);

  const toggleLowEnd = useCallback((enabled: boolean) => {
    setIsLowEnd(enabled);
    if (enabled) {
      document.documentElement.classList.add("low-end-mode");
    } else {
      document.documentElement.classList.remove("low-end-mode");
    }
  }, []);

  /**
   * Returns optimal image quality suffix for Drive proxy.
   * Slow network → smallest thumbnails; low-end → medium.
   */
  const getImageQuality = useCallback((context: "list" | "detail" | "fullscreen") => {
    if (isSlowNetwork) {
      return context === "list" ? "w200" : context === "detail" ? "w400" : "w800";
    }
    if (isLowEnd) {
      return context === "list" ? "w400" : context === "detail" ? "w800" : "w1200";
    }
    return context === "list" ? "w400" : context === "detail" ? "w1200" : "w1600";
  }, [isLowEnd, isSlowNetwork]);

  return { isLowEnd, isSlowNetwork, toggleLowEnd, getImageQuality };
}
