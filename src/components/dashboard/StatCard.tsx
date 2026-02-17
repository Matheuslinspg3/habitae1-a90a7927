import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { PillBadge } from "@/components/ui/pill-badge";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ElementType;
  trend?: {
    value: string;
    positive: boolean;
  };
  onClick?: () => void;
  isLoading?: boolean;
  sparklineData?: number[];
}

const cardColors = [
  { dot: "color-dot", accent: "hsl(var(--primary) / 0.06)", border: "hsl(var(--primary) / 0.15)" },
  { dot: "color-dot-accent", accent: "hsl(var(--accent) / 0.06)", border: "hsl(var(--accent) / 0.15)" },
  { dot: "color-dot-warm", accent: "hsl(var(--warning) / 0.06)", border: "hsl(var(--warning) / 0.15)" },
  { dot: "color-dot", accent: "hsl(var(--info) / 0.06)", border: "hsl(var(--info) / 0.15)" },
];

let cardIndex = 0;

export function StatCard({ title, value, subtitle, icon: Icon, trend, onClick, isLoading, sparklineData }: StatCardProps) {
  const colorSet = cardColors[(cardIndex++) % cardColors.length];

  const renderSparkline = () => {
    if (!sparklineData || sparklineData.length < 2) return null;
    const max = Math.max(...sparklineData);
    const min = Math.min(...sparklineData);
    const range = max - min || 1;
    const w = 80;
    const h = 24;
    const points = sparklineData.map((v, i) => {
      const x = (i / (sparklineData.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg width={w} height={h} className="ml-auto shrink-0">
        <polyline
          points={points}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  return (
    <Card
      className={cn(
        "group relative overflow-hidden touch-manipulation",
        "transition-all duration-300 ease-out-expo border-border/40",
        onClick && "cursor-pointer hover:shadow-elevated card-hover-lift"
      )}
      onClick={onClick}
    >
      {/* Colored top edge */}
      <div
        className="absolute top-0 inset-x-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, ${colorSet.border}, transparent)` }}
      />

      <CardContent className="p-4 sm:p-5 relative">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={colorSet.dot} />
            <span className="editorial-label-muted text-[10px]">
              {title}
            </span>
          </div>
          <div
            className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg flex items-center justify-center group-hover:scale-110 transition-all duration-300 shrink-0"
            style={{ background: colorSet.accent }}
          >
            <Icon className="h-4 w-4 text-primary" />
          </div>
        </div>

        {isLoading ? (
          <div className="h-9 w-24 animate-shimmer rounded-lg" />
        ) : (
          <div className="text-3xl sm:text-4xl font-extrabold font-display text-foreground tracking-tight leading-none">
            {value}
          </div>
        )}

        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <p className="text-[10px] sm:text-xs text-muted-foreground truncate flex-1">{subtitle}</p>
          {trend && (
            <PillBadge
              size="sm"
              variant={trend.positive ? "success" : "warning"}
              icon={trend.positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            >
              {trend.value}
            </PillBadge>
          )}
          {renderSparkline()}
        </div>
      </CardContent>
    </Card>
  );
}
