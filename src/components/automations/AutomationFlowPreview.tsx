import { Zap, Filter, Play, ArrowDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { AutomationRule } from "@/types/automation";
import { TRIGGER_LABELS, ACTION_LABELS } from "./automationConstants";

interface Props {
  automation: AutomationRule;
}

export function AutomationFlowPreview({ automation }: Props) {
  return (
    <div className="flex flex-col items-center gap-2 py-4">
      {/* Trigger block */}
      <Card className="w-full max-w-xs border-primary/30 bg-primary/5">
        <CardContent className="p-3 flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Zap className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Quando</p>
            <p className="text-xs font-medium">{TRIGGER_LABELS[automation.trigger.type]}</p>
          </div>
        </CardContent>
      </Card>

      <ArrowDown className="h-4 w-4 text-muted-foreground" />

      {/* Conditions */}
      {automation.trigger.conditions && Object.keys(automation.trigger.conditions).length > 0 && (
        <>
          <Card className="w-full max-w-xs border-border bg-muted/50">
            <CardContent className="p-3 flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Filter className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Se</p>
                <p className="text-xs font-medium">
                  {Object.entries(automation.trigger.conditions).map(([k, v]) => `${k}: ${String(v)}`).join(", ")}
                </p>
              </div>
            </CardContent>
          </Card>
          <ArrowDown className="h-4 w-4 text-muted-foreground" />
        </>
      )}

      {/* Actions */}
      {automation.actions.map((action, i) => (
        <div key={i} className="flex flex-col items-center gap-2 w-full">
          <Card className="w-full max-w-xs border-accent/30 bg-accent/5">
            <CardContent className="p-3 flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                <Play className="h-4 w-4 text-accent" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Então {action.delay ? `(após ${action.delay}min)` : ""}
                </p>
                <p className="text-xs font-medium">{ACTION_LABELS[action.type]}</p>
              </div>
            </CardContent>
          </Card>
          {i < automation.actions.length - 1 && (
            <ArrowDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      ))}
    </div>
  );
}
