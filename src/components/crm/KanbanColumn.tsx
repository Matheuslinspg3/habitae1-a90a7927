import { memo, useCallback, useState, useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Users } from 'lucide-react';
import { LeadCard } from './LeadCard';
import type { Lead } from '@/hooks/useLeads';
import type { LeadStage } from '@/hooks/useLeadStages';

const INITIAL_VISIBLE = 20;

function KanbanColumnContent({ leads, onLeadClick }: { leads: Lead[]; onLeadClick: (lead: Lead) => void }) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const visibleLeads = leads.slice(0, visibleCount);
  const remaining = leads.length - visibleCount;

  const leadIds = useMemo(() => visibleLeads.map(l => l.id), [visibleLeads]);

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Users className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-xs text-muted-foreground">Nenhum lead nesta etapa</p>
      </div>
    );
  }

  return (
    <SortableContext items={leadIds} strategy={verticalListSortingStrategy}>
      <div className="space-y-2 pr-2">
        {visibleLeads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} onClick={() => onLeadClick(lead)} />
        ))}
        {remaining > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground"
            onClick={() => setVisibleCount((c) => c + 20)}
          >
            Mostrar mais {Math.min(remaining, 20)} leads
          </Button>
        )}
      </div>
    </SortableContext>
  );
}

interface KanbanColumnProps {
  stage: LeadStage;
  leads: Lead[];
  stats: {
    count: number;
    totalValue: number;
  };
  onLeadClick: (lead: Lead) => void;
}

function formatCurrency(value: number) {
  if (value === 0) return 'R$ 0';
  if (value >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(0)}k`;
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
  }).format(value);
}

function KanbanColumnComponent({ stage, leads, stats, onLeadClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
    data: { stage },
  });

  const handleLeadClick = useCallback((lead: Lead) => {
    onLeadClick(lead);
  }, [onLeadClick]);

  return (
    <div className="flex-shrink-0 w-72 lg:w-80">
      <Card className={`bg-muted/30 transition-colors h-full flex flex-col ${isOver ? 'ring-2 ring-primary' : ''}`}>
        <CardHeader className="py-3 px-3 lg:px-4 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
              <CardTitle className="text-sm font-medium truncate">{stage.name}</CardTitle>
              <Badge variant="secondary" className="text-xs shrink-0">
                {stats.count}
              </Badge>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {formatCurrency(stats.totalValue)}
          </p>
        </CardHeader>
        <CardContent
          ref={setNodeRef}
          className="px-2 pb-2 flex-1 min-h-[200px]"
        >
          <ScrollArea className="h-full max-h-[calc(100vh-320px)]">
            <KanbanColumnContent leads={leads} onLeadClick={handleLeadClick} />
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

export const KanbanColumn = memo(KanbanColumnComponent);
