import { useEffect, lazy, Suspense } from "react";
import { Home, Users, FileText, DollarSign } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { WelcomeHeader } from "@/components/dashboard/WelcomeHeader";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { MobileDashboardSummary } from "@/components/dashboard/MobileDashboardSummary";
import { MobileTodaySummary } from "@/components/dashboard/MobileTodaySummary";
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
// PERF: lazy load - DetailedFunnel imports recharts (~200KB), only visible when scrolled into view
const DetailedFunnel = lazy(() => import("@/components/dashboard/DetailedFunnel").then(m => ({ default: m.DetailedFunnel })));
import { AgentRanking } from "@/components/dashboard/AgentRanking";
import { LiveIndicator } from "@/components/dashboard/LiveIndicator";
import { LazySection } from "@/components/dashboard/LazySection";
import { useDemo } from "@/contexts/DemoContext";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "@/lib/utils";
import { useDashboardStats } from "@/hooks/useDashboardStats";
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

  // Single lightweight RPC instead of 4 heavy queries
  const { data: realStats, isLoading } = useDashboardStats();

  // Realtime — only invalidate the lightweight stats RPC
  useEffect(() => {
    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => {
        queryClient.invalidateQueries({ queryKey: ["dashboard_stats"] });
        queryClient.invalidateQueries({ queryKey: ["kpi_metrics"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => {
        queryClient.invalidateQueries({ queryKey: ["kpi_metrics"] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Analytics
  useScreenTime("dashboard");
  const trackAction = useTrackAction();

  const s = realStats || {
    active_properties: 0, total_properties: 0,
    active_leads: 0, new_leads_week: 0,
    active_contracts: 0, pending_contracts: 0,
    monthly_revenue: 0, balance: 0,
  };

  const stats = isDemoMode
    ? {
        properties: { value: demoStats.activeProperties, subtitle: `${demoStats.totalProperties} imóveis em portfólio`, trend: { value: "+15%", positive: true } },
        leads: { value: demoStats.activeLeads, subtitle: `${demoStats.newLeadsThisWeek} novos esta semana`, trend: { value: `+${demoStats.newLeadsThisWeek}`, positive: true } },
        contracts: { value: demoStats.activeContracts, subtitle: demoStats.pendingContracts > 0 ? `${demoStats.pendingContracts} pendente${demoStats.pendingContracts > 1 ? 's' : ''}` : "Todos finalizados", trend: undefined },
        revenue: { value: formatCurrency(demoStats.monthlyRevenue), subtitle: `Saldo: ${formatCurrency(demoStats.balance)}`, trend: { value: "+12%", positive: true } },
      }
    : {
        properties: { value: s.active_properties, subtitle: s.total_properties > 0 ? `${s.total_properties} imóveis em portfólio` : "Cadastre imóveis e acompanhe negociações", trend: s.active_properties > 0 ? { value: `${s.active_properties}`, positive: true } : undefined },
        leads: { value: s.active_leads, subtitle: s.new_leads_week > 0 ? `${s.new_leads_week} novos esta semana` : "Adicione leads e gerencie seu funil", trend: s.new_leads_week > 0 ? { value: `+${s.new_leads_week}`, positive: true } : undefined },
        contracts: { value: s.active_contracts, subtitle: s.pending_contracts > 0 ? `${s.pending_contracts} pendente${s.pending_contracts > 1 ? 's' : ''}` : s.active_contracts > 0 ? "Todos finalizados" : "Nenhum contrato ativo", trend: undefined },
        revenue: { value: formatCurrency(s.monthly_revenue), subtitle: `Saldo: ${formatCurrency(s.balance)}`, trend: undefined },
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

        {/* Mobile Quick Actions */}
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

        <hr className="section-divider" />

        {new Date().getMonth() === 1 && <CarnivalBanner />}

        {/* Mobile compact stats */}
        <MobileDashboardSummary stats={stats} isLoading={isLoading} />
        <MobileTodaySummary />

        {/* Desktop Stats Grid */}
        <div className="hidden md:grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4 stagger-children">
          {/* PERF: colorIndex prop replaces non-deterministic module-level counter */}
          <StatCard title="Imóveis Ativos" value={stats.properties.value} subtitle={stats.properties.subtitle} icon={Home} trend={stats.properties.trend} onClick={() => { trackAction('stat_click', { card: 'properties' }); navigate('/imoveis'); }} isLoading={isLoading} colorIndex={0} />
          <StatCard title="Leads no Funil" value={stats.leads.value} subtitle={stats.leads.subtitle} icon={Users} trend={stats.leads.trend} onClick={() => { trackAction('stat_click', { card: 'leads' }); navigate('/crm'); }} isLoading={isLoading} colorIndex={1} />
          <StatCard title="Contratos Ativos" value={stats.contracts.value} subtitle={stats.contracts.subtitle} icon={FileText} trend={stats.contracts.trend} onClick={() => { trackAction('stat_click', { card: 'contracts' }); navigate('/contratos'); }} isLoading={isLoading} colorIndex={2} />
          <StatCard title="Receita do Mês" value={stats.revenue.value} subtitle={stats.revenue.subtitle} icon={DollarSign} trend={stats.revenue.trend} onClick={() => { trackAction('stat_click', { card: 'revenue' }); navigate('/financeiro'); }} isLoading={isLoading} colorIndex={3} />
        </div>

        {/* Advanced KPIs */}
        <AdvancedKPIs dateRange={dateRange} />

        <PWAInstallBanner />

        {/* Lazy-loaded sections below the fold */}
        <LazySection>
          <StalePropertiesAlert />
        </LazySection>

        <LazySection>
          <Suspense fallback={<Skeleton className="h-80 w-full rounded-xl" />}>
            <DetailedFunnel dateRange={dateRange} />
          </Suspense>
        </LazySection>

        <LazySection>
          <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3 stagger-children">
            <PipelineSummary />
            <ConversionFunnel />
            <UpcomingAppointments />
          </div>
        </LazySection>

        {isAdminOrAbove && (
          <LazySection>
            <AgentRanking dateRange={dateRange} />
          </LazySection>
        )}

        <LazySection>
          <div className="grid gap-4 sm:gap-6 md:grid-cols-2 stagger-children">
            <InactivityAlerts />
            <MarketplaceMetricsCard />
          </div>
        </LazySection>

        <LazySection>
          <div className="grid gap-4 sm:gap-6 md:grid-cols-2 stagger-children">
            <RecentActivities />
            <TodayTasks />
          </div>
        </LazySection>
      </div>
    </div>
  );
}
