import { format, isPast, isToday, isTomorrow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, MoreVertical, User, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Task } from '@/hooks/useTasks';

interface TaskCardProps {
  task: Task;
  onToggleComplete: (id: string, completed: boolean) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}

const priorityConfig = {
  baixa: { label: 'Baixa', className: 'bg-muted text-muted-foreground' },
  media: { label: 'Média', className: 'bg-warning/10 text-warning' },
  alta: { label: 'Alta', className: 'bg-destructive/10 text-destructive' },
};

export function TaskCard({ task, onToggleComplete, onEdit, onDelete }: TaskCardProps) {
  const priority = task.priority as keyof typeof priorityConfig;
  const priorityInfo = priorityConfig[priority] || priorityConfig.media;

  const getDueDateLabel = () => {
    if (!task.due_date) return null;
    const dueDate = new Date(task.due_date);
    
    if (isToday(dueDate)) {
      return { label: 'Hoje', className: 'text-yellow-600' };
    }
    if (isTomorrow(dueDate)) {
      return { label: 'Amanhã', className: 'text-yellow-600' };
    }
    if (isPast(dueDate) && !task.completed) {
      return { label: 'Atrasada', className: 'text-destructive' };
    }
    return { label: format(dueDate, "dd/MM", { locale: ptBR }), className: 'text-muted-foreground' };
  };

  const dueInfo = getDueDateLabel();

  return (
    <Card className={cn(
      'transition-all border-l-4 hover:shadow-md',
      priority === 'alta' ? 'border-l-destructive/60 hover:border-l-destructive' :
      priority === 'media' ? 'border-l-warning/60 hover:border-l-warning' :
      'border-l-success/60 hover:border-l-success',
      task.completed && 'opacity-60 border-l-muted-foreground/30'
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Button
            variant="outline"
            size="icon"
            className={cn(
              'h-8 w-8 shrink-0 rounded-full',
              task.completed && 'bg-primary text-primary-foreground'
            )}
            onClick={() => onToggleComplete(task.id, !task.completed)}
          >
            {task.completed && <Check className="h-4 w-4" />}
          </Button>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h4 className={cn(
                'font-medium',
                task.completed && 'line-through text-muted-foreground'
              )}>
                {task.title}
              </h4>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(task)}>
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onDelete(task.id)}
                    className="text-destructive"
                  >
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className={priorityInfo.className}>
                {priorityInfo.label}
              </Badge>

              {dueInfo && (
                <span className={cn('text-xs flex items-center gap-1', dueInfo.className)}>
                  <Calendar className="h-3 w-3" />
                  {dueInfo.label}
                </span>
              )}

              {task.lead && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {task.lead.name}
                </span>
              )}
            </div>

            {task.description && (
              <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                {task.description}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
