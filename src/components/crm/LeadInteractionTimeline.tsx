import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Phone, Mail, MapPin, MessageCircle, Users, FileText, Plus, Loader2, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Switch } from '@/components/ui/switch';
import {
  useLeadInteractions,
  INTERACTION_TYPES,
  type InteractionType,
} from '@/hooks/useLeadInteractions';

const ICON_MAP: Record<string, React.ElementType> = {
  Phone, Mail, MapPin, MessageCircle, Users, FileText,
};

interface LeadInteractionTimelineProps {
  leadId: string | null;
  leadName?: string;
}

export function LeadInteractionTimeline({ leadId, leadName }: LeadInteractionTimelineProps) {
  const { interactions, isLoading, createInteraction, isCreating } = useLeadInteractions(leadId);
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<InteractionType>('ligacao');
  const [description, setDescription] = useState('');
  const [addToSchedule, setAddToSchedule] = useState(false);
  const [occurredAt, setOccurredAt] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });

  const handleSubmit = () => {
    if (!description.trim()) return;
    createInteraction(
      {
        type,
        description: description.trim(),
        occurred_at: new Date(occurredAt).toISOString(),
        addToSchedule,
        leadName,
      },
      {
        onSuccess: () => {
          setDescription('');
          setAddToSchedule(false);
          setShowForm(false);
        },
      }
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Interações</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowForm(!showForm)}
          className="h-7 text-xs"
        >
          <Plus className="h-3 w-3 mr-1" />
          Registrar
        </Button>
      </div>

      {showForm && (
        <div className="space-y-2 p-3 rounded-md border bg-muted/30">
          <Select value={type} onValueChange={(v) => setType(v as InteractionType)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTERACTION_TYPES.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Data e horário
            </Label>
            <Input
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descreva a interação..."
            className="resize-none text-sm"
            rows={2}
          />
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground flex items-center gap-2 cursor-pointer">
              <Switch
                checked={addToSchedule}
                onCheckedChange={setAddToSchedule}
                className="scale-75"
              />
              <Calendar className="h-3 w-3" />
              Incluir na agenda
            </Label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)} className="h-7 text-xs">
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={isCreating || !description.trim()} className="h-7 text-xs">
              {isCreating && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Salvar
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        // PERF: UX — skeleton timeline items
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-3 py-2">
              <Skeleton className="w-7 h-7 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : interactions.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma interação registrada.</p>
      ) : (
        <div className="space-y-0">
          {interactions.map((interaction, index) => {
            const typeInfo = INTERACTION_TYPES.find((t) => t.id === interaction.type);
            const Icon = typeInfo ? ICON_MAP[typeInfo.icon] || FileText : FileText;

            return (
              <div key={interaction.id} className="flex gap-3 py-2">
                <div className="flex flex-col items-center">
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  {index < interactions.length - 1 && (
                    <div className="w-px flex-1 bg-border mt-1" />
                  )}
                </div>
                <div className="flex-1 min-w-0 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{typeInfo?.label || interaction.type}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(interaction.occurred_at || interaction.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">
                    {interaction.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
