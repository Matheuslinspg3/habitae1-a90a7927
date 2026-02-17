import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, ArrowRight, Clock, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDemo } from "@/contexts/DemoContext";
import { getTodayDemoTasks, getTodayDemoAppointments } from "@/data/demoData";
import { format, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useTasks } from "@/hooks/useTasks";
import { useAppointments } from "@/hooks/useAppointments";
import { Skeleton } from "@/components/ui/skeleton";

interface TodayItem {
  id: string;
  time: string;
  title: string;
  type: 'task' | 'appointment';
  completed: boolean;
  priority?: string;
  location?: string;
}

const priorityColors: Record<string, string> = {
  alta: 'text-red-500',
  media: 'text-amber-500',
  baixa: 'text-blue-500',
};

export function TodayTasks() {
  const navigate = useNavigate();
  const { isDemoMode } = useDemo();
  const { tasks, toggleComplete, isLoading: loadingTasks } = useTasks();
  const { appointments, isLoading: loadingAppointments } = useAppointments();

  const isLoading = !isDemoMode && (loadingTasks || loadingAppointments);

  // Build today items
  const todayItems: TodayItem[] = (() => {
    if (isDemoMode) {
      const demoTasks = getTodayDemoTasks();
      const demoAppointments = getTodayDemoAppointments();
      return [
        ...demoTasks.map(t => ({
          id: t.id,
          time: t.due_date ? format(new Date(t.due_date), 'HH:mm') : '--:--',
          title: t.title,
          type: 'task' as const,
          completed: t.completed,
          priority: t.priority,
        })),
        ...demoAppointments.map(a => ({
          id: a.id,
          time: format(new Date(a.start_time), 'HH:mm'),
          title: a.title,
          type: 'appointment' as const,
          completed: a.completed,
          location: a.location || undefined,
        })),
      ].sort((a, b) => a.time.localeCompare(b.time));
    }

    // Real data
    const todayTasks = tasks
      .filter(t => t.due_date && isToday(new Date(t.due_date)))
      .map(t => ({
        id: t.id,
        time: t.due_date ? format(new Date(t.due_date), 'HH:mm') : '--:--',
        title: t.title,
        type: 'task' as const,
        completed: !!t.completed,
        priority: t.priority || undefined,
      }));

    const todayAppts = appointments
      .filter(a => isToday(new Date(a.start_time)))
      .map(a => ({
        id: a.id,
        time: format(new Date(a.start_time), 'HH:mm'),
        title: a.title,
        type: 'appointment' as const,
        completed: !!a.completed,
        location: a.location || undefined,
      }));

    return [...todayTasks, ...todayAppts].sort((a, b) => a.time.localeCompare(b.time));
  })();

  const handleToggleTask = (id: string, currentCompleted: boolean) => {
    if (isDemoMode) return;
    toggleComplete({ id, completed: !currentCompleted });
  };

  if (isLoading) {
    return (
      <Card className="group">
        <CardHeader>
          <CardTitle className="text-xl font-display">Tarefas do Dia</CardTitle>
          <CardDescription>Seus próximos compromissos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-start gap-3 p-2">
              <Skeleton className="h-4 w-4 mt-0.5 rounded" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (todayItems.length === 0) {
    return (
      <Card className="group">
        <CardHeader>
          <CardTitle className="text-xl font-display">Tarefas do Dia</CardTitle>
          <CardDescription>Seus próximos compromissos</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <Calendar className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="font-medium text-muted-foreground">
              Nenhuma tarefa para hoje
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Suas tarefas e lembretes aparecerão aqui
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="group">
      <CardHeader>
        <CardTitle className="text-xl font-display">Tarefas do Dia</CardTitle>
        <CardDescription>
          {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {todayItems.map((item) => (
          <div
            key={item.id}
            className={cn(
              "flex items-start gap-3 p-2 rounded-lg transition-colors hover:bg-muted/50",
              item.completed && "opacity-60"
            )}
          >
            <div className="flex items-center gap-2 min-w-[50px]">
              {item.type === 'task' ? (
                <Checkbox
                  checked={item.completed}
                  onCheckedChange={() => handleToggleTask(item.id, item.completed)}
                  className="mt-0.5"
                />
              ) : (
                <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
              )}
              <span className="text-sm font-mono text-muted-foreground">
                {item.time}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-sm font-medium leading-tight",
                item.completed && "line-through"
              )}>
                {item.title}
              </p>
              {item.location && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  📍 {item.location}
                </p>
              )}
            </div>
            {item.priority && !item.completed && (
              <AlertCircle className={cn("h-4 w-4", priorityColors[item.priority] || 'text-muted-foreground')} />
            )}
          </div>
        ))}

        <Button
          variant="ghost"
          className="w-full justify-between text-muted-foreground hover:text-foreground"
          onClick={() => navigate('/agenda')}
        >
          Abrir agenda
          <ArrowRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
