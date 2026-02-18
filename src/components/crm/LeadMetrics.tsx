import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Users, DollarSign, Target, Clock } from 'lucide-react';
import { type Lead } from '@/hooks/useLeads';

interface LeadMetricsProps {
  leads: Lead[];
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

function formatPercentage(value: number) {
  return `${value.toFixed(1)}%`;
}

export function LeadMetrics({ leads }: LeadMetricsProps) {
  const metrics = useMemo(() => {
    const total = leads.length;
    const totalValue = leads.reduce((sum, lead) => sum + (lead.estimated_value || 0), 0);
    
    const wonLeads = leads.filter(l => l.stage === 'fechado_ganho');
    const lostLeads = leads.filter(l => l.stage === 'fechado_perdido');
    const activeLeads = leads.filter(l => !['fechado_ganho', 'fechado_perdido'].includes(l.stage));
    
    const closedTotal = wonLeads.length + lostLeads.length;
    const conversionRate = closedTotal > 0 ? (wonLeads.length / closedTotal) * 100 : 0;
    
    const wonValue = wonLeads.reduce((sum, lead) => sum + (lead.estimated_value || 0), 0);
    const pipelineValue = activeLeads.reduce((sum, lead) => sum + (lead.estimated_value || 0), 0);
    
    // Calculate average time in pipeline (from created_at to now for active leads)
    const now = new Date();
    const avgDaysInPipeline = activeLeads.length > 0
      ? activeLeads.reduce((sum, lead) => {
          const created = new Date(lead.created_at);
          const days = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
          return sum + days;
        }, 0) / activeLeads.length
      : 0;
    
    return {
      total,
      activeLeads: activeLeads.length,
      totalValue,
      conversionRate,
      wonValue,
      pipelineValue,
      avgDaysInPipeline: Math.round(avgDaysInPipeline),
    };
  }, [leads]);

  const cards = [
    {
      title: 'Leads Ativos',
      value: metrics.activeLeads.toString(),
      subtitle: `de ${metrics.total} total`,
      icon: Users,
      trend: null,
    },
    {
      title: 'Pipeline',
      value: formatCurrency(metrics.pipelineValue),
      subtitle: 'valor em negociação',
      icon: Target,
      trend: null,
    },
    {
      title: 'Taxa de Conversão',
      value: formatPercentage(metrics.conversionRate),
      subtitle: 'fechados com sucesso',
      icon: metrics.conversionRate >= 30 ? TrendingUp : TrendingDown,
      trend: metrics.conversionRate >= 30 ? 'up' : 'down',
    },
    {
      title: 'Valor Fechado',
      value: formatCurrency(metrics.wonValue),
      subtitle: 'negócios ganhos',
      icon: DollarSign,
      trend: null,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <Card key={card.title} className="bg-card">
          <CardContent className="p-4 sm:p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
                {card.title}
              </p>
              <card.icon 
                className={`h-5 w-5 shrink-0 ${
                  card.trend === 'up' 
                    ? 'text-success' 
                    : card.trend === 'down' 
                    ? 'text-destructive' 
                    : 'text-muted-foreground'
                }`} 
              />
            </div>
            <div className="mt-2.5">
              <p className="text-xl sm:text-2xl font-bold truncate">{card.value}</p>
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate mt-0.5">{card.subtitle}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
