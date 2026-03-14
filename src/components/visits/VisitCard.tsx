import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { VisitStatusBadge } from "./VisitStatusBadge";
import { VisitFeedbackDialog } from "./VisitFeedbackDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MapPin, User, Clock, Home, CheckCircle, XCircle, Eye, Star, UserX, Loader2 } from "lucide-react";
import type { PropertyVisit, VisitStatus } from "@/hooks/useVisits";

interface VisitCardProps {
  visit: PropertyVisit;
  onUpdateStatus: (visitId: string, status: VisitStatus, leadId: string, feedback?: string, rating?: number) => void;
  isUpdating?: boolean;
  compact?: boolean;
}

export function VisitCard({ visit, onUpdateStatus, isUpdating, compact }: VisitCardProps) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const handleComplete = (feedback: string, rating: number) => {
    onUpdateStatus(visit.id, "completed", visit.lead_id, feedback, rating);
    setFeedbackOpen(false);
  };

  return (
    <>
      <Card className="border-l-4 border-l-primary/40">
        <CardContent className={compact ? "p-3" : "p-4"}>
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <VisitStatusBadge status={visit.visit_status as VisitStatus} />
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(new Date(visit.scheduled_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                </span>
              </div>

              {visit.property && (
                <div className="flex items-center gap-1.5 text-sm">
                  <Home className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{visit.property.title}</span>
                </div>
              )}

              {visit.lead && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <User className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{visit.lead.name}</span>
                </div>
              )}

              {visit.property?.address_neighborhood && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span>{visit.property.address_neighborhood}{visit.property.address_city ? `, ${visit.property.address_city}` : ""}</span>
                </div>
              )}

              {visit.agent && !compact && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Eye className="h-3 w-3 shrink-0" />
                  <span>Corretor: {visit.agent.full_name}</span>
                </div>
              )}

              {visit.visit_status === "completed" && visit.rating && (
                <div className="flex items-center gap-0.5 mt-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={`h-3.5 w-3.5 ${n <= visit.rating! ? "fill-primary text-primary" : "text-muted-foreground/30"}`}
                    />
                  ))}
                  {visit.feedback && (
                    <span className="text-xs text-muted-foreground ml-2 truncate max-w-[200px]">"{visit.feedback}"</span>
                  )}
                </div>
              )}

              {visit.notes && !compact && (
                <p className="text-xs text-muted-foreground italic mt-1">{visit.notes}</p>
              )}
            </div>
          </div>

          {/* Actions */}
          {(visit.visit_status === "scheduled" || visit.visit_status === "confirmed") && (
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {visit.visit_status === "scheduled" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 text-xs gap-1"
                  onClick={() => onUpdateStatus(visit.id, "confirmed", visit.lead_id)}
                  disabled={isUpdating}
                  aria-label="Confirmar visita"
                >
                  {isUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                  Confirmar
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-9 text-xs gap-1"
                onClick={() => setFeedbackOpen(true)}
                disabled={isUpdating}
                aria-label="Marcar visita como realizada"
              >
                <Eye className="h-3 w-3" />
                Realizada
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-9 text-xs gap-1 text-muted-foreground"
                onClick={() => onUpdateStatus(visit.id, "no_show", visit.lead_id)}
                disabled={isUpdating}
                aria-label="Marcar como não compareceu"
              >
                <UserX className="h-3 w-3" />
                Não compareceu
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-9 text-xs gap-1 text-destructive"
                onClick={() => onUpdateStatus(visit.id, "cancelled", visit.lead_id)}
                disabled={isUpdating}
                aria-label="Cancelar visita"
              >
                <XCircle className="h-3 w-3" />
                Cancelar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <VisitFeedbackDialog
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        onSubmit={handleComplete}
        isLoading={isUpdating}
      />
    </>
  );
}
