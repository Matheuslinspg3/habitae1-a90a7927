import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Building2,
  Search,
  Send,
  Users,
  Heart,
  BarChart3,
  MessageCircle,
  Clock,
  Shield,
  Check,
  Crown,
  Star,
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PlanFeature {
  text: string;
  icon: React.ElementType;
}

interface Plan {
  id: string;
  name: string;
  price: string;
  priceNote?: string;
  description: string;
  tip: string;
  features: PlanFeature[];
  includesFrom?: string;
  highlighted?: boolean;
  color: string;
  icon: React.ElementType;
  badge?: string;
}

const plans: Plan[] = [
  {
    id: "biblioteca",
    name: "Biblioteca",
    price: "R$ 100",
    priceNote: "/mês",
    description: "Acesso à base de imóveis para trabalhar com clientes.",
    tip: "Ideal para corretores que querem ter imóveis para oferecer aos clientes.",
    color: "from-emerald-500 to-teal-600",
    icon: Building2,
    features: [
      { text: "Acesso à biblioteca completa de imóveis", icon: Building2 },
      { text: "Busca e filtros avançados", icon: Search },
      { text: "Informações completas dos imóveis", icon: Check },
      { text: "Envio de imóveis para clientes", icon: Send },
      { text: "Atualizações frequentes de novos imóveis", icon: Clock },
    ],
  },
  {
    id: "corretor",
    name: "Corretor",
    price: "R$ 150",
    priceNote: "/mês",
    description: "Para corretores que querem melhorar o atendimento ao cliente.",
    tip: "Ajuda o corretor a encontrar imóveis ideais para cada cliente mais rápido.",
    color: "from-blue-500 to-indigo-600",
    icon: Star,
    badge: "Mais escolhido",
    highlighted: true,
    includesFrom: "Biblioteca",
    features: [
      { text: "CRM de clientes", icon: Users },
      { text: "Cadastro e organização de leads", icon: Check },
      { text: "Imóveis sugeridos automaticamente para cada cliente", icon: Search },
      { text: "Favoritar imóveis por cliente", icon: Heart },
      { text: "Organização do funil de atendimento", icon: BarChart3 },
    ],
  },
  {
    id: "profissional",
    name: "Profissional",
    price: "R$ 200",
    priceNote: "/mês",
    description: "Para corretores com maior volume de atendimentos.",
    tip: "Ideal para corretores que querem ganhar produtividade e acompanhar resultados.",
    color: "from-purple-500 to-violet-600",
    icon: Briefcase,
    includesFrom: "Corretor",
    features: [
      { text: "Integração com WhatsApp", icon: MessageCircle },
      { text: "Relatórios de atendimento e desempenho", icon: BarChart3 },
      { text: "Histórico completo de interações", icon: Clock },
      { text: "Organização avançada de leads", icon: Users },
      { text: "Prioridade no suporte", icon: Shield },
    ],
  },
  {
    id: "imobiliaria",
    name: "Imobiliária",
    price: "Sob consulta",
    description: "Para equipes a partir de 6 usuários.",
    tip: "Valor sob consulta conforme número de acessos.",
    color: "from-slate-600 to-slate-800",
    icon: Crown,
    includesFrom: "Profissional",
    features: [
      { text: "Gestão de equipe", icon: Users },
      { text: "Biblioteca compartilhada", icon: Building2 },
      { text: "Controle de leads da equipe", icon: BarChart3 },
      { text: "Condições personalizadas", icon: Shield },
    ],
  },
];

export default function Plans() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleSelectPlan = async (planId: string) => {
    setLoadingPlan(planId);
    // TODO: Integrar com Asaas para cobrança
    setTimeout(() => setLoadingPlan(null), 1500);
  };

  return (
    <div className="flex flex-col min-h-screen page-enter">
      <PageHeader
        title="Planos"
        description="Escolha o plano ideal para o seu negócio"
      />

      <div className="flex-1 p-4 sm:p-6">
        {/* Value ladder summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { price: "R$ 100", label: "Acesso aos imóveis", color: "bg-emerald-500" },
            { price: "R$ 150", label: "Ajuda a vender melhor", color: "bg-blue-500" },
            { price: "R$ 200", label: "Automação e gestão", color: "bg-purple-500" },
            { price: "Consulta", label: "Para equipes", color: "bg-slate-600" },
          ].map((item) => (
            <div key={item.price} className="flex items-center gap-2 p-3 rounded-xl border bg-card">
              <div className={cn("w-2 h-8 rounded-full", item.color)} />
              <div>
                <p className="text-sm font-bold">{item.price}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Plan cards */}
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => {
            const Icon = plan.icon;
            return (
              <Card
                key={plan.id}
                className={cn(
                  "relative overflow-hidden transition-all duration-200 hover:shadow-lg",
                  plan.highlighted && "ring-2 ring-primary shadow-lg scale-[1.02]"
                )}
              >
                {/* Gradient header */}
                <div className={cn("h-2 bg-gradient-to-r", plan.color)} />

                {plan.badge && (
                  <Badge className="absolute top-4 right-4 bg-primary text-primary-foreground text-xs">
                    {plan.badge}
                  </Badge>
                )}

                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br text-white",
                      plan.color
                    )}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-lg">Plano {plan.name}</CardTitle>
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    {plan.priceNote && (
                      <span className="text-sm text-muted-foreground">{plan.priceNote}</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                </CardHeader>

                <CardContent className="space-y-4">
                  {plan.includesFrom && (
                    <p className="text-xs font-medium text-muted-foreground">
                      ✅ Inclui tudo do plano {plan.includesFrom} +
                    </p>
                  )}

                  <ul className="space-y-2.5">
                    {plan.features.map((feature) => {
                      const FeatureIcon = feature.icon;
                      return (
                        <li key={feature.text} className="flex items-start gap-2.5 text-sm">
                          <FeatureIcon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          <span>{feature.text}</span>
                        </li>
                      );
                    })}
                  </ul>

                  <Separator />

                  <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
                    <span className="text-base">💡</span>
                    <p className="text-xs text-muted-foreground leading-relaxed">{plan.tip}</p>
                  </div>

                  <Button
                    className="w-full"
                    variant={plan.highlighted ? "default" : "outline"}
                    size="lg"
                    disabled={loadingPlan !== null}
                    onClick={() => handleSelectPlan(plan.id)}
                  >
                    {loadingPlan === plan.id ? (
                      <span className="animate-spin mr-2">⏳</span>
                    ) : null}
                    {plan.id === "imobiliaria" ? "Falar com consultor" : "Assinar plano"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
