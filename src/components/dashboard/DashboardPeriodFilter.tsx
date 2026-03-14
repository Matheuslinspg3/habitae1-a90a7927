import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import type { PeriodKey } from "@/hooks/useDashboardPeriod";
import type { DateRange } from "react-day-picker";

interface Props {
  periodKey: PeriodKey;
  onPeriodChange: (key: PeriodKey) => void;
  customRange: { from: Date; to: Date };
  onCustomRangeChange: (range: { from: Date; to: Date }) => void;
}

const OPTIONS: { value: PeriodKey; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mês" },
  { value: "90days", label: "90 dias" },
  { value: "custom", label: "Personalizado" },
];

export function DashboardPeriodFilter({ periodKey, onPeriodChange, customRange, onCustomRangeChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
      <ToggleGroup
        type="single"
        value={periodKey}
        onValueChange={(v) => v && onPeriodChange(v as PeriodKey)}
        className="bg-muted/50 rounded-lg p-1 flex-nowrap"
      >
        {OPTIONS.map((opt) => (
          <ToggleGroupItem
            key={opt.value}
            value={opt.value}
            className="text-xs px-3 h-8 data-[state=on]:bg-background data-[state=on]:shadow-sm rounded-md"
          >
            {opt.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {periodKey === "custom" && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 text-xs h-8">
              <CalendarIcon className="h-3.5 w-3.5" />
              {format(customRange.from, "dd/MM", { locale: ptBR })} – {format(customRange.to, "dd/MM", { locale: ptBR })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={{ from: customRange.from, to: customRange.to }}
              onSelect={(range: DateRange | undefined) => {
                if (range?.from && range?.to) {
                  onCustomRangeChange({ from: range.from, to: range.to });
                }
              }}
              numberOfMonths={2}
              locale={ptBR}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
