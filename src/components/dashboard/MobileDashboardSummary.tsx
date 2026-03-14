import { Home, Users, FileText, DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { trackQuickAction } from "@/hooks/useAnalytics";
import { PillBadge } from "@/components/ui/pill-badge";

interface Props {
  stats: {
    properties: { value: string | number; trend?: { value: string; positive: boolean } };
    leads: { value: string | number; trend?: { value: string; positive: boolean } };
    contracts: { value: string | number; trend?: { value: string; positive: boolean } };
    revenue: { value: string | number; trend?: { value: string; positive: boolean } };
  };
  isLoading: boolean;
}

const items = [
  { key: "properties", label: "Imóveis", icon: Home, path: "/imoveis", dotClass: "color-dot" },
  { key: "leads", label: "Leads", icon: Users, path: "/crm", dotClass: "color-dot-accent" },
  { key: "contracts", label: "Contratos", icon: FileText, path: "/contratos", dotClass: "color-dot-warm" },
  { key: "revenue", label: "Receita", icon: DollarSign, path: "/financeiro", dotClass: "color-dot" },
] as const;

export function MobileDashboardSummary({ stats, isLoading }: Props) {
  const navigate = useNavigate();

  return (
    <div className="md:hidden">
      <div className="grid grid-cols-2 gap-2.5">
        {items.map((item) => {
          const stat = stats[item.key];
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => {
                trackQuickAction(`mobile_stat_${item.key}`);
                navigate(item.path);
              }}
              className={cn(
                "rounded-xl border border-border/40 bg-card p-3",
                "active:scale-[0.97] transition-all duration-200 touch-manipulation",
                "flex flex-col gap-1.5 text-left"
              )}
            >
              <div className="flex items-center gap-1.5">
                <div className="h-6 w-6 rounded-md bg-muted/50 flex items-center justify-center">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <span className="text-[10px] text-muted-foreground font-medium">{item.label}</span>
              </div>
              {isLoading ? (
                <div className="h-7 w-16 animate-shimmer rounded" />
              ) : (
                <div className="flex items-end justify-between gap-1">
                  <span className="text-xl font-bold font-display text-foreground leading-none truncate">
                    {stat.value}
                  </span>
                  {stat.trend && (
                    <PillBadge
                      size="sm"
                      variant={stat.trend.positive ? "success" : "warning"}
                      icon={stat.trend.positive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                    >
                      <span className="text-[9px]">{stat.trend.value}</span>
                    </PillBadge>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
