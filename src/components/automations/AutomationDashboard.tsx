import { 
  Zap, Pause, Users, MessageSquare, CheckSquare, 
  TrendingUp, Clock, BarChart3 
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { AutomationStats } from "@/hooks/useAutomations";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  stats: AutomationStats;
}

const statItems = [
  { key: "totalActive" as const, label: "Ativas", icon: Zap, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  { key: "totalPaused" as const, label: "Pausadas", icon: Pause, color: "text-amber-500", bg: "bg-amber-500/10" },
  { key: "leadsImpacted" as const, label: "Leads Impactados", icon: Users, color: "text-primary", bg: "bg-primary/10" },
  { key: "messagesSent" as const, label: "Mensagens Enviadas", icon: MessageSquare, color: "text-primary", bg: "bg-primary/10" },
  { key: "tasksCreated" as const, label: "Tarefas Criadas", icon: CheckSquare, color: "text-primary", bg: "bg-primary/10" },
  { key: "conversions" as const, label: "Conversões", icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10" },
];

export function AutomationDashboard({ stats }: Props) {
  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 stagger-children">
      {statItems.map((item) => (
        <Card key={item.key} className="group hover:border-primary/20 transition-all">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`h-8 w-8 rounded-lg ${item.bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                <item.icon className={`h-4 w-4 ${item.color}`} />
              </div>
            </div>
            <div className="text-2xl font-bold font-display counter-enter">
              {stats[item.key]}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">{item.label}</p>
          </CardContent>
        </Card>
      ))}
      <Card className="col-span-2 sm:col-span-3 lg:col-span-6 bg-primary/5 border-primary/10">
        <CardContent className="p-3 flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">Taxa de resposta:</span>
            <span className="font-semibold">{stats.avgResponseRate}%</span>
          </div>
          {stats.nextExecution && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">Próxima execução:</span>
              <span className="font-semibold">
                {format(new Date(stats.nextExecution), "HH:mm", { locale: ptBR })}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
