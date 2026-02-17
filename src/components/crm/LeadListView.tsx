import { memo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Phone, Mail, Home, User, ChevronRight, Flame, Snowflake, Sun, Zap, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Lead } from '@/hooks/useLeads';
import type { LeadStage } from '@/hooks/useLeadStages';

interface LeadListViewProps {
  leads: Lead[];
  leadStages: LeadStage[];
  onLeadClick: (lead: Lead) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  selectionMode?: boolean;
}

const TEMPERATURE_STYLES: Record<string, { icon: typeof Flame; badgeClass: string; label: string }> = {
  frio: { icon: Snowflake, badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300', label: 'Frio' },
  morno: { icon: Sun, badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300', label: 'Morno' },
  quente: { icon: Flame, badgeClass: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300', label: 'Quente' },
  prioridade: { icon: Zap, badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300', label: 'Prioridade' },
};

function formatCurrency(value: number | null | undefined) {
  if (!value) return null;
  if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}k`;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(value);
}

function LeadListItem({ lead, stage, onClick, isSelected, onToggleSelect, selectionMode }: {
  lead: Lead;
  stage?: LeadStage;
  onClick: () => void;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  selectionMode?: boolean;
}) {
  const tempStyle = TEMPERATURE_STYLES[lead.temperature || ''];
  const TempIcon = tempStyle?.icon;
  const formattedValue = formatCurrency(lead.estimated_value);
  const timeAgo = formatDistanceToNow(new Date(lead.updated_at), { addSuffix: false, locale: ptBR });

  const handleCheckboxClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSelect?.(lead.id);
  }, [lead.id, onToggleSelect]);

  const handleClick = useCallback(() => {
    if (selectionMode) {
      onToggleSelect?.(lead.id);
    } else {
      onClick();
    }
  }, [selectionMode, lead.id, onToggleSelect, onClick]);

  return (
    <Card
      className={`cursor-pointer hover:bg-accent/50 transition-colors active:scale-[0.995] ${isSelected ? 'ring-2 ring-primary bg-primary/5' : ''}`}
      onClick={handleClick}
    >
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-3">
          {/* Checkbox */}
          <div className="shrink-0" onClick={handleCheckboxClick}>
            <Checkbox
              checked={!!isSelected}
              className="data-[state=checked]:bg-primary"
            />
          </div>

          {/* Stage color indicator */}
          {stage && (
            <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: stage.color || '#64748b' }} />
          )}

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm truncate">{lead.name}</p>
              {TempIcon && (
                <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${tempStyle.badgeClass}`}>
                  <TempIcon className="h-2.5 w-2.5" />
                  {tempStyle.label}
                </span>
              )}
              {lead.lead_type && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0" style={{ backgroundColor: lead.lead_type.color || undefined }}>
                  {lead.lead_type.name}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {stage && (
                <span className="text-xs text-muted-foreground font-medium">{stage.name}</span>
              )}
              {lead.phone && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  <span className="truncate max-w-[120px]">{lead.phone}</span>
                </div>
              )}
              {lead.email && (
                <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  <span className="truncate max-w-[150px]">{lead.email}</span>
                </div>
              )}
              {lead.broker && (
                <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                  <User className="h-3 w-3" />
                  <span className="truncate max-w-[80px]">{lead.broker.full_name}</span>
                </div>
              )}
              {lead.property && (
                <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                  <Home className="h-3 w-3" />
                  <span className="truncate max-w-[80px]">{lead.property.title}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3 shrink-0">
            {formattedValue && (
              <span className="text-xs font-bold text-foreground hidden sm:block">{formattedValue}</span>
            )}
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="h-2.5 w-2.5" />
              <span>{timeAgo}</span>
            </div>
            {!selectionMode && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LeadListViewComponent({ leads, leadStages, onLeadClick, selectedIds, onToggleSelect, selectionMode }: LeadListViewProps) {
  const stageMap = new Map(leadStages.map(s => [s.id, s]));

  if (leads.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">Nenhum lead encontrado com os filtros atuais.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground px-1">
        {leads.length} lead{leads.length !== 1 ? 's' : ''} encontrado{leads.length !== 1 ? 's' : ''}
      </p>
      <div className="space-y-1.5">
        {leads.map((lead) => (
          <LeadListItem
            key={lead.id}
            lead={lead}
            stage={stageMap.get(lead.lead_stage_id || '')}
            onClick={() => onLeadClick(lead)}
            isSelected={selectedIds?.has(lead.id)}
            onToggleSelect={onToggleSelect}
            selectionMode={selectionMode}
          />
        ))}
      </div>
    </div>
  );
}

export const LeadListView = memo(LeadListViewComponent);
