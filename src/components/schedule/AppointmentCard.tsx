import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, MapPin, User, Home, Check, MoreVertical, Phone, Mail, MessageCircle, Users as UsersIcon, FileText, CalendarCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { INTERACTION_TYPES, type InteractionType } from '@/hooks/useLeadInteractions';
import type { Appointment } from '@/hooks/useAppointments';

const INTERACTION_ICON_MAP: Record<string, React.ElementType> = {
  Phone, Mail, MapPin, MessageCircle, Users: UsersIcon, FileText,
};

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
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [interactionType, setInteractionType] = useState<InteractionType>('ligacao');
  const [interactionDesc, setInteractionDesc] = useState(appointment.description || '');
  const [isRegistering, setIsRegistering] = useState(false);

  // Find interaction type info if this appointment is linked to an interaction
  const linkedInteractionType = appointment.interaction_id
    ? INTERACTION_TYPES.find(t => {
        // Derive type from title pattern "TypeLabel - LeadName"
        const titlePrefix = appointment.title.split(' - ')[0];
        return t.label === titlePrefix;
      })
    : null;
  const InteractionIcon = linkedInteractionType
    ? INTERACTION_ICON_MAP[linkedInteractionType.icon] || CalendarCheck
    : null;

  const handleRegisterAsInteraction = async () => {
    if (!user || !appointment.lead_id) return;
    setIsRegistering(true);
    try {
      const { data: interaction, error } = await supabase
        .from('lead_interactions')
        .insert({
          lead_id: appointment.lead_id,
          created_by: user.id,
          type: interactionType,
          description: interactionDesc.trim() || appointment.title,
          occurred_at: appointment.start_time,
          appointment_id: appointment.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Link appointment back
      await supabase
        .from('appointments')
        .update({ interaction_id: interaction.id })
        .eq('id', appointment.id);

      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['lead-interactions', appointment.lead_id] });
      toast({ title: 'Interação registrada no CRM' });
      setShowRegisterDialog(false);
    } catch (err: any) {
      toast({ title: 'Erro ao registrar interação', description: err.message, variant: 'destructive' });
    } finally {
      setIsRegistering(false);
    }
  };

  const canRegisterAsInteraction = appointment.lead_id && !appointment.interaction_id;

  return (
    <>
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
                <div className="flex items-center gap-2 min-w-0">
                  <h4 className={cn(
                    'font-medium truncate',
                    appointment.completed && 'line-through text-muted-foreground'
                  )}>
                    {appointment.title}
                  </h4>
                  {InteractionIcon && (
                    <Badge variant="secondary" className="shrink-0 gap-1 text-xs px-1.5 py-0.5">
                      <InteractionIcon className="h-3 w-3" />
                      {linkedInteractionType?.label}
                    </Badge>
                  )}
                </div>
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
                    {canRegisterAsInteraction && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setShowRegisterDialog(true)}>
                          <CalendarCheck className="h-4 w-4 mr-2" />
                          Registrar como interação
                        </DropdownMenuItem>
                      </>
                    )}
                    {appointment.lead_id && (
                      <DropdownMenuItem onClick={() => navigate(`/crm?lead=${appointment.lead_id}`)}>
                        <User className="h-4 w-4 mr-2" />
                        Ver no CRM
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
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

      {/* Register as Interaction Dialog */}
      <Dialog open={showRegisterDialog} onOpenChange={setShowRegisterDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar como interação</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={interactionType} onValueChange={(v) => setInteractionType(v as InteractionType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERACTION_TYPES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              value={interactionDesc}
              onChange={(e) => setInteractionDesc(e.target.value)}
              placeholder="Descrição da interação..."
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowRegisterDialog(false)}>Cancelar</Button>
              <Button onClick={handleRegisterAsInteraction} disabled={isRegistering}>
                {isRegistering ? 'Salvando...' : 'Registrar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
