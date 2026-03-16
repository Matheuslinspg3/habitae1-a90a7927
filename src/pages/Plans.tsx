import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Building2, Search, Send, Users, Heart, BarChart3, MessageCircle, Clock,
  Shield, Check, Crown, Star, Briefcase, Sparkles, Image, Video, Megaphone,
  FileText, CalendarDays, Link, Import, Activity, CreditCard, Calendar,
  CheckCircle2, AlertTriangle, XCircle, RefreshCw, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSubscription, SubscriptionPlan } from "@/hooks/useSubscription";
import { useAuth } from "@/contexts/AuthContext";
import { CheckoutDialog } from "@/components/billing/CheckoutDialog";
import { format, differenceInDays, differenceInHours, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

/* ─── Status config ─── */
const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }> = {
  active: { label: "Ativo", variant: "default", icon: CheckCircle2 },
  trial: { label: "Período de teste", variant: "secondary", icon: Clock },
  overdue: { label: "Pagamento pendente", variant: "destructive", icon: AlertTriangle },
  cancelled: { label: "Cancelado", variant: "outline", icon: XCircle },
  suspended: { label: "Suspenso", variant: "destructive", icon: AlertTriangle },
  expired: { label: "Expirado", variant: "outline", icon: XCircle },
  pending: { label: "Pendente", variant: "secondary", icon: Clock },
};

const methodLabels: Record<string, string> = {
  pix: "PIX",
  credit: "Cartão de Crédito",
  credit_card: "Cartão de Crédito/Débito",
  boleto: "Boleto Bancário",
};

/* ─── Plan UI map ─── */
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

/* ─── Current Plan Section ─── */
function CurrentPlanSection() {
  const { trialInfo } = useAuth();
  const { subscription, payments, loadingSub, loadingPayments, cancel, isOverdue, isCancelled } = useSubscription();

  const status = subscription?.status || "cancelled";
  const cfg = statusConfig[status] || statusConfig.cancelled;
  const StatusIcon = cfg.icon;

  // Trial info
  const hasTrial = trialInfo && trialInfo.trial_ends_at;
  const now = new Date();
  const endsAt = hasTrial ? parseISO(trialInfo.trial_ends_at!) : null;
  const startedAt = hasTrial && trialInfo.trial_started_at ? parseISO(trialInfo.trial_started_at) : null;
  const isExpired = trialInfo?.is_trial_expired || false;
  const daysRemaining = endsAt ? Math.max(0, differenceInDays(endsAt, now)) : 0;
  const hoursRemaining = endsAt ? Math.max(0, differenceInHours(endsAt, now) % 24) : 0;
  const totalTrialDays = startedAt && endsAt ? differenceInDays(endsAt, startedAt) : 7;
  const daysElapsed = startedAt ? differenceInDays(now, startedAt) : totalTrialDays - daysRemaining;
  const progressPercent = Math.min(100, Math.max(0, (daysElapsed / totalTrialDays) * 100));

  const recentPayments = (payments || []).slice(0, 3);

  if (loadingSub) {
    return <Skeleton className="h-40 rounded-xl" />;
  }

  if (!subscription && !hasTrial) return null;

  return (
    <Card className="mb-8 border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Sua assinatura
            </CardTitle>
            <CardDescription>Gerencie seu plano, renovação e pagamento</CardDescription>
          </div>
          <Badge variant={cfg.variant} className="gap-1">
            <StatusIcon className="h-3 w-3" />
            {cfg.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Subscription details */}
        {subscription && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Plano atual</p>
              <p className="font-semibold text-lg">{subscription.plan?.name || "—"}</p>
              <p className="text-sm font-medium text-primary">
                R$ {Number(subscription.plan?.price_monthly || 0).toFixed(0)}/mês
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Próxima renovação</p>
                  <p className="text-sm font-medium">
                    {subscription.current_period_end
                      ? format(new Date(subscription.current_period_end), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                      : "—"}
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Método de pagamento</p>
                  <p className="text-sm font-medium">
                    {methodLabels[subscription.payment_method || ""] || "Não definido"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Trial countdown */}
        {hasTrial && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className={cn(
                "flex items-center gap-4 p-4 rounded-xl border",
                isExpired
                  ? "bg-destructive/10 border-destructive/20"
                  : daysRemaining <= 3
                    ? "bg-warning/10 border-warning/20"
                    : "bg-primary/5 border-primary/20"
              )}>
                {isExpired ? (
                  <AlertTriangle className="h-10 w-10 flex-shrink-0 text-destructive" />
                ) : daysRemaining <= 3 ? (
                  <Clock className="h-10 w-10 flex-shrink-0 text-warning" />
                ) : (
                  <CheckCircle2 className="h-10 w-10 flex-shrink-0 text-primary" />
                )}
                <div className="flex-1 min-w-0">
                  {isExpired ? (
                    <>
                      <p className="font-bold text-sm">Período de teste encerrado</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Seu teste gratuito expirou em {endsAt && format(endsAt, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold tabular-nums">{daysRemaining}</span>
                        <span className="text-sm text-muted-foreground">
                          {daysRemaining === 1 ? "dia" : "dias"}
                          {hoursRemaining > 0 && ` e ${hoursRemaining}h`}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Teste gratuito até {endsAt && format(endsAt, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                    </>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{startedAt && `Início: ${format(startedAt, "dd/MM/yyyy")}`}</span>
                  <span>{endsAt && `Término: ${format(endsAt, "dd/MM/yyyy")}`}</span>
                </div>
                <Progress value={progressPercent} className="h-2.5" />
              </div>
            </div>
          </>
        )}

        {/* Overdue banner */}
        {isOverdue && (
          <div className="flex items-center gap-3 p-4 rounded-lg border border-destructive/50 bg-destructive/5">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">Pagamento pendente</p>
              <p className="text-xs text-muted-foreground">Sua assinatura está com pagamento em atraso.</p>
            </div>
          </div>
        )}

        {/* Recent payments */}
        {recentPayments.length > 0 && !loadingPayments && (
          <>
            <Separator />
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Últimos pagamentos</p>
              <div className="space-y-2">
                {recentPayments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm py-1.5 px-2 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>R$ {(p.amount_cents / 100).toFixed(2)}</span>
                      <span className="text-xs text-muted-foreground">
                        {methodLabels[p.method || ""] || p.method}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(p.created_at), "dd/MM/yyyy")}
                      </span>
                      <Badge variant={p.status === "confirmed" ? "default" : p.status === "pending" ? "secondary" : "destructive"} className="text-xs h-5">
                        {p.status === "confirmed" ? "Pago" : p.status === "pending" ? "Pendente" : p.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Cancel action */}
        {subscription && !isCancelled && subscription.status !== "expired" && (
          <>
            <Separator />
            <div className="flex justify-end">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                    <XCircle className="h-3.5 w-3.5 mr-1" /> Cancelar assinatura
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancelar assinatura</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja cancelar sua assinatura do plano <strong>{subscription.plan?.name}</strong>?
                      Você perderá acesso às funcionalidades premium ao final do período atual.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Manter plano</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => cancel.mutate()}
                      disabled={cancel.isPending}
                    >
                      {cancel.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Confirmar cancelamento
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Main Page ─── */
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
          <Skeleton className="h-40 rounded-xl mb-8" />
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-96 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const sortedPlans = [...plans].sort((a, b) => a.display_order - b.display_order);

  return (
    <div className="flex flex-col min-h-screen page-enter">
      <PageHeader title="Planos" description="Escolha o plano ideal para o seu negócio" />

      <div className="flex-1 p-4 sm:p-6">
        {/* Current plan section */}
        <CurrentPlanSection />

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

                {isCurrentPlan && (
                  <Badge variant="outline" className="absolute top-4 right-4 text-xs border-primary text-primary">
                    Plano atual
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
