import { Badge } from "@/components/ui/badge";
import type { VisitStatus } from "@/hooks/useVisits";

const STATUS_CONFIG: Record<VisitStatus, { label: string; emoji: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  scheduled: { label: "Agendada", emoji: "🗓", variant: "outline" },
  confirmed: { label: "Confirmada", emoji: "✅", variant: "default" },
  completed: { label: "Realizada", emoji: "👁", variant: "secondary" },
  cancelled: { label: "Cancelada", emoji: "❌", variant: "destructive" },
  no_show: { label: "Não compareceu", emoji: "🚫", variant: "destructive" },
};

export function VisitStatusBadge({ status }: { status: VisitStatus }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.scheduled;
  return (
    <Badge variant={config.variant} className="text-xs gap-1">
      <span>{config.emoji}</span>
      {config.label}
    </Badge>
  );
}
