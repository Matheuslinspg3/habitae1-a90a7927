import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, ArrowRight, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppointments } from "@/hooks/useAppointments";
import { useDemo } from "@/contexts/DemoContext";
import { format, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

function formatDateLabel(date: Date): string {
  if (isToday(date)) return 'Hoje';
  if (isTomorrow(date)) return 'Amanhã';
  return format(date, "EEE, d MMM", { locale: ptBR });
}

export function UpcomingAppointments() {
  const navigate = useNavigate();
  const { isDemoMode } = useDemo();
  const { appointments, isLoading } = useAppointments();

  // Get upcoming (not completed, from now onwards), limit 5
  const now = new Date();
  const upcoming = appointments
    .filter(a => !a.completed && new Date(a.start_time) >= new Date(now.getFullYear(), now.getMonth(), now.getDate()))
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .slice(0, 5);

  if (isLoading && !isDemoMode) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xl font-display">Próximos Compromissos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (upcoming.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-xl font-display">Próximos Compromissos</CardTitle>
        <CardDescription>Visitas e reuniões agendadas</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {upcoming.map(apt => {
          const startDate = new Date(apt.start_time);
          return (
            <div
              key={apt.id}
              className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex flex-col items-center min-w-[48px] text-center">
                <span className="text-[10px] uppercase text-muted-foreground font-medium">
                  {formatDateLabel(startDate)}
                </span>
                <span className="text-sm font-semibold">
                  {format(startDate, 'HH:mm')}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight truncate">{apt.title}</p>
                {apt.location && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{apt.location}</span>
                  </p>
                )}
                {apt.lead && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    👤 {(apt.lead as any).name}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        <Button
          variant="ghost"
          className="w-full justify-between text-muted-foreground hover:text-foreground"
          onClick={() => navigate('/agenda')}
        >
          Ver agenda completa
          <ArrowRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
