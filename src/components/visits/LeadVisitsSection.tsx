import { useVisits, type VisitStatus } from "@/hooks/useVisits";
import { VisitCard } from "./VisitCard";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarPlus } from "lucide-react";

interface LeadVisitsSectionProps {
  leadId: string;
}

export function LeadVisitsSection({ leadId }: LeadVisitsSectionProps) {
  const { visits, isLoading, updateVisitStatus, isUpdating } = useVisits({ leadId });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    );
  }

  if (visits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <CalendarPlus className="h-8 w-8 text-muted-foreground/50 mb-2" />
        <p className="text-xs text-muted-foreground">Nenhuma visita registrada para este lead.</p>
        <p className="text-[10px] text-muted-foreground mt-1">Use o botão "Agendar visita" acima.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {visits.map((visit) => (
        <VisitCard
          key={visit.id}
          visit={visit}
          onUpdateStatus={(visitId, status, leadId, feedback, rating) =>
            updateVisitStatus({ visitId, status, leadId, feedback, rating })
          }
          isUpdating={isUpdating}
          compact
        />
      ))}
    </div>
  );
}
