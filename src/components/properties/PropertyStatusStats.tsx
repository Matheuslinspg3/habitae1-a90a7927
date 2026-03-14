import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { statusConfig } from "./PropertyStatusBadge";
import { availabilityConfig } from "./AvailabilityBadge";
import type { PropertyWithDetails } from "@/hooks/useProperties";
import { cn } from "@/lib/utils";

interface PropertyStatusStatsProps {
  properties: PropertyWithDetails[];
  onFilterByStatus: (status: string) => void;
  activeStatus?: string;
}

export function PropertyStatusStats({ properties, onFilterByStatus, activeStatus }: PropertyStatusStatsProps) {
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    properties.forEach((p) => {
      map[p.status] = (map[p.status] || 0) + 1;
    });
    return map;
  }, [properties]);

  const availabilityCounts = useMemo(() => {
    const map: Record<string, number> = {};
    properties.forEach((p) => {
      const avail = (p as any).availability_status || 'available';
      map[avail] = (map[avail] || 0) + 1;
    });
    return map;
  }, [properties]);

  const statuses = Object.keys(statusConfig).filter((s) => (counts[s] || 0) > 0);

  if (statuses.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Badge
          variant="outline"
          className={cn(
            "cursor-pointer transition-all hover:bg-accent/10",
            !activeStatus || activeStatus === "all"
              ? "ring-2 ring-primary"
              : "opacity-70"
          )}
          onClick={() => onFilterByStatus("all")}
        >
          Todos ({properties.length})
        </Badge>
        {statuses.map((status) => {
          const config = statusConfig[status];
          return (
            <Badge
              key={status}
              variant="outline"
              className={cn(
                "cursor-pointer transition-all",
                config.className,
                "hover:opacity-100",
                activeStatus === status ? "ring-2 ring-primary" : "opacity-80"
              )}
              onClick={() => onFilterByStatus(status)}
            >
              {config.label} ({counts[status]})
            </Badge>
          );
        })}
      </div>
      {/* Availability counters */}
      {Object.keys(availabilityCounts).length > 1 && (
        <p className="text-xs text-muted-foreground">
          {availabilityCounts.available ? `${availabilityCounts.available} disponíveis` : ''}
          {availabilityCounts.reserved ? ` · ${availabilityCounts.reserved} reservados` : ''}
          {availabilityCounts.sold ? ` · ${availabilityCounts.sold} vendidos` : ''}
          {availabilityCounts.rented ? ` · ${availabilityCounts.rented} alugados` : ''}
        </p>
      )}
    </div>
  );
}
