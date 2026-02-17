import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { CarnivalConfetti } from "./CarnivalConfetti";

function isCarnivalMonth() {
  return new Date().getMonth() === 1; // February
}

interface CarnivalContextType {
  isCarnivalMonth: boolean;
  carnivalEnabled: boolean;
  toggleCarnival: () => void;
}

const CarnivalContext = createContext<CarnivalContextType>({
  isCarnivalMonth: false,
  carnivalEnabled: false,
  toggleCarnival: () => {},
});

export const useCarnival = () => useContext(CarnivalContext);

export function CarnivalThemeProvider({ children }: { children: React.ReactNode }) {
  const isFebruary = isCarnivalMonth();

  const [carnivalEnabled, setCarnivalEnabled] = useState(() => {
    if (!isFebruary) return false;
    const stored = localStorage.getItem("carnival-enabled");
    return stored !== null ? stored === "true" : false; // default OFF to avoid performance issues
  });

  const toggleCarnival = useCallback(() => {
    setCarnivalEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("carnival-enabled", String(next));
      return next;
    });
  }, []);

  useEffect(() => {
    if (carnivalEnabled) {
      document.documentElement.classList.add("carnival");
    } else {
      document.documentElement.classList.remove("carnival");
    }
    return () => {
      document.documentElement.classList.remove("carnival");
    };
  }, [carnivalEnabled]);

  return (
    <CarnivalContext.Provider value={{ isCarnivalMonth: isFebruary, carnivalEnabled, toggleCarnival }}>
      {carnivalEnabled && <CarnivalConfetti />}
      {children}
    </CarnivalContext.Provider>
  );
}
