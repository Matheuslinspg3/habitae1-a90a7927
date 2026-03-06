import { memo, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Phone, ChevronRight, Flame, Snowflake, Sun, Zap } from 'lucide-react';
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Lead } from '@/hooks/useLeads';

interface MobileLeadCardProps {
  lead: Lead;
  onClick: () => void;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  selectionMode?: boolean;
}

const TEMPERATURE_STYLES: Record<string, { border: string; icon: typeof Flame; badgeClass: string; label: string }> = {
  frio: { border: 'border-l-[3px] border-l-blue-400', icon: Snowflake, badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300', label: 'Frio' },
  morno: { border: 'border-l-[3px] border-l-amber-400', icon: Sun, badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300', label: 'Morno' },
  quente: { border: 'border-l-[3px] border-l-orange-500', icon: Flame, badgeClass: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300', label: 'Quente' },
  prioridade: { border: 'border-l-[3px] border-l-red-500', icon: Zap, badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300', label: 'Prioridade' },
};

function formatCurrency(value: number | null | undefined) {
  if (!value) return null;
  if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}k`;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(value);
}

function MobileLeadCardComponent({ lead, onClick, isSelected, onToggleSelect, selectionMode }: MobileLeadCardProps) {
  const formattedValue = formatCurrency(lead.estimated_value);
  const timeAgo = formatDistanceToNow(new Date(lead.created_at), { addSuffix: false, locale: ptBR });

  const tempStyle = TEMPERATURE_STYLES[lead.temperature || ''];
  const TempIcon = tempStyle?.icon;

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

  const handleLongPress = useCallback(() => {
    if (!selectionMode) {
      onToggleSelect?.(lead.id);
    }
  }, [selectionMode, lead.id, onToggleSelect]);

  // Staleness color coding
  const daysSinceUpdate = useMemo(() => differenceInDays(new Date(), new Date(lead.updated_at)), [lead.updated_at]);
  const stalenessClass = useMemo(() => {
    if (daysSinceUpdate >= 14) return 'bg-red-50 dark:bg-red-950/30';
    if (daysSinceUpdate >= 7) return 'bg-amber-50 dark:bg-amber-950/30';
    return 'bg-emerald-50/50 dark:bg-emerald-950/20';
  }, [daysSinceUpdate]);

  return (
    <Card 
      className={`cursor-pointer hover:bg-accent/50 transition-colors active:scale-[0.99] ${tempStyle?.border || ''} ${stalenessClass} ${isSelected ? 'ring-2 ring-primary' : ''}`}
      onClick={handleClick}
      onContextMenu={(e) => { e.preventDefault(); handleLongPress(); }}
    >
      <CardContent className="p-4 flex items-center gap-3">
        {/* Checkbox - always visible when in selection mode */}
        {(selectionMode || isSelected) && (
          <div className="shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center" onClick={handleCheckboxClick}>
            <Checkbox
              checked={!!isSelected}
              className="data-[state=checked]:bg-primary h-5 w-5"
            />
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm truncate">{lead.name}</p>
            {TempIcon && (
              <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${tempStyle.badgeClass}`}>
                <TempIcon className="h-3 w-3" />
                {tempStyle.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            {lead.phone && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Phone className="h-3.5 w-3.5" />
                <span className="truncate max-w-[120px]">{lead.phone}</span>
              </div>
            )}
            <span className="text-xs text-muted-foreground">• {timeAgo}</span>
            {lead.source && (
              <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${
                lead.source === 'RD Station' 
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                  : lead.source === 'RD Station (Webhook)'
                    ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300'
                    : 'text-muted-foreground bg-muted/60'
              }`}>
                {lead.source}
              </span>
            )}
          </div>
        </div>
        
        {/* Right side */}
        <div className="flex items-center gap-2 shrink-0">
          {formattedValue && (
            <span className="text-sm font-semibold text-foreground">
              {formattedValue}
            </span>
          )}
          {!selectionMode && <ChevronRight className="h-5 w-5 text-muted-foreground" />}
        </div>
      </CardContent>
    </Card>
  );
}

export const MobileLeadCard = memo(MobileLeadCardComponent);
