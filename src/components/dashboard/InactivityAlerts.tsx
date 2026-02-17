import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, ChevronRight } from "lucide-react";
import { useLeads, type Lead } from "@/hooks/useLeads";
import { useNavigate } from "react-router-dom";
import { differenceInDays, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function InactivityAlerts() {
  const { leads, isLoading } = useLeads();
  const navigate = useNavigate();

  const staleLeads = useMemo(() => {
    if (!leads.length) return [];
    return leads
      .filter(l => {
        const days = differenceInDays(new Date(), new Date(l.updated_at));
        return days >= 5 && !['fechado_ganho', 'fechado_perdido'].includes(l.stage);
      })
      .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())
      .slice(0, 5);
  }, [leads]);

  if (isLoading || staleLeads.length === 0) return null;

  return (
    <Card className="border-warning/30 bg-warning/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          Leads sem Interação
          <Badge variant="secondary" className="text-xs">{staleLeads.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {staleLeads.map(lead => {
          const days = differenceInDays(new Date(), new Date(lead.updated_at));
          return (
            <button
              key={lead.id}
              onClick={() => navigate('/crm')}
              className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{lead.name}</p>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock className="h-2.5 w-2.5" />
                  <span>{days} dias sem atualização</span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
