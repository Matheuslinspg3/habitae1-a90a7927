import { useState } from "react";
import { 
  Zap, ArrowRight, ArrowLeft, Check, Plus, Trash2,
  Filter, Play, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PillBadge } from "@/components/ui/pill-badge";
import { Separator } from "@/components/ui/separator";
import type { AutomationTriggerType, AutomationActionType, AutomationAction } from "@/types/automation";
import { 
  TRIGGER_LABELS, TRIGGER_DESCRIPTIONS, 
  ACTION_LABELS, ACTION_DESCRIPTIONS, 
  CONDITION_OPERATORS, DYNAMIC_VARIABLES 
} from "./automationConstants";
import { toast } from "@/hooks/use-toast";

interface Props {
  onSave: (rule: {
    name: string;
    description?: string;
    trigger: { type: AutomationTriggerType; conditions?: Record<string, unknown> };
    actions: AutomationAction[];
    enabled: boolean;
  }) => void;
  onCancel: () => void;
}

interface Condition {
  field: string;
  operator: string;
  value: string;
}

export function AutomationWizard({ onSave, onCancel }: Props) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState<AutomationTriggerType | "">("");
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [actions, setActions] = useState<{ type: AutomationActionType | ""; config: Record<string, string>; delay?: number }[]>([
    { type: "", config: {} },
  ]);

  const steps = [
    { label: "Gatilho", icon: Zap, description: "Quando" },
    { label: "Condições", icon: Filter, description: "Se" },
    { label: "Ações", icon: Play, description: "Então" },
  ];

  const triggerKeys = Object.keys(TRIGGER_LABELS) as AutomationTriggerType[];
  const actionKeys = Object.keys(ACTION_LABELS) as AutomationActionType[];

  const addCondition = () => setConditions([...conditions, { field: "", operator: "equals", value: "" }]);
  const removeCondition = (i: number) => setConditions(conditions.filter((_, idx) => idx !== i));

  const addAction = () => setActions([...actions, { type: "", config: {} }]);
  const removeAction = (i: number) => setActions(actions.filter((_, idx) => idx !== i));

  const canNext = () => {
    if (step === 0) return triggerType !== "" && name.trim() !== "";
    if (step === 1) return true; // conditions are optional
    if (step === 2) return actions.some((a) => a.type !== "");
    return false;
  };

  const handleSave = () => {
    if (!triggerType || !name.trim()) return;
    const validActions = actions.filter((a) => a.type !== "");
    if (validActions.length === 0) {
      toast({ title: "Adicione pelo menos uma ação", variant: "destructive" });
      return;
    }
    onSave({
      name,
      description: description || undefined,
      trigger: {
        type: triggerType as AutomationTriggerType,
        conditions: conditions.length > 0
          ? Object.fromEntries(conditions.map((c) => [c.field, { operator: c.operator, value: c.value }]))
          : undefined,
      },
      actions: validActions.map((a) => ({
        type: a.type as AutomationActionType,
        config: a.config,
        delay: a.delay,
      })),
      enabled: true,
    });
  };

  return (
    <div className="space-y-6">
      {/* Step indicators */}
      <div className="flex items-center justify-center gap-2">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <button
              onClick={() => i <= step && setStep(i)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                i === step
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : i < step
                  ? "bg-primary/10 text-primary cursor-pointer"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <s.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{s.label}</span>
              <span className="sm:hidden">{s.description}</span>
            </button>
            {i < steps.length - 1 && (
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>

      {/* Step 0: Trigger */}
      {step === 0 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome da automação</Label>
            <Input
              placeholder="Ex: Follow-up para novos leads"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Descrição (opcional)</Label>
            <Textarea
              placeholder="Descreva o que essa automação faz..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <Separator />
          <div className="space-y-2">
            <Label>Quando isso acontecer...</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {triggerKeys.map((key) => (
                <Card
                  key={key}
                  className={`cursor-pointer transition-all card-touch ${
                    triggerType === key
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "hover:border-primary/20"
                  }`}
                  onClick={() => setTriggerType(key)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2">
                      {triggerType === key && <Check className="h-4 w-4 text-primary shrink-0" />}
                      <div>
                        <p className="text-sm font-medium">{TRIGGER_LABELS[key]}</p>
                        <p className="text-[10px] text-muted-foreground">{TRIGGER_DESCRIPTIONS[key]}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Conditions */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm">Condições adicionais</h3>
              <p className="text-xs text-muted-foreground">Opcional: refine quando a automação deve disparar.</p>
            </div>
            <Button variant="outline" size="sm" onClick={addCondition}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
            </Button>
          </div>

          {conditions.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-6 text-center">
                <Filter className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma condição adicionada. A automação será executada sempre que o gatilho ocorrer.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {conditions.map((cond, i) => (
                <Card key={i}>
                  <CardContent className="p-3 flex flex-wrap items-end gap-2">
                    {i > 0 && <PillBadge size="sm" variant="muted" className="mb-1">E</PillBadge>}
                    <div className="flex-1 min-w-[120px]">
                      <Label className="text-xs">Campo</Label>
                      <Input
                        placeholder="Ex: etapa, valor, bairro"
                        value={cond.field}
                        onChange={(e) => {
                          const c = [...conditions];
                          c[i].field = e.target.value;
                          setConditions(c);
                        }}
                      />
                    </div>
                    <div className="w-[140px]">
                      <Label className="text-xs">Operador</Label>
                      <Select
                        value={cond.operator}
                        onValueChange={(v) => {
                          const c = [...conditions];
                          c[i].operator = v;
                          setConditions(c);
                        }}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CONDITION_OPERATORS.map((op) => (
                            <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {!["is_empty", "is_not_empty"].includes(cond.operator) && (
                      <div className="flex-1 min-w-[120px]">
                        <Label className="text-xs">Valor</Label>
                        <Input
                          placeholder="Ex: proposta"
                          value={cond.value}
                          onChange={(e) => {
                            const c = [...conditions];
                            c[i].value = e.target.value;
                            setConditions(c);
                          }}
                        />
                      </div>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeCondition(i)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Actions */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm">Então faça...</h3>
              <p className="text-xs text-muted-foreground">Escolha as ações a serem executadas.</p>
            </div>
            <Button variant="outline" size="sm" onClick={addAction}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Ação
            </Button>
          </div>

          <div className="space-y-3">
            {actions.map((action, i) => (
              <Card key={i}>
                <CardContent className="p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <PillBadge size="sm" variant="default">Ação {i + 1}</PillBadge>
                    {actions.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeAction(i)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs">Tipo de ação</Label>
                    <Select
                      value={action.type}
                      onValueChange={(v) => {
                        const a = [...actions];
                        a[i] = { ...a[i], type: v as AutomationActionType };
                        setActions(a);
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {actionKeys.map((key) => (
                          <SelectItem key={key} value={key}>
                            <div>
                              <span>{ACTION_LABELS[key]}</span>
                              {(key === "send_email" || key === "send_whatsapp") && (
                                <span className="ml-1 text-muted-foreground">(em breve)</span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {action.type && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {ACTION_DESCRIPTIONS[action.type as AutomationActionType]}
                      </p>
                    )}
                  </div>

                  {/* Action config fields */}
                  {action.type === "create_task" && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs">Título da tarefa</Label>
                        <Input
                          placeholder="Follow-up: {{nome}}"
                          value={action.config.title || ""}
                          onChange={(e) => {
                            const a = [...actions];
                            a[i].config = { ...a[i].config, title: e.target.value };
                            setActions(a);
                          }}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Prazo (horas)</Label>
                        <Input
                          type="number"
                          placeholder="24"
                          value={action.config.due_in_hours || ""}
                          onChange={(e) => {
                            const a = [...actions];
                            a[i].config = { ...a[i].config, due_in_hours: e.target.value };
                            setActions(a);
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {action.type === "send_notification" && (
                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs">Mensagem</Label>
                        <Textarea
                          placeholder="Olá {{nome}}, temos novidades!"
                          value={action.config.message || ""}
                          onChange={(e) => {
                            const a = [...actions];
                            a[i].config = { ...a[i].config, message: e.target.value };
                            setActions(a);
                          }}
                          rows={2}
                        />
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {DYNAMIC_VARIABLES.slice(0, 4).map((v) => (
                          <button
                            key={v.key}
                            type="button"
                            className="text-[10px] px-2 py-0.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                            onClick={() => {
                              const a = [...actions];
                              a[i].config = { ...a[i].config, message: (a[i].config.message || "") + v.key };
                              setActions(a);
                            }}
                          >
                            {v.key}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {action.type === "update_stage" && (
                    <div>
                      <Label className="text-xs">Nova etapa</Label>
                      <Select
                        value={action.config.new_stage || ""}
                        onValueChange={(v) => {
                          const a = [...actions];
                          a[i].config = { ...a[i].config, new_stage: v };
                          setActions(a);
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="contato_inicial">Contato Inicial</SelectItem>
                          <SelectItem value="qualificacao">Qualificação</SelectItem>
                          <SelectItem value="visita">Visita</SelectItem>
                          <SelectItem value="proposta">Proposta</SelectItem>
                          <SelectItem value="negociacao">Negociação</SelectItem>
                          <SelectItem value="fechado_ganho">Fechado (Ganho)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Delay */}
                  <div>
                    <Label className="text-xs">Atraso (minutos, 0 = imediato)</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={action.delay ?? ""}
                      onChange={(e) => {
                        const a = [...actions];
                        a[i].delay = parseInt(e.target.value) || 0;
                        setActions(a);
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button variant="ghost" onClick={step === 0 ? onCancel : () => setStep(step - 1)}>
          {step === 0 ? (
            "Cancelar"
          ) : (
            <><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</>
          )}
        </Button>
        {step < 2 ? (
          <Button onClick={() => setStep(step + 1)} disabled={!canNext()}>
            Próximo <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleSave} disabled={!canNext()} variant="default">
            <Check className="h-4 w-4 mr-1" /> Criar Automação
          </Button>
        )}
      </div>
    </div>
  );
}
