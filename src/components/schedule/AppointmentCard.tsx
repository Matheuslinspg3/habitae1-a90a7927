import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, MapPin, User, Home, Check, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Appointment } from '@/hooks/useAppointments';

interface AppointmentCardProps {
  appointment: Appointment;
  onToggleComplete: (id: string, completed: boolean) => void;
  onEdit: (appointment: Appointment) => void;
  onDelete: (id: string) => void;
}

export function AppointmentCard({
  appointment,
  onToggleComplete,
  onEdit,
  onDelete,
}: AppointmentCardProps) {
  const startTime = new Date(appointment.start_time);
  const endTime = new Date(appointment.end_time);

  return (
    <Card className={cn(
      'transition-all border-l-4 border-l-primary/60 hover:shadow-md hover:border-l-primary',
      appointment.completed && 'opacity-60 border-l-muted-foreground/30'
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Button
            variant="outline"
            size="icon"
            className={cn(
              'h-8 w-8 shrink-0 rounded-full',
              appointment.completed && 'bg-primary text-primary-foreground'
            )}
            onClick={() => onToggleComplete(appointment.id, !appointment.completed)}
          >
            {appointment.completed && <Check className="h-4 w-4" />}
          </Button>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h4 className={cn(
                'font-medium truncate',
                appointment.completed && 'line-through text-muted-foreground'
              )}>
                {appointment.title}
              </h4>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(appointment)}>
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onDelete(appointment.id)}
                    className="text-destructive"
                  >
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-info" />
                <span>
                  {format(startTime, 'HH:mm', { locale: ptBR })} - {format(endTime, 'HH:mm', { locale: ptBR })}
                </span>
              </div>

              {appointment.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-accent" />
                  <span className="truncate">{appointment.location}</span>
                </div>
              )}

              {appointment.lead && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span className="truncate">{appointment.lead.name}</span>
                </div>
              )}

              {appointment.property && (
                <div className="flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  <span className="truncate">{appointment.property.title}</span>
                </div>
              )}
            </div>

            {appointment.description && (
              <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                {appointment.description}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
