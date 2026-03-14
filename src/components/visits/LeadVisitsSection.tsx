import { useVisits, type VisitStatus } from "@/hooks/useVisits";
import { VisitCard } from "./VisitCard";
import { Skeleton } from "@/components/ui/skeleton";

interface LeadVisitsSectionProps {
  leadId: string;
}

export function LeadVisitsSection({ leadId }: LeadVisitsSectionProps) {
  const { visits, isLoading, updateVisitStatus, isUpdating } = useVisits({ leadId });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (visits.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">Nenhuma visita registrada.</p>
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
