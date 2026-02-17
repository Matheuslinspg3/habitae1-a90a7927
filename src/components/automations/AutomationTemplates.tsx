import { 
  HandHeart, Thermometer, RotateCcw, CalendarCheck, 
  FileText, Crown, Rocket, Zap 
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PillBadge } from "@/components/ui/pill-badge";

interface Template {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  category: string;
  plan: "free" | "pro" | "enterprise";
  trigger: string;
  actionsCount: number;
}

const templates: Template[] = [
  {
    id: "welcome",
    name: "Boas-vindas automática",
    description: "Envia mensagem de boas-vindas + cria tarefa de follow-up quando um novo lead chega.",
    icon: HandHeart,
    category: "Onboarding",
    plan: "free",
    trigger: "Novo lead criado",
    actionsCount: 2,
  },
  {
    id: "nurture",
    name: "Nutrição básica",
    description: "Sequência de 3 mensagens para manter o lead aquecido ao longo de 7 dias.",
    icon: Thermometer,
    category: "Engajamento",
    plan: "pro",
    trigger: "Lead sem interação há 3 dias",
    actionsCount: 3,
  },
  {
    id: "reactivation",
    name: "Reativação de leads frios",
    description: "Reativa leads sem interação há 15 dias com nova oferta e atualiza etapa.",
    icon: RotateCcw,
    category: "Recuperação",
    plan: "pro",
    trigger: "Lead inativo há 15 dias",
    actionsCount: 2,
  },
  {
    id: "post-visit",
    name: "Pós-visita",
    description: "Após visita concluída, cria tarefa de proposta e move lead no funil.",
    icon: CalendarCheck,
    category: "Conversão",
    plan: "free",
    trigger: "Visita concluída",
    actionsCount: 2,
  },
  {
    id: "post-proposal",
    name: "Pós-proposta",
    description: "Follow-up automático após proposta enviada para não perder o timing.",
    icon: FileText,
    category: "Conversão",
    plan: "pro",
    trigger: "Lead movido para Proposta",
    actionsCount: 2,
  },
  {
    id: "high-end",
    name: "Alto padrão",
    description: "Fluxo premium para leads de imóveis acima de R$ 1M com atendimento VIP.",
    icon: Crown,
    category: "Premium",
    plan: "enterprise",
    trigger: "Lead com valor > R$ 1M",
    actionsCount: 4,
  },
  {
    id: "launch",
    name: "Lançamentos",
    description: "Automação para novos empreendimentos: aviso, agendamento e follow-up.",
    icon: Rocket,
    category: "Marketing",
    plan: "pro",
    trigger: "Novo imóvel cadastrado",
    actionsCount: 3,
  },
];

const planLabels = {
  free: { label: "Free", variant: "muted" as const },
  pro: { label: "Pro", variant: "default" as const },
  enterprise: { label: "Enterprise", variant: "warning" as const },
};

interface Props {
  onUseTemplate: (templateId: string) => void;
  currentPlan: "free" | "pro" | "enterprise";
}

export function AutomationTemplates({ onUseTemplate, currentPlan }: Props) {
  const planOrder = { free: 0, pro: 1, enterprise: 2 };

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
      {templates.map((t) => {
        const locked = planOrder[t.plan] > planOrder[currentPlan];
        const planInfo = planLabels[t.plan];
        return (
          <Card
            key={t.id}
            className={`group hover:border-primary/20 transition-all card-hover-lift ${locked ? "opacity-60" : ""}`}
          >
            <CardContent className="p-4 flex flex-col gap-3 h-full">
              <div className="flex items-start justify-between gap-2">
                <div className={`h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                  <t.icon className="h-5 w-5 text-primary" />
                </div>
                <PillBadge size="sm" variant={planInfo.variant}>
                  {planInfo.label}
                </PillBadge>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm">{t.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <Zap className="h-3 w-3" />
                <span>{t.trigger}</span>
                <span>•</span>
                <span>{t.actionsCount} ações</span>
              </div>
              <Button
                size="sm"
                variant={locked ? "outline" : "default"}
                className="w-full"
                onClick={() => !locked && onUseTemplate(t.id)}
                disabled={locked}
              >
                {locked ? "Upgrade necessário" : "Usar modelo"}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
