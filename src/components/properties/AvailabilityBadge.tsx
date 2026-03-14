import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const availabilityConfig: Record<string, { label: string; className: string; emoji: string }> = {
  available: {
    label: "Disponível",
    emoji: "🟢",
    className: "bg-success/15 text-success border-success/30",
  },
  reserved: {
    label: "Reservado",
    emoji: "🟡",
    className: "bg-warning/15 text-warning border-warning/30",
  },
  sold: {
    label: "Vendido",
    emoji: "🔴",
    className: "bg-destructive/15 text-destructive border-destructive/30",
  },
  rented: {
    label: "Alugado",
    emoji: "🔵",
    className: "bg-info/15 text-info border-info/30",
  },
  unavailable: {
    label: "Indisponível",
    emoji: "⚫",
    className: "bg-muted text-muted-foreground border-border",
  },
};

interface AvailabilityBadgeProps {
  status: string;
  className?: string;
  showEmoji?: boolean;
}

export function AvailabilityBadge({ status, className, showEmoji = true }: AvailabilityBadgeProps) {
  const config = availabilityConfig[status] || availabilityConfig.available;
  return (
    <Badge variant="outline" className={cn(config.className, "text-[10px]", className)}>
      {showEmoji && <span className="mr-0.5">{config.emoji}</span>}
      {config.label}
    </Badge>
  );
}
