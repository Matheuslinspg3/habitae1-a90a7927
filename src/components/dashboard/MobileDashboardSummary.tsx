import { Home, Users, FileText, DollarSign, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn, formatCurrency } from "@/lib/utils";
import { trackQuickAction } from "@/hooks/useAnalytics";

interface MiniStat {
  label: string;
  value: string | number;
  icon: React.ElementType;
  path: string;
  dotClass: string;
}

interface Props {
  stats: {
    properties: { value: string | number };
    leads: { value: string | number };
    contracts: { value: string | number };
    revenue: { value: string | number };
  };
  isLoading: boolean;
}

export function MobileDashboardSummary({ stats, isLoading }: Props) {
  const navigate = useNavigate();

  const items: MiniStat[] = [
    { label: "Imóveis", value: stats.properties.value, icon: Home, path: "/imoveis", dotClass: "color-dot" },
    { label: "Leads", value: stats.leads.value, icon: Users, path: "/crm", dotClass: "color-dot-accent" },
    { label: "Contratos", value: stats.contracts.value, icon: FileText, path: "/contratos", dotClass: "color-dot-warm" },
    { label: "Receita", value: stats.revenue.value, icon: DollarSign, path: "/financeiro", dotClass: "color-dot" },
  ];

  return (
    <div className="md:hidden">
      {/* Horizontal scrollable mini-stats */}
      <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-none">
        {items.map((item) => (
          <button
            key={item.label}
            onClick={() => {
              trackQuickAction(`mobile_stat_${item.label.toLowerCase()}`);
              navigate(item.path);
            }}
            className={cn(
              "flex-shrink-0 snap-start",
              "w-[130px] rounded-xl border border-border/40 bg-card p-3",
              "active:scale-95 transition-all duration-200 touch-manipulation",
              "flex flex-col gap-2"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className={item.dotClass} />
                <span className="text-[10px] text-muted-foreground font-medium">{item.label}</span>
              </div>
              <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
            </div>
            {isLoading ? (
              <div className="h-7 w-16 animate-shimmer rounded" />
            ) : (
              <span className="text-xl font-bold font-display text-foreground leading-none truncate">
                {item.value}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
