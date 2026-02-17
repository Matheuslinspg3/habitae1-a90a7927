import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Check, Loader2, Crown, Zap, Building2, QrCode, CreditCard, Banknote } from "lucide-react";
import { useSubscription, type SubscriptionPlan } from "@/hooks/useSubscription";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const planIcons: Record<string, React.ElementType> = {
  starter: Zap,
  pro: Crown,
  enterprise: Building2,
};

const planColors: Record<string, string> = {
  starter: "border-primary/30",
  pro: "border-primary",
  enterprise: "border-primary",
};

// Group plans by base slug
function groupPlans(plans: SubscriptionPlan[]) {
  const groups: { slug: string; name: string; description: string | null; monthly: SubscriptionPlan; yearly?: SubscriptionPlan }[] = [];
  
  for (const plan of plans) {
    const existing = groups.find(g => g.slug === plan.slug);
    if (!existing) {
      groups.push({
        slug: plan.slug,
        name: plan.name,
        description: plan.description,
        monthly: plan,
      });
    }
  }
  return groups;
}

export function PlanCatalogDialog({ open, onOpenChange }: Props) {
  const { plans, subscription, subscribe } = useSubscription();
  const [isYearly, setIsYearly] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [step, setStep] = useState<"plans" | "payment">("plans");
  const [pixData, setPixData] = useState<{ qrCode: string; copyPaste: string } | null>(null);

  const currentPlanId = subscription?.plan_id;

  const handleSelectPlan = (planId: string) => {
    if (planId === currentPlanId) return;
    setSelectedPlan(planId);
    setStep("payment");
  };

  const handleSubscribe = async () => {
    if (!selectedPlan) return;
    try {
      const result = await subscribe.mutateAsync({
        planId: selectedPlan,
        billingCycle: isYearly ? "yearly" : "monthly",
        paymentMethod,
      });
      if (result.pixData) {
        setPixData({
          qrCode: result.pixData.qrCode,
          copyPaste: result.pixData.copyPaste,
        });
      } else {
        onOpenChange(false);
        setStep("plans");
      }
    } catch {
      // error handled by mutation
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setStep("plans");
    setSelectedPlan(null);
    setPixData(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {pixData ? "Pagamento PIX" : step === "payment" ? "Forma de Pagamento" : "Escolha seu Plano"}
          </DialogTitle>
          <DialogDescription>
            {pixData
              ? "Escaneie o QR Code ou copie o código para pagar"
              : step === "payment"
                ? "Selecione como deseja pagar"
                : "Selecione o plano ideal para você"}
          </DialogDescription>
        </DialogHeader>

        {/* PIX QR Code Screen */}
        {pixData ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="p-4 bg-background border rounded-xl">
              <img
                src={`data:image/png;base64,${pixData.qrCode}`}
                alt="QR Code PIX"
                className="w-48 h-48"
              />
            </div>
            <div className="w-full space-y-2">
              <p className="text-xs text-muted-foreground text-center">Ou copie o código:</p>
              <div className="flex gap-2">
                <code className="flex-1 p-2 bg-muted rounded text-xs break-all max-h-20 overflow-y-auto">
                  {pixData.copyPaste}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(pixData.copyPaste);
                    toast.success("Código copiado!");
                  }}
                >
                  Copiar
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Após o pagamento, sua assinatura será ativada automaticamente.
            </p>
            <Button onClick={handleClose}>Fechar</Button>
          </div>
        ) : step === "payment" ? (
          /* Payment Method Step */
          <div className="space-y-4">
            <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-2">
              <label className={cn(
                "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                paymentMethod === "pix" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              )}>
                <RadioGroupItem value="pix" />
                <QrCode className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">PIX</p>
                  <p className="text-xs text-muted-foreground">Pagamento instantâneo via QR Code</p>
                </div>
              </label>
              <label className={cn(
                "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                paymentMethod === "credit" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              )}>
                <RadioGroupItem value="credit" />
                <CreditCard className="h-5 w-5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Cartão de Crédito</p>
                  <p className="text-xs text-muted-foreground">Cobrança recorrente automática</p>
                </div>
              </label>
              <label className={cn(
                "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                paymentMethod === "debit" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              )}>
                <RadioGroupItem value="debit" />
                <Banknote className="h-5 w-5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Boleto/Débito</p>
                  <p className="text-xs text-muted-foreground">Boleto bancário</p>
                </div>
              </label>
            </RadioGroup>

            <Separator />

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("plans")} className="flex-1">
                Voltar
              </Button>
              <Button onClick={handleSubscribe} disabled={subscribe.isPending} className="flex-1">
                {subscribe.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Assinar agora
              </Button>
            </div>
          </div>
        ) : (
          /* Plan Selection Step */
          <div className="space-y-4">
            {/* Toggle monthly/yearly */}
            <div className="flex items-center justify-center gap-3">
              <span className={cn("text-sm", !isYearly && "font-semibold")}>Mensal</span>
              <Switch checked={isYearly} onCheckedChange={setIsYearly} />
              <span className={cn("text-sm", isYearly && "font-semibold")}>
                Anual
                <Badge variant="secondary" className="ml-1.5 text-[10px]">-20%</Badge>
              </span>
            </div>

            {/* Plan Cards */}
            <div className="grid gap-3">
              {plans.map((plan) => {
                const Icon = planIcons[plan.slug] || Zap;
                const isCurrent = plan.id === currentPlanId;
                const price = isYearly ? plan.price_yearly : plan.price_monthly;
                const monthlyEquiv = isYearly ? (Number(plan.price_yearly) / 12) : Number(plan.price_monthly);
                const isPro = plan.slug === "pro";

                // Build features list from plan data
                const features: string[] = [];
                if (plan.max_own_properties) features.push(`Até ${plan.max_own_properties} imóveis`);
                else features.push("Imóveis ilimitados");
                if (plan.max_users) features.push(`${plan.max_users} usuário${plan.max_users > 1 ? 's' : ''}`);
                else features.push("Usuários ilimitados");
                if (plan.max_leads) features.push(`${plan.max_leads} leads`);
                else features.push("Leads ilimitados");
                if (plan.marketplace_access) features.push("Marketplace");
                if (plan.partnership_access) features.push("Parcerias");
                if (plan.priority_support) features.push("Suporte prioritário");

                return (
                  <Card key={plan.id} className={cn(
                    "relative transition-all",
                    isPro && "ring-2 ring-primary",
                    isCurrent && "bg-primary/5",
                    planColors[plan.slug]
                  )}>
                    {isPro && (
                      <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px]">
                        Mais popular
                      </Badge>
                    )}
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{plan.name}</h3>
                            {isCurrent && <Badge variant="outline" className="text-[10px]">Atual</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">{plan.description}</p>

                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {features.map((f) => (
                              <span key={f} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Check className="h-3 w-3 text-primary" />
                                {f}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-lg font-bold">
                            R$ {monthlyEquiv.toFixed(0)}
                            <span className="text-xs text-muted-foreground font-normal">/mês</span>
                          </p>
                          {isYearly && (
                            <p className="text-[10px] text-muted-foreground">
                              R$ {Number(price).toFixed(0)}/ano
                            </p>
                          )}
                          <Button
                            size="sm"
                            variant={isCurrent ? "outline" : isPro ? "default" : "outline"}
                            className="mt-2"
                            disabled={isCurrent}
                            onClick={() => handleSelectPlan(plan.id)}
                          >
                            {isCurrent ? "Plano atual" : "Selecionar"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
