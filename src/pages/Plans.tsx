import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
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
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSubscription, SubscriptionPlan } from "@/hooks/useSubscription";
import { CheckoutDialog } from "@/components/billing/CheckoutDialog";

interface PlanUI {
  slug: string;
  tagline: string;
  tip: string;
  features: { text: string; icon: React.ElementType }[];
  includesFrom?: string;
  highlighted?: boolean;
  color: string;
  icon: React.ElementType;
  badge?: string;
  cta: string;
  priceExtra?: string;
}

const planUIMap: Record<string, PlanUI> = {
  starter: {
    slug: "starter",
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
  corretor: {
    slug: "corretor",
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
  profissional: {
    slug: "profissional",
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
  imobiliaria: {
    slug: "imobiliaria",
    tagline: "Gerencie sua equipe",
    tip: "Tudo que sua imobiliária precisa para operar com eficiência máxima.",
    color: "from-slate-600 to-slate-800",
    icon: Crown,
    includesFrom: "Profissional",
    cta: "Falar com consultor",
    priceExtra: "+ R$ 47/usuário extra (5 inclusos)",
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
};

export default function Plans() {
  const { plans, subscription, loadingPlans } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    if (plan.slug === "imobiliaria") {
      window.open("https://wa.me/5511999999999?text=Quero%20saber%20mais%20sobre%20o%20plano%20Imobili%C3%A1ria", "_blank");
      return;
    }
    setSelectedPlan(plan);
    setCheckoutOpen(true);
  };

  const currentPlanSlug = subscription?.plan?.slug;

  if (loadingPlans) {
    return (
      <div className="flex flex-col min-h-screen page-enter">
        <PageHeader title="Planos" description="Escolha o plano ideal para o seu negócio" />
        <div className="flex-1 p-4 sm:p-6">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-96 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Sort plans by display_order and merge with UI config
  const sortedPlans = [...plans].sort((a, b) => a.display_order - b.display_order);

  return (
    <div className="flex flex-col min-h-screen page-enter">
      <PageHeader
        title="Planos"
        description="Escolha o plano ideal para o seu negócio"
      />

      <div className="flex-1 p-4 sm:p-6">
        {/* Value ladder */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {sortedPlans.map((plan) => {
            const ui = planUIMap[plan.slug];
            if (!ui) return null;
            return (
              <div key={plan.id} className="flex items-center gap-2 p-3 rounded-xl border bg-card">
                <div className={cn("w-2 h-8 rounded-full bg-gradient-to-b", ui.color)} />
                <div>
                  <p className="text-sm font-bold">R$ {Number(plan.price_monthly).toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground">{ui.tagline}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Current plan indicator */}
        {subscription && currentPlanSlug && (
          <div className="mb-6 p-3 rounded-lg border bg-primary/5 border-primary/20 flex items-center gap-2">
            <Check className="h-4 w-4 text-primary" />
            <p className="text-sm">
              Seu plano atual: <strong>{subscription.plan?.name}</strong>
              {subscription.status === "active" && <Badge variant="outline" className="ml-2 text-xs">Ativo</Badge>}
              {subscription.status === "pending" && <Badge variant="secondary" className="ml-2 text-xs">Pendente</Badge>}
              {subscription.status === "trial" && <Badge variant="secondary" className="ml-2 text-xs">Trial</Badge>}
            </p>
          </div>
        )}

        {/* Plan cards */}
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {sortedPlans.map((plan) => {
            const ui = planUIMap[plan.slug];
            if (!ui) return null;
            const Icon = ui.icon;
            const isCurrentPlan = currentPlanSlug === plan.slug;

            return (
              <Card
                key={plan.id}
                className={cn(
                  "relative overflow-hidden transition-all duration-200 hover:shadow-lg flex flex-col",
                  ui.highlighted && "ring-2 ring-primary shadow-lg md:scale-[1.02]",
                  isCurrentPlan && "ring-2 ring-primary/50"
                )}
              >
                <div className={cn("h-2 bg-gradient-to-r", ui.color)} />

                {ui.badge && (
                  <Badge className="absolute top-4 right-4 bg-primary text-primary-foreground text-xs">
                    {ui.badge}
                  </Badge>
                )}

                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br text-white shrink-0",
                      ui.color
                    )}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Plano {plan.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">{ui.tagline}</p>
                    </div>
                  </div>

                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-3xl font-bold">R$ {Number(plan.price_monthly).toFixed(0)}</span>
                    <span className="text-sm text-muted-foreground">/mês</span>
                  </div>
                  {ui.priceExtra && (
                    <p className="text-xs text-muted-foreground mt-0.5">{ui.priceExtra}</p>
                  )}
                </CardHeader>

                <CardContent className="space-y-4 flex-1 flex flex-col">
                  {ui.includesFrom && (
                    <p className="text-xs font-medium text-muted-foreground">
                      ✅ Inclui tudo do plano {ui.includesFrom} +
                    </p>
                  )}

                  <ul className="space-y-2.5 flex-1">
                    {ui.features.map((feature) => {
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
                    <p className="text-xs text-muted-foreground leading-relaxed">{ui.tip}</p>
                  </div>

                  <Button
                    className="w-full"
                    variant={isCurrentPlan ? "secondary" : ui.highlighted ? "default" : "outline"}
                    size="lg"
                    disabled={isCurrentPlan}
                    onClick={() => handleSelectPlan(plan)}
                  >
                    {isCurrentPlan ? "Plano atual" : ui.cta}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        plan={selectedPlan}
      />
    </div>
  );
}
