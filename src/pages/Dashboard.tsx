import { useMemo, useEffect } from "react";
import { Home, Users, FileText, DollarSign } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { WelcomeHeader } from "@/components/dashboard/WelcomeHeader";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { MobileDashboardSummary } from "@/components/dashboard/MobileDashboardSummary";
import { useScreenTime, useTrackAction } from "@/hooks/useAnalytics";
import { RecentActivities } from "@/components/dashboard/RecentActivities";
import { TodayTasks } from "@/components/dashboard/TodayTasks";
import { PipelineSummary } from "@/components/dashboard/PipelineSummary";
import { UpcomingAppointments } from "@/components/dashboard/UpcomingAppointments";
import { StalePropertiesAlert } from "@/components/dashboard/StalePropertiesAlert";
import { PWAInstallBanner } from "@/components/dashboard/PWAInstallBanner";
import { CarnivalBanner } from "@/components/dashboard/CarnivalBanner";
import { MarketplaceMetricsCard } from "@/components/marketplace/MarketplaceMetricsCard";
import { ConversionFunnel } from "@/components/dashboard/ConversionFunnel";
import { InactivityAlerts } from "@/components/dashboard/InactivityAlerts";
import { DashboardPeriodFilter } from "@/components/dashboard/DashboardPeriodFilter";
import { AdvancedKPIs } from "@/components/dashboard/AdvancedKPIs";
import { DetailedFunnel } from "@/components/dashboard/DetailedFunnel";
import { AgentRanking } from "@/components/dashboard/AgentRanking";
import { LiveIndicator } from "@/components/dashboard/LiveIndicator";
import { useDemo } from "@/contexts/DemoContext";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "@/lib/utils";
import { useProperties } from "@/hooks/useProperties";
import { useLeads } from "@/hooks/useLeads";
import { useContracts } from "@/hooks/useContracts";
import { useTransactions } from "@/hooks/useTransactions";
import { useDashboardPeriod } from "@/hooks/useDashboardPeriod";
import { useUserRoles } from "@/hooks/useUserRole";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function Dashboard() {
  const { isDemoMode, demoStats } = useDemo();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdminOrAbove } = useUserRoles();
  const { periodKey, setPeriodKey, dateRange, customRange, setCustomRange } = useDashboardPeriod();

  const { properties, isLoading: loadingProperties } = useProperties();
  const { leads, isLoading: loadingLeads } = useLeads();
  const { contracts, isLoading: loadingContracts } = useContracts();
  const { stats: transactionStats, chartData, isLoading: loadingTransactions } = useTransactions();

  // Realtime subscription for leads and appointments
  useEffect(() => {
    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => {
        queryClient.invalidateQueries({ queryKey: ["kpi_metrics"] });
        queryClient.invalidateQueries({ queryKey: ["agent_ranking"] });
        queryClient.invalidateQueries({ queryKey: ["funnel_detail"] });
        queryClient.invalidateQueries({ queryKey: ["leads"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => {
        queryClient.invalidateQueries({ queryKey: ["kpi_metrics"] });
        queryClient.invalidateQueries({ queryKey: ["agent_ranking"] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const realStats = useMemo(() => {
    const activeProperties = properties.filter(p => 
      ["disponivel", "com_proposta", "reservado"].includes(p.status)
    ).length;
    
    const activeLeads = leads.filter(l => 
      !["fechado_ganho", "fechado_perdido"].includes(l.stage)
    ).length;
    
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const newLeadsThisWeek = leads.filter(l => 
      new Date(l.created_at) >= oneWeekAgo
    ).length;
    
    const activeContracts = contracts.filter(c => c.status === "ativo").length;
    const pendingContracts = contracts.filter(c => c.status === "rascunho").length;

    let revenueTrend: { value: string; positive: boolean } | undefined;
    if (chartData && chartData.length >= 2) {
      const currentMonth = chartData[chartData.length - 1]?.receitas || 0;
      const previousMonth = chartData[chartData.length - 2]?.receitas || 0;
      if (previousMonth > 0) {
        const pctChange = ((currentMonth - previousMonth) / previousMonth) * 100;
        revenueTrend = {
          value: `${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(0)}%`,
          positive: pctChange >= 0,
        };
      } else if (currentMonth > 0) {
        revenueTrend = { value: 'Novo', positive: true };
      }
    }
    
    return { activeProperties, totalProperties: properties.length, activeLeads, newLeadsThisWeek, activeContracts, pendingContracts, monthlyRevenue: transactionStats.monthlyRevenue, balance: transactionStats.balance, revenueTrend };
  }, [properties, leads, contracts, transactionStats, chartData]);

  const isLoading = loadingProperties || loadingLeads || loadingContracts || loadingTransactions;

  // Analytics
  useScreenTime("dashboard");
  const trackAction = useTrackAction();

  const stats = isDemoMode
    ? {
        properties: { value: demoStats.activeProperties, subtitle: `${demoStats.totalProperties} imóveis em portfólio`, trend: { value: "+15%", positive: true } },
        leads: { value: demoStats.activeLeads, subtitle: `${demoStats.newLeadsThisWeek} novos esta semana`, trend: { value: `+${demoStats.newLeadsThisWeek}`, positive: true } },
        contracts: { value: demoStats.activeContracts, subtitle: demoStats.pendingContracts > 0 ? `${demoStats.pendingContracts} pendente${demoStats.pendingContracts > 1 ? 's' : ''}` : "Todos finalizados", trend: undefined },
        revenue: { value: formatCurrency(demoStats.monthlyRevenue), subtitle: `Saldo: ${formatCurrency(demoStats.balance)}`, trend: { value: "+12%", positive: true } },
      }
    : {
        properties: { value: realStats.activeProperties, subtitle: realStats.totalProperties > 0 ? `${realStats.totalProperties} imóveis em portfólio` : "Cadastre imóveis e acompanhe negociações", trend: realStats.activeProperties > 0 ? { value: `${realStats.activeProperties}`, positive: true } : undefined },
        leads: { value: realStats.activeLeads, subtitle: realStats.newLeadsThisWeek > 0 ? `${realStats.newLeadsThisWeek} novos esta semana` : "Adicione leads e gerencie seu funil", trend: realStats.newLeadsThisWeek > 0 ? { value: `+${realStats.newLeadsThisWeek}`, positive: true } : undefined },
        contracts: { value: realStats.activeContracts, subtitle: realStats.pendingContracts > 0 ? `${realStats.pendingContracts} pendente${realStats.pendingContracts > 1 ? 's' : ''}` : realStats.activeContracts > 0 ? "Todos finalizados" : "Nenhum contrato ativo", trend: undefined },
        revenue: { value: formatCurrency(realStats.monthlyRevenue), subtitle: `Saldo: ${formatCurrency(realStats.balance)}`, trend: realStats.revenueTrend },
      };

  return (
    <div className="flex flex-col min-h-screen relative page-enter">
      <div className="absolute inset-0 bg-gradient-mesh-vibrant pointer-events-none" />
      
      <div className="relative flex-1 p-4 sm:p-6 space-y-6 sm:space-y-8">
        {/* Welcome + Quick Actions + Live */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3">
            <WelcomeHeader />
            <LiveIndicator />
          </div>
          <div className="hidden sm:block">
            <QuickActions />
          </div>
        </div>

        {/* Mobile Quick Actions - horizontal scroll */}
        <div className="sm:hidden -mx-4 px-4">
          <QuickActions />
        </div>

        {/* Period Filter */}
        <DashboardPeriodFilter
          periodKey={periodKey}
          onPeriodChange={setPeriodKey}
          customRange={customRange}
          onCustomRangeChange={setCustomRange}
        />

        {/* Colorful divider */}
        <hr className="section-divider" />

        {/* Carnival Banner */}
        {new Date().getMonth() === 1 && <CarnivalBanner />}

        {/* Mobile compact stats (horizontal scroll) */}
        <MobileDashboardSummary stats={stats} isLoading={isLoading} />

        {/* Desktop Stats Grid */}
        <div className="hidden md:grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4 stagger-children">
          <StatCard title="Imóveis Ativos" value={stats.properties.value} subtitle={stats.properties.subtitle} icon={Home} trend={stats.properties.trend} onClick={() => { trackAction('stat_click', { card: 'properties' }); navigate('/imoveis'); }} isLoading={isLoading} />
          <StatCard title="Leads no Funil" value={stats.leads.value} subtitle={stats.leads.subtitle} icon={Users} trend={stats.leads.trend} onClick={() => { trackAction('stat_click', { card: 'leads' }); navigate('/crm'); }} isLoading={isLoading} />
          <StatCard title="Contratos Ativos" value={stats.contracts.value} subtitle={stats.contracts.subtitle} icon={FileText} trend={stats.contracts.trend} onClick={() => { trackAction('stat_click', { card: 'contracts' }); navigate('/contratos'); }} isLoading={isLoading} />
          <StatCard title="Receita do Mês" value={stats.revenue.value} subtitle={stats.revenue.subtitle} icon={DollarSign} trend={stats.revenue.trend} onClick={() => { trackAction('stat_click', { card: 'revenue' }); navigate('/financeiro'); }} isLoading={isLoading} />
        </div>

        {/* Advanced KPIs */}
        <AdvancedKPIs dateRange={dateRange} />

        {/* PWA Install Banner */}
        <PWAInstallBanner />

        {/* Stale Properties Alert */}
        <StalePropertiesAlert properties={properties} isLoading={loadingProperties} />

        {/* Detailed Funnel */}
        <DetailedFunnel dateRange={dateRange} />

        {/* Pipeline + Conversion + Appointments */}
        <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3 stagger-children">
          <PipelineSummary />
          <ConversionFunnel />
          <UpcomingAppointments />
        </div>

        {/* Agent Ranking (admin+ only) */}
        {isAdminOrAbove && <AgentRanking dateRange={dateRange} />}

        {/* Inactivity Alerts + Marketplace */}
        <div className="grid gap-4 sm:gap-6 md:grid-cols-2 stagger-children">
          <InactivityAlerts />
          <MarketplaceMetricsCard />
        </div>

        {/* Activities + Today Tasks */}
        <div className="grid gap-4 sm:gap-6 md:grid-cols-2 stagger-children">
          <RecentActivities />
          <TodayTasks />
        </div>
      </div>
    </div>
  );
}
