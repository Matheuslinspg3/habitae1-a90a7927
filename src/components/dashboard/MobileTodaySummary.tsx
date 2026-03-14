import { Card, CardContent } from "@/components/ui/card";
import { CalendarCheck, Clock, AlertTriangle, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTasks } from "@/hooks/useTasks";
import { useAppointments } from "@/hooks/useAppointments";
import { useLeads } from "@/hooks/useLeads";
import { useDemo } from "@/contexts/DemoContext";
import { isToday, format } from "date-fns";
import { cn } from "@/lib/utils";
import { trackQuickAction } from "@/hooks/useAnalytics";

/**
 * Mobile-only "Resumo do Dia" card — shows at-a-glance what needs attention today.
 */
export function MobileTodaySummary() {
  const navigate = useNavigate();
  const { isDemoMode } = useDemo();
  const { tasks, isLoading: loadingTasks } = useTasks();
  const { appointments, isLoading: loadingAppts } = useAppointments();
  const { leads, isLoading: loadingLeads } = useLeads();

  const isLoading = !isDemoMode && (loadingTasks || loadingAppts || loadingLeads);

  // Today's tasks
  const todayTasks = tasks.filter(t => t.due_date && isToday(new Date(t.due_date)));
  const pendingTasks = todayTasks.filter(t => !t.completed).length;
  const completedTasks = todayTasks.filter(t => t.completed).length;

  // Today's appointments
  const now = new Date();
  const todayAppts = appointments.filter(a => isToday(new Date(a.start_time)) && !a.completed);
  const nextAppt = todayAppts
    .filter(a => new Date(a.start_time) >= now)
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())[0];

  // Leads needing attention (new in last 24h without interaction)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const newLeads = leads.filter(l =>
    new Date(l.created_at) >= oneDayAgo &&
    !["fechado_ganho", "fechado_perdido"].includes(l.stage)
  ).length;

  const items = [
    {
      icon: CalendarCheck,
      label: pendingTasks > 0 ? `${pendingTasks} tarefa${pendingTasks > 1 ? 's' : ''} pendente${pendingTasks > 1 ? 's' : ''}` : "Sem tarefas hoje",
      sub: completedTasks > 0 ? `${completedTasks} concluída${completedTasks > 1 ? 's' : ''}` : undefined,
      action: () => { trackQuickAction("mobile_today_tasks"); navigate("/agenda"); },
      highlight: pendingTasks > 0,
    },
    {
      icon: Clock,
      label: nextAppt ? `Próximo: ${format(new Date(nextAppt.start_time), "HH:mm")}` : todayAppts.length > 0 ? `${todayAppts.length} compromisso${todayAppts.length > 1 ? 's' : ''}` : "Sem compromissos",
      sub: nextAppt?.title,
      action: () => { trackQuickAction("mobile_today_appointments"); navigate("/agenda"); },
      highlight: !!nextAppt,
    },
    ...(newLeads > 0 ? [{
      icon: AlertTriangle,
      label: `${newLeads} lead${newLeads > 1 ? 's' : ''} novo${newLeads > 1 ? 's' : ''}`,
      sub: "Aguardando atenção",
      action: () => { trackQuickAction("mobile_today_leads"); navigate("/crm"); },
      highlight: true,
    }] : []),
  ];

  if (isLoading) {
    return (
      <div className="md:hidden">
        <Card className="border-border/40">
          <CardContent className="p-3">
            <div className="space-y-2.5">
              {[1, 2].map(i => (
                <div key={i} className="h-10 animate-shimmer rounded-lg" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="md:hidden">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        Resumo do dia
      </p>
      <Card className="border-border/40 overflow-hidden">
        <CardContent className="p-0">
          {items.map((item, i) => (
            <button
              key={i}
              onClick={item.action}
              className={cn(
                "w-full flex items-center gap-3 px-3.5 py-3 text-left",
                "active:bg-muted/60 transition-colors touch-manipulation",
                i > 0 && "border-t border-border/30"
              )}
            >
              <div className={cn(
                "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                item.highlight ? "bg-primary/10" : "bg-muted/50"
              )}>
                <item.icon className={cn("h-4 w-4", item.highlight ? "text-primary" : "text-muted-foreground")} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground leading-tight">{item.label}</p>
                {item.sub && (
                  <p className="text-[11px] text-muted-foreground truncate">{item.sub}</p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
