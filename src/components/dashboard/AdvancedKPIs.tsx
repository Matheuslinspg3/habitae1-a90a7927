import { Users, CalendarCheck, FileText, Handshake, Percent, Receipt } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { formatCurrency } from "@/lib/utils";
import { useDashboardKPIs } from "@/hooks/useDashboardKPIs";

interface Props {
  dateRange: { from: Date; to: Date };
}

export function AdvancedKPIs({ dateRange }: Props) {
  const { kpis, isLoading } = useDashboardKPIs(dateRange);

  const cards = [
    { title: "Leads no Período", value: kpis?.leads.value ?? 0, trend: kpis?.leads.trend, icon: Users },
    { title: "Visitas Realizadas", value: kpis?.visits.value ?? 0, trend: kpis?.visits.trend, icon: CalendarCheck },
    { title: "Propostas Abertas", value: kpis?.proposals.value ?? 0, trend: kpis?.proposals.trend, icon: FileText },
    { title: "Fechamentos", value: kpis?.closings.value ?? 0, trend: kpis?.closings.trend, icon: Handshake },
    { title: "Taxa de Conversão", value: kpis?.conversionRate.value ?? "0%", trend: kpis?.conversionRate.trend, icon: Percent },
    { title: "Ticket Médio", value: kpis ? formatCurrency(kpis.avgTicket.value as number) : "R$ 0", trend: kpis?.avgTicket.trend, icon: Receipt },
  ];

  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
      {cards.map((card) => (
        <StatCard
          key={card.title}
          title={card.title}
          value={card.value}
          subtitle={card.trend ? `vs período anterior` : "Sem dados anteriores"}
          icon={card.icon}
          trend={card.trend}
          isLoading={isLoading}
        />
      ))}
    </div>
  );
}
