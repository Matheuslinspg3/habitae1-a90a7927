import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Clock, AlertTriangle, CheckCircle } from "lucide-react";

interface PropertyFreshnessBadgeProps {
  updatedAt: string;
  compact?: boolean;
}

function getDaysSinceUpdate(updatedAt: string): number {
  const now = new Date();
  const updated = new Date(updatedAt);
  return Math.floor((now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24));
}

type FreshnessLevel = "fresh" | "warning" | "stale" | "critical";

function getFreshnessLevel(days: number): FreshnessLevel {
  if (days <= 20) return "fresh";
  if (days <= 30) return "warning";
  if (days <= 60) return "stale";
  return "critical";
}

const freshnessConfig: Record<FreshnessLevel, { 
  icon: typeof CheckCircle; 
  className: string; 
  label: string;
}> = {
  fresh: {
    icon: CheckCircle,
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    label: "Atualizado",
  },
  warning: {
    icon: Clock,
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    label: "Atenção",
  },
  stale: {
    icon: AlertTriangle,
    className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    label: "Desatualizado",
  },
  critical: {
    icon: AlertTriangle,
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    label: "Crítico",
  },
};

export function PropertyFreshnessBadge({ updatedAt, compact = false }: PropertyFreshnessBadgeProps) {
  const days = getDaysSinceUpdate(updatedAt);
  const level = getFreshnessLevel(days);
  
  // Don't show badge for fresh properties unless compact
  if (level === "fresh" && !compact) return null;
  
  const config = freshnessConfig[level];
  const Icon = config.icon;
  const tooltipText = `Última atualização há ${days} dia${days !== 1 ? "s" : ""}`;

  if (compact) {
    // Small dot indicator for card view
    const dotColors: Record<FreshnessLevel, string> = {
      fresh: "bg-green-500",
      warning: "bg-yellow-500",
      stale: "bg-orange-500",
      critical: "bg-red-500",
    };

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${dotColors[level]}`} />
        </TooltipTrigger>
        <TooltipContent>{tooltipText}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge className={`${config.className} gap-1`}>
          <Icon className="h-3 w-3" />
          {days}d
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{tooltipText}</TooltipContent>
    </Tooltip>
  );
}

export { getDaysSinceUpdate, getFreshnessLevel };
export type { FreshnessLevel };
