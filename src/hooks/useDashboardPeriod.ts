import { useState, useCallback, useMemo } from "react";
import { startOfDay, startOfWeek, startOfMonth, subDays } from "date-fns";

export type PeriodKey = "today" | "week" | "month" | "90days" | "custom";

interface DateRange {
  from: Date;
  to: Date;
}

const STORAGE_KEY = "habitae_dashboard_period";

function getInitialPeriod(): PeriodKey {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && ["today", "week", "month", "90days", "custom"].includes(saved)) {
      return saved as PeriodKey;
    }
  } catch {}
  return "month";
}

function computeRange(key: PeriodKey, custom?: DateRange): DateRange {
  const now = new Date();
  switch (key) {
    case "today":
      return { from: startOfDay(now), to: now };
    case "week":
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: now };
    case "month":
      return { from: startOfMonth(now), to: now };
    case "90days":
      return { from: subDays(now, 90), to: now };
    case "custom":
      return custom || { from: startOfMonth(now), to: now };
  }
}

export function useDashboardPeriod() {
  const [periodKey, setPeriodKeyState] = useState<PeriodKey>(getInitialPeriod);
  const [customRange, setCustomRange] = useState<DateRange>(() => ({
    from: startOfMonth(new Date()),
    to: new Date(),
  }));

  const setPeriodKey = useCallback((key: PeriodKey) => {
    setPeriodKeyState(key);
    try { localStorage.setItem(STORAGE_KEY, key); } catch {}
  }, []);

  const dateRange = useMemo(
    () => computeRange(periodKey, customRange),
    [periodKey, customRange]
  );

  return { periodKey, setPeriodKey, dateRange, customRange, setCustomRange };
}
