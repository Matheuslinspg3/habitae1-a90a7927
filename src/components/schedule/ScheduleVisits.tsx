import { useVisits, type VisitStatus } from "@/hooks/useVisits";
import { VisitCard } from "@/components/visits/VisitCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarPlus } from "lucide-react";

interface ScheduleVisitsProps {
  selectedDate?: Date;
}

export function ScheduleVisits({ selectedDate }: ScheduleVisitsProps) {
  const dateStart = selectedDate ? new Date(selectedDate) : new Date();
  dateStart.setHours(0, 0, 0, 0);
  const dateEnd = new Date(dateStart);
  dateEnd.setDate(dateEnd.getDate() + 1);

  const { visits, isLoading, updateVisitStatus, isUpdating } = useVisits({
    dateStart: dateStart.toISOString(),
    dateEnd: dateEnd.toISOString(),
  });

  return (
    <Card className="border-t-4 border-t-primary/40">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-primary" />
            Visitas
          </CardTitle>
          <Badge variant={visits.length > 0 ? "default" : "secondary"} className="text-xs">
            {visits.length} visita{visits.length !== 1 ? "s" : ""}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        ) : visits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <CalendarPlus className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <h3 className="font-medium text-muted-foreground text-sm">Nenhuma visita para este dia</h3>
            <p className="text-xs text-muted-foreground mt-1">Use "Agendar Visita" no dashboard para agendar.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visits.map((visit) => (
              <VisitCard
                key={visit.id}
                visit={visit}
                onUpdateStatus={(visitId, status, leadId, feedback, rating) =>
                  updateVisitStatus({ visitId, status, leadId, feedback, rating })
                }
                isUpdating={isUpdating}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
