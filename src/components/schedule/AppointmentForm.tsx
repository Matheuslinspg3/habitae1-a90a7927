import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppointments, type Appointment, type AppointmentFormData } from '@/hooks/useAppointments';
import { useLeads } from '@/hooks/useLeads';
import { useProperties } from '@/hooks/useProperties';
import { useBrokers } from '@/hooks/useBrokers';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { INTERACTION_TYPES, type InteractionType } from '@/hooks/useLeadInteractions';
import { CalendarCheck } from 'lucide-react';

interface AppointmentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment?: Appointment | null;
  selectedDate?: Date;
}

export function AppointmentForm({ open, onOpenChange, appointment, selectedDate }: AppointmentFormProps) {
  const { createAppointment, updateAppointment, isCreating, isUpdating } = useAppointments();
  const { leads } = useLeads();
  const { properties } = useProperties();
  const { brokers } = useBrokers();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const getDefaultDate = () => {
    const date = selectedDate || new Date();
    return date.toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState<AppointmentFormData>({
    title: '',
    start_time: `${getDefaultDate()}T09:00`,
    end_time: `${getDefaultDate()}T10:00`,
    location: null,
    description: null,
    lead_id: null,
    property_id: null,
    assigned_to: null,
  });

  const [registerAsInteraction, setRegisterAsInteraction] = useState(false);
  const [interactionType, setInteractionType] = useState<InteractionType>('ligacao');

  useEffect(() => {
    if (appointment) {
      setFormData({
        title: appointment.title,
        start_time: appointment.start_time.slice(0, 16),
        end_time: appointment.end_time.slice(0, 16),
        location: appointment.location || null,
        description: appointment.description || null,
        lead_id: appointment.lead_id || null,
        property_id: appointment.property_id || null,
        assigned_to: appointment.assigned_to || null,
      });
      setRegisterAsInteraction(false);
    } else {
      const dateStr = getDefaultDate();
      setFormData({
        title: '',
        start_time: `${dateStr}T09:00`,
        end_time: `${dateStr}T10:00`,
        location: null,
        description: null,
        lead_id: null,
        property_id: null,
        assigned_to: null,
      });
      setRegisterAsInteraction(false);
    }
  }, [appointment, open, selectedDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (appointment) {
      updateAppointment({ ...formData, id: appointment.id });
    } else {
      createAppointment(formData, {
        onSuccess: async (result: any) => {
          // If registerAsInteraction is on, create the interaction
          if (registerAsInteraction && formData.lead_id && user && result?.id) {
            try {
              const { data: interaction, error } = await supabase
                .from('lead_interactions')
                .insert({
                  lead_id: formData.lead_id,
                  created_by: user.id,
                  type: interactionType,
                  description: formData.description || formData.title,
                  occurred_at: formData.start_time,
                  appointment_id: result.id,
                })
                .select()
                .single();

              if (!error && interaction) {
                await supabase
                  .from('appointments')
                  .update({ interaction_id: interaction.id })
                  .eq('id', result.id);

                queryClient.invalidateQueries({ queryKey: ['lead-interactions', formData.lead_id] });
                toast({ title: 'Interação registrada no CRM' });
              }
            } catch {
              // Non-blocking — appointment was already created
            }
          }
        },
      });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {appointment ? 'Editar Compromisso' : 'Novo Compromisso'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Título *</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ex: Visita ao imóvel"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Início *</Label>
              <Input
                type="datetime-local"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Fim *</Label>
              <Input
                type="datetime-local"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Local</Label>
            <Input
              value={formData.location || ''}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="Ex: Rua das Flores, 123"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Lead Vinculado</Label>
              <Select
                value={formData.lead_id || 'none'}
                onValueChange={(value) =>
                  setFormData({ ...formData, lead_id: value === 'none' ? null : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {leads.map((lead) => (
                    <SelectItem key={lead.id} value={lead.id}>
                      {lead.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Imóvel Vinculado</Label>
              <Select
                value={formData.property_id || 'none'}
                onValueChange={(value) =>
                  setFormData({ ...formData, property_id: value === 'none' ? null : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {properties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Responsável</Label>
            <Select
              value={formData.assigned_to || 'none'}
              onValueChange={(value) =>
                setFormData({ ...formData, assigned_to: value === 'none' ? null : value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {brokers.map((broker) => (
                  <SelectItem key={broker.id} value={broker.id}>
                    {broker.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detalhes do compromisso..."
              rows={3}
            />
          </div>

          {/* Register as interaction toggle - only for new appointments with lead */}
          {!appointment && formData.lead_id && (
            <div className="space-y-3 p-3 rounded-md border bg-muted/30">
              <Label className="text-sm flex items-center gap-2 cursor-pointer">
                <Switch
                  checked={registerAsInteraction}
                  onCheckedChange={setRegisterAsInteraction}
                />
                <CalendarCheck className="h-4 w-4" />
                Registrar como interação do lead
              </Label>
              {registerAsInteraction && (
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
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isCreating || isUpdating}>
              {isCreating || isUpdating ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
