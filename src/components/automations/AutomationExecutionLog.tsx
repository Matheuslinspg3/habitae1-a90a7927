import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  CheckCircle2, XCircle, Clock, Zap, 
  MessageSquare, ClipboardList, Bell 
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface ExecutionLogEntry {
  id: string;
  automationName: string;
  triggerType: string;
  status: 'success' | 'error' | 'pending';
  actionType: string;
  leadName?: string;
  executedAt: string;
  errorMessage?: string;
}

interface Props {
  logs: ExecutionLogEntry[];
}

const actionIcons: Record<string, React.ElementType> = {
  create_task: ClipboardList,
  send_notification: Bell,
  send_whatsapp: MessageSquare,
  send_email: MessageSquare,
  update_stage: Zap,
};

const statusConfig = {
  success: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10', label: 'Sucesso' },
  error: { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10', label: 'Erro' },
  pending: { icon: Clock, color: 'text-warning', bg: 'bg-warning/10', label: 'Pendente' },
};

export function AutomationExecutionLog({ logs }: Props) {
  if (logs.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 flex flex-col items-center text-center gap-2">
          <Clock className="h-8 w-8 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Nenhuma execução registrada</h3>
          <p className="text-xs text-muted-foreground">
            As execuções das automações aparecerão aqui.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          Log de Execuções
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[300px]">
          <div className="divide-y divide-border">
            {logs.map(log => {
              const config = statusConfig[log.status];
              const StatusIcon = config.icon;
              const ActionIcon = actionIcons[log.actionType] || Zap;
              
              return (
                <div key={log.id} className="p-3 flex items-start gap-3 hover:bg-muted/30 transition-colors">
                  <div className={`h-8 w-8 rounded-lg ${config.bg} flex items-center justify-center shrink-0`}>
                    <StatusIcon className={`h-4 w-4 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{log.automationName}</span>
                      <Badge variant="secondary" className="text-[10px] gap-1 px-1.5">
                        <ActionIcon className="h-2.5 w-2.5" />
                        {log.actionType.replace('_', ' ')}
                      </Badge>
                    </div>
                    {log.leadName && (
                      <p className="text-xs text-muted-foreground mt-0.5">Lead: {log.leadName}</p>
                    )}
                    {log.errorMessage && (
                      <p className="text-xs text-destructive mt-0.5">{log.errorMessage}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(log.executedAt), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
