import { useState } from "react";
import { useVisits, type VisitStatus } from "@/hooks/useVisits";
import { VisitCard } from "@/components/visits/VisitCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

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
    <Card className="border-t-4 border-t-success/40">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Eye className="h-5 w-5 text-success" />
            Visitas
          </CardTitle>
          <Badge className={cn(
            "font-medium",
            visits.length > 0 
              ? "bg-success/10 text-success border-success/20" 
              : "bg-muted text-muted-foreground"
          )}>
            {visits.length} visita{visits.length !== 1 ? "s" : ""}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
        ) : visits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Eye className="h-10 w-10 text-muted-foreground mb-3" />
            <h3 className="font-medium text-muted-foreground text-sm">Nenhuma visita para este dia</h3>
            <p className="text-xs text-muted-foreground mt-1">Use "Agendar Visita" no dashboard para agendar</p>
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
