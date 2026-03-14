import { useState, useMemo, memo, useCallback, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MobileLeadCard } from './MobileLeadCard';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trackQuickAction, trackFilterUsed } from '@/hooks/useAnalytics';
import type { Lead } from '@/hooks/useLeads';
import type { LeadStage } from '@/hooks/useLeadStages';

interface MobileKanbanViewProps {
  leadStages: LeadStage[];
  leadsByStage: Record<string, Lead[]>;
  stageStats: Record<string, { count: number; totalValue: number }>;
  onLeadClick: (lead: Lead) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  selectionMode?: boolean;
}

function formatCurrency(value: number) {
  if (value === 0) return '';
  if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}k`;
  return `R$ ${value}`;
}

const INITIAL_VISIBLE = 15;

function MobileKanbanViewComponent({
  leadStages, leadsByStage, stageStats, onLeadClick,
  selectedIds, onToggleSelect, selectionMode,
}: MobileKanbanViewProps) {
  const visibleStages = useMemo(() => {
    const unclassifiedCount = leadsByStage['__unclassified__']?.length || 0;
    const unclassifiedStage: LeadStage = {
      id: '__unclassified__',
      name: 'Não Classificados',
      color: '#9ca3af',
      position: -1,
      organization_id: null,
      is_default: false,
      is_win: false,
      is_loss: false,
      created_at: '',
    };

    const regular = leadStages.filter(stage => {
      const hasLeads = (leadsByStage[stage.id]?.length || 0) > 0;
      return hasLeads || (!stage.is_win && !stage.is_loss);
    });

    return unclassifiedCount > 0 ? [unclassifiedStage, ...regular] : regular;
  }, [leadStages, leadsByStage]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const stageScrollRef = useRef<HTMLDivElement>(null);

  const activeStage = visibleStages[activeIndex] || visibleStages[0];
  const leads = activeStage ? (leadsByStage[activeStage.id] || []) : [];
  const stats = activeStage ? stageStats[activeStage.id] : undefined;
  const displayedLeads = leads.slice(0, visibleCount);
  const hasMore = leads.length > visibleCount;

  const handleStageChange = useCallback((index: number) => {
    setActiveIndex(index);
    setVisibleCount(INITIAL_VISIBLE);
    trackFilterUsed(`mobile_kanban_stage_${visibleStages[index]?.name || index}`);
  }, [visibleStages]);

  const goNext = useCallback(() => {
    if (activeIndex < visibleStages.length - 1) handleStageChange(activeIndex + 1);
  }, [activeIndex, visibleStages.length, handleStageChange]);

  const goPrev = useCallback(() => {
    if (activeIndex > 0) handleStageChange(activeIndex - 1);
  }, [activeIndex, handleStageChange]);

  const handleLeadClick = useCallback((lead: Lead) => {
    trackQuickAction('mobile_kanban_lead_click');
    onLeadClick(lead);
  }, [onLeadClick]);

  return (
    <div className="space-y-3">
      {/* Stage pills - horizontal scroll */}
      <div ref={stageScrollRef} className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1 -mx-1 px-1 snap-x snap-mandatory">
        {visibleStages.map((stage, i) => {
          const count = stageStats[stage.id]?.count || 0;
          const isActive = i === activeIndex;
          return (
            <button
              key={stage.id}
              onClick={() => handleStageChange(i)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 snap-start transition-all touch-manipulation min-h-[40px]",
                isActive
                  ? "bg-foreground text-background shadow-sm"
                  : "bg-muted/50 text-muted-foreground active:bg-muted"
              )}
            >
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: stage.color }}
              />
              {stage.name}
              <Badge
                variant={isActive ? "outline" : "secondary"}
                className={cn(
                  "text-[10px] px-1.5 py-0 h-4",
                  isActive && "border-background/30 text-background"
                )}
              >
                {count}
              </Badge>
            </button>
          );
        })}
      </div>

      {/* Stage navigation arrows + summary */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={activeIndex === 0}
            onClick={goPrev}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <p className="text-sm font-medium">{activeStage?.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {leads.length} lead{leads.length !== 1 ? 's' : ''}
              {stats?.totalValue ? ` · ${formatCurrency(stats.totalValue)}` : ''}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={activeIndex >= visibleStages.length - 1}
          onClick={goNext}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Lead list */}
      <div className="space-y-2">
        {displayedLeads.length > 0 ? (
          <>
            {displayedLeads.map((lead) => (
              <MobileLeadCard
                key={lead.id}
                lead={lead}
                onClick={() => handleLeadClick(lead)}
                isSelected={selectedIds?.has(lead.id)}
                onToggleSelect={onToggleSelect}
                selectionMode={selectionMode}
              />
            ))}
            {hasMore && (
              <Button
                variant="ghost"
                className="w-full text-sm text-muted-foreground"
                onClick={() => setVisibleCount(prev => prev + 15)}
              >
                Carregar mais ({leads.length - visibleCount} restantes)
              </Button>
            )}
          </>
        ) : (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">Nenhum lead nesta etapa</p>
          </div>
        )}
      </div>
    </div>
  );
}

export const MobileKanbanView = memo(MobileKanbanViewComponent);
