import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
// PERF: Uses single RPC instead of full useLeads() hook
import { useDashboardPipeline } from "@/hooks/useDashboardPipeline";

export function InactivityAlerts() {
  const { inactiveLeads, isLoading } = useDashboardPipeline();
  const navigate = useNavigate();

  if (isLoading || inactiveLeads.length === 0) return null;

  return (
    <Card className="border-warning/30 bg-warning/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          Leads sem Interação
          <Badge variant="secondary" className="text-xs">{inactiveLeads.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {inactiveLeads.map(lead => (
          <button
            key={lead.id}
            onClick={() => navigate('/crm')}
            className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{lead.name}</p>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="h-2.5 w-2.5" />
                <span>{lead.days_inactive} dias sem atualização</span>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
