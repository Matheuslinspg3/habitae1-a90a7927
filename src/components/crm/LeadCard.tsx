import { memo, useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Home, User, Clock, AlertTriangle, Flame, Snowflake, Sun, Zap, UserX } from 'lucide-react';
import { LeadQuickActions } from './LeadQuickActions';
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Lead } from '@/hooks/useLeads';

interface LeadCardProps {
  lead: Lead;
  onClick?: () => void;
  onChangeTemperature?: (leadId: string, temp: string) => void;
}

const TEMPERATURE_CONFIG: Record<string, {
  borderClass: string;
  icon: typeof Flame;
  label: string;
  badgeClass: string;
}> = {
  frio: {
    borderClass: 'border-l-[3px] border-l-blue-400',
    icon: Snowflake,
    label: 'Frio',
    badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  },
  morno: {
    borderClass: 'border-l-[3px] border-l-amber-400',
    icon: Sun,
    label: 'Morno',
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  },
  quente: {
    borderClass: 'border-l-[3px] border-l-orange-500',
    icon: Flame,
    label: 'Quente',
    badgeClass: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
  },
  prioridade: {
    borderClass: 'border-l-[3px] border-l-red-500',
    icon: Zap,
    label: 'Prioridade',
    badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
  },
};

const DEFAULT_TEMP_CONFIG = {
  borderClass: 'border-l-[3px] border-l-muted',
  icon: null as any,
  label: '',
  badgeClass: '',
};

function formatCurrency(value: number | null | undefined) {
  if (!value) return null;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function LeadCardComponent({ lead, onClick, onChangeTemperature }: LeadCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: lead.id,
    data: { lead },
  });

  const style = useMemo(() => ({
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  }), [transform, transition, isDragging]);

  const formattedValue = formatCurrency(lead.estimated_value);
  const timeAgo = useMemo(() => formatDistanceToNow(new Date(lead.created_at), {
    addSuffix: true,
    locale: ptBR,
  }), [lead.created_at]);

  const daysSinceUpdate = useMemo(() => differenceInDays(new Date(), new Date(lead.updated_at)), [lead.updated_at]);
  const isStale = daysSinceUpdate >= 7;

  // Staleness color: green < 7 days, yellow 7-13 days, red >= 14 days
  const stalenessClass = useMemo(() => {
    if (daysSinceUpdate >= 14) return 'bg-red-50 dark:bg-red-950/30';
    if (daysSinceUpdate >= 7) return 'bg-amber-50 dark:bg-amber-950/30';
    return 'bg-emerald-50/50 dark:bg-emerald-950/20';
  }, [daysSinceUpdate]);

  const tempConfig = TEMPERATURE_CONFIG[lead.temperature || ''] || DEFAULT_TEMP_CONFIG;
  const TempIcon = tempConfig.icon;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${stalenessClass} ${tempConfig.borderClass} ${isDragging ? 'shadow-lg' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-3 space-y-2">
        {/* Header: Temperature badge + Type + Value */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            {TempIcon && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${tempConfig.badgeClass}`}>
                <TempIcon className="h-3 w-3" />
                {tempConfig.label}
              </span>
            )}
            {!lead.broker_id && (
              <Badge variant="outline" className="text-[10px] gap-0.5 px-1.5 py-0 border-amber-400 text-amber-600 dark:text-amber-400">
                <UserX className="h-2.5 w-2.5" />
                Sem corretor
              </Badge>
            )}
            {isStale && (
              <Badge variant="destructive" className="text-[10px] gap-0.5 px-1.5 py-0">
                <AlertTriangle className="h-2.5 w-2.5" />
                Parado
              </Badge>
            )}
          </div>
          {formattedValue && (
            <span className="text-xs font-bold text-foreground shrink-0">
              {formattedValue}
            </span>
          )}
        </div>

        {/* Name */}
        <p className="font-semibold text-sm truncate">{lead.name}</p>

        {/* Source indicator */}
        {lead.source && (
          <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded font-medium ${
            lead.source === 'anuncio'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
              : lead.source === 'RD Station' 
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' 
                : lead.source === 'RD Station (Webhook)' 
                  ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300'
                  : 'text-muted-foreground bg-muted/60'
          }`}>
            via {lead.source}
          </span>
        )}

        {/* Quick Actions row */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground truncate max-w-[120px]">
            {lead.phone || lead.email || ''}
          </span>
          <LeadQuickActions
            phone={lead.phone}
            email={lead.email}
            temperature={lead.temperature}
            onChangeTemperature={onChangeTemperature ? (temp) => onChangeTemperature(lead.id, temp) : undefined}
            compact
          />
        </div>

        {/* Footer with property/broker and time */}
        <div className="flex items-center justify-between pt-1.5 border-t border-border/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
            {lead.property && (
              <div className="flex items-center gap-1">
                <Home className="h-3 w-3 text-primary/60" />
                <span className="truncate max-w-[80px]">{lead.property.title}</span>
              </div>
            )}
            {lead.broker && (
              <div className="flex items-center gap-1">
                <User className="h-3 w-3 text-primary/60" />
                <span className="truncate max-w-[60px]">{lead.broker.full_name}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
            <Clock className="h-2.5 w-2.5" />
            <span>{timeAgo}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export const LeadCard = memo(LeadCardComponent);
