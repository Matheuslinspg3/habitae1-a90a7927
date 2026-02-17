import { useState } from "react";
import { Flame, Thermometer, Snowflake, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PillBadge } from "@/components/ui/pill-badge";
import { SCORE_RULES_DEFAULT } from "./automationConstants";

interface ScoreRule {
  event: string;
  points: number;
}

export function LeadScoreConfig() {
  const [rules, setRules] = useState<ScoreRule[]>(SCORE_RULES_DEFAULT);

  const addRule = () => setRules([...rules, { event: "", points: 0 }]);
  const removeRule = (i: number) => setRules(rules.filter((_, idx) => idx !== i));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Thermometer className="h-5 w-5 text-primary" />
          Score de Leads
        </CardTitle>
        <CardDescription>Configure pontuação automática para classificar leads.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Classification legend */}
        <div className="flex items-center gap-3 text-xs">
          <PillBadge size="sm" variant="success" icon={<Flame className="h-3 w-3" />}>
            Quente (≥40)
          </PillBadge>
          <PillBadge size="sm" variant="warning" icon={<Thermometer className="h-3 w-3" />}>
            Morno (20-39)
          </PillBadge>
          <PillBadge size="sm" variant="muted" icon={<Snowflake className="h-3 w-3" />}>
            Frio (&lt;20)
          </PillBadge>
        </div>

        {/* Rules */}
        <div className="space-y-2">
          {rules.map((rule, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                className="flex-1"
                placeholder="Evento"
                value={rule.event}
                onChange={(e) => {
                  const r = [...rules];
                  r[i].event = e.target.value;
                  setRules(r);
                }}
              />
              <Input
                className="w-20"
                type="number"
                value={rule.points}
                onChange={(e) => {
                  const r = [...rules];
                  r[i].points = parseInt(e.target.value) || 0;
                  setRules(r);
                }}
              />
              <span className="text-xs text-muted-foreground w-8">pts</span>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeRule(i)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>

        <Button variant="outline" size="sm" onClick={addRule}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar regra
        </Button>
      </CardContent>
    </Card>
  );
}
