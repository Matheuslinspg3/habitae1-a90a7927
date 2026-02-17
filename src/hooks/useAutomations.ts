import { useState, useCallback } from "react";
import type { AutomationRule } from "@/types/automation";

export type AutomationPlan = "free" | "pro" | "enterprise";

export interface AutomationStats {
  totalActive: number;
  totalPaused: number;
  leadsImpacted: number;
  messagesSent: number;
  tasksCreated: number;
  conversions: number;
  avgResponseRate: number;
  nextExecution: string | null;
}

export function useAutomations() {
  const [automations, setAutomations] = useState<AutomationRule[]>([]);
  const [plan] = useState<AutomationPlan>("free");

  const stats: AutomationStats = {
    totalActive: automations.filter((a) => a.enabled).length,
    totalPaused: automations.filter((a) => !a.enabled).length,
    leadsImpacted: 0,
    messagesSent: 0,
    tasksCreated: 0,
    conversions: 0,
    avgResponseRate: 0,
    nextExecution: null,
  };

  const toggleAutomation = useCallback((id: string) => {
    setAutomations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a))
    );
  }, []);

  const deleteAutomation = useCallback((id: string) => {
    setAutomations((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const duplicateAutomation = useCallback((id: string) => {
    setAutomations((prev) => {
      const source = prev.find((a) => a.id === id);
      if (!source) return prev;
      const copy: AutomationRule = {
        ...source,
        id: crypto.randomUUID(),
        name: `${source.name} (cópia)`,
        enabled: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return [...prev, copy];
    });
  }, []);

  const addAutomation = useCallback((rule: Omit<AutomationRule, "id" | "created_at" | "updated_at">) => {
    const newRule: AutomationRule = {
      ...rule,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setAutomations((prev) => [...prev, newRule]);
  }, []);

  const maxAutomations = plan === "free" ? 2 : Infinity;
  const canCreate = automations.filter((a) => a.enabled).length < maxAutomations;

  return {
    automations,
    stats,
    plan,
    canCreate,
    maxAutomations,
    toggleAutomation,
    deleteAutomation,
    duplicateAutomation,
    addAutomation,
  };
}
