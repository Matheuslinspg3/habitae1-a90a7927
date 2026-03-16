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
  Sparkles,
  Image,
  Video,
  Megaphone,
  FileText,
  CalendarDays,
  Link,
  Import,
  UserPlus,
  Activity,
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
  priceExtra?: string;
  tagline: string;
  tip: string;
  features: PlanFeature[];
  includesFrom?: string;
  highlighted?: boolean;
  color: string;
  icon: React.ElementType;
  badge?: string;
  cta: string;
}

const plans: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    price: "R$ 97",
    priceNote: "/mês",
    tagline: "Comece a captar imóveis",
    tip: "Barato o suficiente para começar, completo o suficiente para vender.",
    color: "from-emerald-500 to-teal-600",
    icon: Building2,
    cta: "Começar agora",
    features: [
      { text: "Acesso à biblioteca completa de imóveis", icon: Building2 },
      { text: "Busca e filtros avançados", icon: Search },
      { text: "Informações completas dos imóveis", icon: Check },
      { text: "Envio de imóveis para clientes", icon: Send },
      { text: "Página pública do imóvel (landing page)", icon: Link },
      { text: "Atualizações frequentes de novos imóveis", icon: Clock },
    ],
  },
  {
    id: "corretor",
    name: "Corretor",
    price: "R$ 197",
    priceNote: "/mês",
    tagline: "Venda mais com inteligência",
    tip: "A IA encontra os imóveis ideais para cada cliente — você só apresenta.",
    color: "from-blue-500 to-indigo-600",
    icon: Star,
    badge: "Mais popular",
    highlighted: true,
    includesFrom: "Starter",
    cta: "Assinar plano",
    features: [
      { text: "CRM completo (leads, funil, interações)", icon: Users },
      { text: "Gerador de anúncios com IA (WhatsApp, Instagram, Portal)", icon: Sparkles },
      { text: "Imóveis sugeridos automaticamente por cliente", icon: Search },
      { text: "Favoritar imóveis por cliente", icon: Heart },
      { text: "Agenda integrada", icon: CalendarDays },
      { text: "Organização do funil de atendimento", icon: BarChart3 },
    ],
  },
  {
    id: "profissional",
    name: "Profissional",
    price: "R$ 297",
    priceNote: "/mês",
    tagline: "Automatize e escale",
    tip: "Para quem quer parar de fazer trabalho manual e focar em fechar negócios.",
    color: "from-purple-500 to-violet-600",
    icon: Briefcase,
    includesFrom: "Corretor",
    cta: "Assinar plano",
    features: [
      { text: "Integração com WhatsApp", icon: MessageCircle },
      { text: "Gerador de artes (feed, story, banner)", icon: Image },
      { text: "Gerador de vídeos com IA", icon: Video },
      { text: "Meta Ads — leads automáticos", icon: Megaphone },
      { text: "Relatórios de desempenho", icon: BarChart3 },
      { text: "Importação automática (Imobzi)", icon: Import },
      { text: "Contratos e financeiro", icon: FileText },
      { text: "Prioridade no suporte", icon: Shield },
    ],
  },
  {
    id: "imobiliaria",
    name: "Imobiliária",
    price: "R$ 497",
    priceNote: "/mês",
    priceExtra: "+ R$ 47/usuário extra (5 inclusos)",
    tagline: "Gerencie sua equipe",
    tip: "Tudo que sua imobiliária precisa para operar com eficiência máxima.",
    color: "from-slate-600 to-slate-800",
    icon: Crown,
    includesFrom: "Profissional",
    cta: "Falar com consultor",
    features: [
      { text: "Até 5 usuários inclusos", icon: Users },
      { text: "Gestão de equipe e permissões", icon: Shield },
      { text: "Marketplace entre imobiliárias", icon: Building2 },
      { text: "Biblioteca compartilhada", icon: Building2 },
      { text: "Controle de leads da equipe", icon: BarChart3 },
      { text: "Auditoria e logs completos", icon: Activity },
      { text: "Suporte prioritário dedicado", icon: Crown },
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
        {/* Value ladder */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { price: "R$ 97", label: "Captar imóveis", color: "bg-emerald-500" },
            { price: "R$ 197", label: "Vender com IA", color: "bg-blue-500" },
            { price: "R$ 297", label: "Automatizar tudo", color: "bg-purple-500" },
            { price: "R$ 497", label: "Gestão de equipe", color: "bg-slate-600" },
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
                  "relative overflow-hidden transition-all duration-200 hover:shadow-lg flex flex-col",
                  plan.highlighted && "ring-2 ring-primary shadow-lg md:scale-[1.02]"
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
                      "w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br text-white shrink-0",
                      plan.color
                    )}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Plano {plan.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">{plan.tagline}</p>
                    </div>
                  </div>

                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    {plan.priceNote && (
                      <span className="text-sm text-muted-foreground">{plan.priceNote}</span>
                    )}
                  </div>
                  {plan.priceExtra && (
                    <p className="text-xs text-muted-foreground mt-0.5">{plan.priceExtra}</p>
                  )}
                </CardHeader>

                <CardContent className="space-y-4 flex-1 flex flex-col">
                  {plan.includesFrom && (
                    <p className="text-xs font-medium text-muted-foreground">
                      ✅ Inclui tudo do plano {plan.includesFrom} +
                    </p>
                  )}

                  <ul className="space-y-2.5 flex-1">
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
                    {plan.cta}
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
