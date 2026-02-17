import { useSearchParams } from "react-router-dom";
import { useCallback } from "react";

/**
 * Hook to sync a tab value with URL search params.
 * Usage: const [tab, setTab] = useTabParam("tab", "default-value");
 */
export function useTabParam(paramName: string = "tab", defaultValue: string = ""): [string, (value: string) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const currentValue = searchParams.get(paramName) || defaultValue;
  
  const setValue = useCallback((value: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (value === defaultValue) {
        next.delete(paramName);
      } else {
        next.set(paramName, value);
      }
      return next;
    }, { replace: true });
  }, [paramName, defaultValue, setSearchParams]);

  return [currentValue, setValue];
}
