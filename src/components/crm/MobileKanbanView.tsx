import { useState, useMemo, memo, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MobileLeadCard } from './MobileLeadCard';
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
  if (value === 0) return 'R$ 0';
  if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(0)}k`;
  return `R$ ${value}`;
}

function MobileKanbanViewComponent({ 
  leadStages, leadsByStage, stageStats, onLeadClick,
  selectedIds, onToggleSelect, selectionMode,
}: MobileKanbanViewProps) {
  const defaultTab = leadStages[0]?.id || '';
  const [activeTab, setActiveTab] = useState<string>(defaultTab);

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

  const handleLeadClick = useCallback((lead: Lead) => {
    onLeadClick(lead);
  }, [onLeadClick]);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <ScrollArea className="w-full">
        <TabsList className="w-max min-w-full justify-start bg-muted/50 p-1 h-auto">
          {visibleStages.map((stage) => {
            const stats = stageStats[stage.id];
            return (
              <TabsTrigger key={stage.id} value={stage.id} className="flex items-center gap-1.5 px-3 py-2 data-[state=active]:bg-background">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                <span className="text-xs font-medium whitespace-nowrap">{stage.name}</span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{stats?.count || 0}</Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </ScrollArea>

      {visibleStages.map((stage) => {
        const leads = leadsByStage[stage.id] || [];
        const stats = stageStats[stage.id];
        
        return (
          <TabsContent key={stage.id} value={stage.id} className="mt-3">
            <div className="flex items-center justify-between mb-3 px-1">
              <p className="text-sm text-muted-foreground">
                {leads.length} {leads.length === 1 ? 'lead' : 'leads'}
              </p>
              {stats?.totalValue > 0 && (
                <p className="text-sm font-medium">{formatCurrency(stats.totalValue)}</p>
              )}
            </div>
            <div className="space-y-2">
              {leads.length > 0 ? (
                leads.map((lead) => (
                  <MobileLeadCard
                    key={lead.id}
                    lead={lead}
                    onClick={() => handleLeadClick(lead)}
                    isSelected={selectedIds?.has(lead.id)}
                    onToggleSelect={onToggleSelect}
                    selectionMode={selectionMode}
                  />
                ))
              ) : (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">Nenhum lead nesta etapa</p>
                </div>
              )}
            </div>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}

export const MobileKanbanView = memo(MobileKanbanViewComponent);
