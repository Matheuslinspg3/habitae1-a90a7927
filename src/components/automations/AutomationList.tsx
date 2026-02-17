import { 
  Zap, Pause, Play, Copy, Trash2, BarChart3, 
  MoreHorizontal, Pencil 
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PillBadge } from "@/components/ui/pill-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AutomationRule } from "@/types/automation";
import type { AutomationPlan } from "@/hooks/useAutomations";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TRIGGER_LABELS } from "./automationConstants";

interface Props {
  automations: AutomationRule[];
  plan: AutomationPlan;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onViewStats: (id: string) => void;
}

export function AutomationList({ automations, plan, onToggle, onDelete, onDuplicate, onViewStats }: Props) {
  if (automations.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-8 flex flex-col items-center text-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Zap className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-display font-semibold text-lg">Nenhuma automação criada</h3>
          <p className="text-muted-foreground text-sm max-w-sm">
            Crie sua primeira automação para economizar tempo e aumentar suas conversões.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3 stagger-children">
      {automations.map((automation) => (
        <Card
          key={automation.id}
          className="group hover:border-primary/20 transition-all card-hover-lift"
        >
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Status icon */}
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
              automation.enabled ? "bg-emerald-500/10" : "bg-muted"
            }`}>
              {automation.enabled ? (
                <Zap className="h-5 w-5 text-emerald-500" />
              ) : (
                <Pause className="h-5 w-5 text-muted-foreground" />
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-sm truncate">{automation.name}</h3>
                <PillBadge size="sm" variant={automation.enabled ? "success" : "muted"}>
                  {automation.enabled ? "Ativa" : "Pausada"}
                </PillBadge>
              </div>
              {automation.description && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{automation.description}</p>
              )}
              <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                <span>Gatilho: {TRIGGER_LABELS[automation.trigger.type] || automation.trigger.type}</span>
                <span>•</span>
                <span>{automation.actions.length} ação(ões)</span>
                <span>•</span>
                <span>Atualizado {formatDistanceToNow(new Date(automation.updated_at), { addSuffix: true, locale: ptBR })}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <Switch
                checked={automation.enabled}
                onCheckedChange={() => onToggle(automation.id)}
                aria-label="Ativar/Pausar"
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onViewStats(automation.id)}>
                    <BarChart3 className="h-4 w-4 mr-2" /> Estatísticas
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Pencil className="h-4 w-4 mr-2" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDuplicate(automation.id)}>
                    <Copy className="h-4 w-4 mr-2" /> Duplicar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onDelete(automation.id)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
