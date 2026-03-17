import { memo, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Phone, MessageCircle, ChevronRight, Flame, Snowflake, Sun, Zap, UserX, AlertTriangle, User, Home, Clock } from 'lucide-react';
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { trackQuickAction } from '@/hooks/useAnalytics';
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

  const daysSinceUpdate = useMemo(() => differenceInDays(new Date(), new Date(lead.updated_at)), [lead.updated_at]);
  const stalenessClass = useMemo(() => {
    if (daysSinceUpdate >= 14) return 'bg-red-50 dark:bg-red-950/30';
    if (daysSinceUpdate >= 7) return 'bg-amber-50 dark:bg-amber-950/30';
    return '';
  }, [daysSinceUpdate]);
  const isStale = daysSinceUpdate >= 7;

  const handleCheckboxClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSelect?.(lead.id);
  }, [lead.id, onToggleSelect]);

  const handleClick = useCallback(() => {
    if (selectionMode) {
      onToggleSelect?.(lead.id);
    } else {
      trackQuickAction('mobile_lead_open');
      onClick();
    }
  }, [selectionMode, lead.id, onToggleSelect, onClick]);

  const handleWhatsApp = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!lead.phone) return;
    trackQuickAction('mobile_lead_whatsapp');
    const cleaned = lead.phone.replace(/\D/g, '');
    const number = cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
    window.open(`https://wa.me/${number}`, '_blank');
  }, [lead.phone]);

  const handleCall = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!lead.phone) return;
    trackQuickAction('mobile_lead_call');
    window.open(`tel:${lead.phone}`, '_self');
  }, [lead.phone]);

  return (
    <Card
      className={cn(
        "transition-all active:scale-[0.98] touch-manipulation",
        tempStyle?.border || '',
        stalenessClass,
        isSelected && 'ring-2 ring-primary',
      )}
      onClick={handleClick}
      onContextMenu={(e) => { e.preventDefault(); onToggleSelect?.(lead.id); }}
    >
      <CardContent className="p-3 space-y-2">
        {/* Row 1: Name + badges + value */}
        <div className="flex items-start gap-2">
          {(selectionMode || isSelected) && (
            <div className="shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center -ml-1" onClick={handleCheckboxClick}>
              <Checkbox checked={!!isSelected} className="h-5 w-5" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="font-semibold text-sm truncate">{lead.name}</p>
              {TempIcon && (
                <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0", tempStyle.badgeClass)}>
                  <TempIcon className="h-2.5 w-2.5" />
                  {tempStyle.label}
                </span>
              )}
              {!lead.broker_id && (
                <Badge variant="outline" className="text-[10px] gap-0.5 px-1 py-0 border-amber-400 text-amber-600 dark:text-amber-400">
                  <UserX className="h-2.5 w-2.5" />
                </Badge>
              )}
              {isStale && (
                <Badge variant="destructive" className="text-[10px] gap-0.5 px-1 py-0">
                  <AlertTriangle className="h-2.5 w-2.5" />
                </Badge>
              )}
            </div>
          </div>
          {formattedValue && (
            <span className="text-xs font-bold text-foreground shrink-0 mt-0.5">{formattedValue}</span>
          )}
        </div>

        {/* Row 2: Meta info */}
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
          {lead.broker && (
            <span className="flex items-center gap-0.5 truncate max-w-[100px]">
              <User className="h-3 w-3" />
              {lead.broker.full_name?.split(' ')[0]}
            </span>
          )}
          {lead.property && (
            <span className="flex items-center gap-0.5 truncate max-w-[100px]">
              <Home className="h-3 w-3" />
              {lead.property.title}
            </span>
          )}
          {lead.source && (
            <span className={cn("px-1 py-0.5 rounded font-medium text-[10px]",
              lead.source === 'anuncio' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
              : lead.source === 'RD Station' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
              : lead.source === 'RD Station (Webhook)' ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300'
              : 'bg-muted/60 text-muted-foreground'
            )}>
              {lead.source === 'anuncio' ? 'Meta Ads' : lead.source}
            </span>
          )}
          <span className="flex items-center gap-0.5 ml-auto shrink-0">
            <Clock className="h-2.5 w-2.5" />
            {timeAgo}
          </span>
        </div>

        {/* Row 3: Inline quick actions */}
        {!selectionMode && lead.phone && (
          <div className="flex items-center gap-1.5 pt-1 border-t border-border/30">
            <button
              onClick={handleWhatsApp}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium active:scale-95 transition-transform touch-manipulation"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              WhatsApp
            </button>
            <button
              onClick={handleCall}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/5 text-primary text-[11px] font-medium active:scale-95 transition-transform touch-manipulation"
            >
              <Phone className="h-3.5 w-3.5" />
              Ligar
            </button>
            <div className="flex-1" />
            <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export const MobileLeadCard = memo(MobileLeadCardComponent);
