import { BarChart3, TrendingUp, CheckSquare, MessageSquare, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { AutomationRule } from "@/types/automation";
import { AutomationFlowPreview } from "./AutomationFlowPreview";

interface Props {
  automation: AutomationRule;
  onClose: () => void;
}

const mockStats = {
  executions: 47,
  responseRate: 72,
  conversions: 8,
  tasksCreated: 23,
  bestHour: "10:00",
};

export function AutomationStatsPanel({ automation, onClose }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-semibold">{automation.name}</h3>
          <p className="text-xs text-muted-foreground">{automation.description}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>Fechar</Button>
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-5 stagger-children">
        {[
          { icon: BarChart3, label: "Execuções", value: mockStats.executions },
          { icon: TrendingUp, label: "Resp.", value: `${mockStats.responseRate}%` },
          { icon: CheckSquare, label: "Conversões", value: mockStats.conversions },
          { icon: MessageSquare, label: "Tarefas", value: mockStats.tasksCreated },
          { icon: Clock, label: "Melhor hora", value: mockStats.bestHour },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-3 text-center">
              <s.icon className="h-4 w-4 text-primary mx-auto mb-1" />
              <div className="text-lg font-bold font-display">{s.value}</div>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Fluxo Visual</CardTitle>
        </CardHeader>
        <CardContent>
          <AutomationFlowPreview automation={automation} />
        </CardContent>
      </Card>
    </div>
  );
}
