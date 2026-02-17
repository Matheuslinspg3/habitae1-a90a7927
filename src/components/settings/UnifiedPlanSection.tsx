import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  CreditCard, Calendar, Shield, RefreshCw, XCircle, ArrowUpRight,
  Loader2, CheckCircle2, Clock, AlertTriangle, Receipt, QrCode, Copy,
  Banknote, Crown, User,
} from "lucide-react";
import { format, differenceInDays, differenceInHours, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }> = {
  active: { label: "Ativo", variant: "default", icon: CheckCircle2 },
  trial: { label: "Período de teste", variant: "secondary", icon: Clock },
  overdue: { label: "Pagamento pendente", variant: "destructive", icon: AlertTriangle },
  cancelled: { label: "Cancelado", variant: "outline", icon: XCircle },
  suspended: { label: "Suspenso", variant: "destructive", icon: AlertTriangle },
  expired: { label: "Expirado", variant: "outline", icon: XCircle },
};

const methodLabels: Record<string, string> = {
  pix: "PIX",
  credit: "Cartão de Crédito",
  boleto: "Boleto Bancário",
  credit_card: "Cartão de Crédito",
};

const paymentStatusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "secondary" },
  confirmed: { label: "Confirmado", variant: "default" },
  failed: { label: "Falhou", variant: "destructive" },
  refunded: { label: "Reembolsado", variant: "outline" },
};

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function isValidCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let check = 11 - (sum % 11);
  if (check >= 10) check = 0;
  if (parseInt(digits[9]) !== check) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  check = 11 - (sum % 11);
  if (check >= 10) check = 0;
  return parseInt(digits[10]) === check;
}

export function UnifiedPlanSection() {
  const { trialInfo, profile } = useAuth();
  const { subscription, payments, plans, loadingSub, loadingPayments, subscribe, cancel, isOverdue, isCancelled } = useSubscription();

  const [showCheckout, setShowCheckout] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [cpf, setCpf] = useState("");
  const [pixData, setPixData] = useState<{ qrCode: string; copyPaste: string } | null>(null);

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

  const handleSubscribe = async () => {
    if (!fullName.trim()) {
      toast.error("Informe seu nome completo.");
      return;
    }
    if (!isValidCpf(cpf)) {
      toast.error("CPF inválido. Verifique e tente novamente.");
      return;
    }

    try {
      // Find the Professional plan UUID from the plans list
      const proPlan = plans.find(p => p.slug === "pro");
      const planId = subscription?.plan_id || proPlan?.id;
      if (!planId) {
        toast.error("Plano não encontrado. Tente novamente.");
        return;
      }
      const result = await subscribe.mutateAsync({
        planId,
        billingCycle: "monthly",
        paymentMethod,
        customerName: fullName.trim(),
        customerCpf: cpf.replace(/\D/g, ""),
      });
      if (result.pixData) {
        setPixData({
          qrCode: result.pixData.qrCode,
          copyPaste: result.pixData.copyPaste,
        });
      } else {
        setShowCheckout(false);
        toast.success("Assinatura ativada com sucesso!");
      }
    } catch {
      // error handled by mutation
    }
  };

  if (loadingSub) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main Card - Plan Status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Plano e Assinatura
              </CardTitle>
              <CardDescription>Gerencie seu plano, renovação e forma de pagamento</CardDescription>
            </div>
            <Badge variant={cfg.variant} className="gap-1">
              <StatusIcon className="h-3 w-3" />
              {cfg.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Active subscription info */}
          {subscription && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Plano atual</p>
                <p className="font-semibold text-lg">{subscription.plan?.name || "Professional"}</p>
                <p className="text-xs text-muted-foreground">{subscription.plan?.description}</p>
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

          {/* Trial countdown (only if in trial) */}
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
                      : "bg-success/10 border-success/20"
                )}>
                  {isExpired ? (
                    <AlertTriangle className="h-10 w-10 flex-shrink-0 text-destructive" />
                  ) : daysRemaining <= 3 ? (
                    <Clock className="h-10 w-10 flex-shrink-0 text-warning" />
                  ) : (
                    <CheckCircle2 className="h-10 w-10 flex-shrink-0 text-success" />
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

                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{startedAt && `Início: ${format(startedAt, "dd/MM/yyyy")}`}</span>
                    <span>{endsAt && `Término: ${format(endsAt, "dd/MM/yyyy")}`}</span>
                  </div>
                  <Progress value={progressPercent} className="h-2.5" />
                  <p className="text-xs text-muted-foreground text-center">
                    {isExpired ? "100% do período utilizado" : `${Math.round(progressPercent)}% do período utilizado`}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* If no subscription, show Professional plan card */}
          {!subscription && (
            <>
              <Separator />
              <div className="rounded-xl border-2 border-primary p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Crown className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">Professional</h3>
                      <p className="text-sm text-muted-foreground">Acesso completo a todas as funcionalidades</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">
                      R$ {plans.find(p => p.slug === "pro")?.price_monthly?.toFixed(0) || "5"}
                      <span className="text-sm text-muted-foreground font-normal">/mês</span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    "Imóveis ilimitados",
                    "Leads ilimitados",
                    "Marketplace",
                    "Parcerias",
                    "Suporte prioritário",
                    "Automações",
                    "CRM completo",
                    "Relatórios avançados",
                  ].map((f) => (
                    <span key={f} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                      {f}
                    </span>
                  ))}
                </div>

                <Button className="w-full" size="lg" onClick={() => setShowCheckout(true)}>
                  <Crown className="h-4 w-4 mr-2" />
                  Assinar Professional — R$ {plans.find(p => p.slug === "pro")?.price_monthly?.toFixed(0) || "5"}/mês
                </Button>
              </div>
            </>
          )}

          {/* Overdue Banner */}
          {isOverdue && (
            <div className="flex items-center gap-3 p-4 rounded-lg border border-destructive/50 bg-destructive/5">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">Pagamento pendente</p>
                <p className="text-xs text-muted-foreground">Sua assinatura está com pagamento em atraso. Renove para manter o acesso.</p>
              </div>
              <Button size="sm" variant="destructive" onClick={() => setShowCheckout(true)}>
                <RefreshCw className="h-3 w-3 mr-1" /> Renovar
              </Button>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {(isOverdue || isCancelled) && (
              <Button size="sm" onClick={() => setShowCheckout(true)}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Renovar agora
              </Button>
            )}

            {subscription && !isCancelled && subscription.status !== "expired" && (
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
                      Tem certeza que deseja cancelar sua assinatura do plano <strong>Professional</strong>?
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
            )}
          </div>
        </CardContent>
      </Card>

      {/* Checkout Dialog */}
      {showCheckout && !pixData && (
        <Card className="border-primary/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              Finalizar Assinatura — Professional R$ {plans.find(p => p.slug === "pro")?.price_monthly?.toFixed(2) || "5.00"}/mês
            </CardTitle>
            <CardDescription>Preencha seus dados e escolha a forma de pagamento</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Personal data */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <User className="h-4 w-4" />
                Dados pessoais
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="checkout-name">Nome completo *</Label>
                  <Input
                    id="checkout-name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Seu nome completo"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="checkout-cpf">CPF *</Label>
                  <Input
                    id="checkout-cpf"
                    value={cpf}
                    onChange={(e) => setCpf(formatCpf(e.target.value))}
                    placeholder="000.000.000-00"
                    maxLength={14}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Payment method */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Forma de pagamento</h4>
              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-2">
                <label className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                  paymentMethod === "pix" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                )}>
                  <RadioGroupItem value="pix" />
                  <QrCode className="h-5 w-5 text-primary" />
                   <div className="flex-1">
                    <p className="text-sm font-medium">PIX</p>
                    <p className="text-xs text-muted-foreground">Fatura avulsa — pague via QR Code a cada mês</p>
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
                  paymentMethod === "boleto" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                )}>
                  <RadioGroupItem value="boleto" />
                  <Banknote className="h-5 w-5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Boleto Bancário</p>
                    <p className="text-xs text-muted-foreground">Vencimento em 3 dias úteis</p>
                  </div>
                </label>
              </RadioGroup>
            </div>

            <Separator />

            {/* Summary and action */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <p className="text-sm font-semibold">Total</p>
                <p className="text-xs text-muted-foreground">Cobrança mensal</p>
              </div>
              <p className="text-xl font-bold">R$ {plans.find(p => p.slug === "pro")?.price_monthly?.toFixed(2) || "5.00"}</p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowCheckout(false)} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={handleSubscribe} disabled={subscribe.isPending} className="flex-1">
                {subscribe.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirmar assinatura
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PIX QR Code */}
      {pixData && (
        <Card className="border-primary/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <QrCode className="h-4 w-4 text-primary" />
              Pagamento PIX
            </CardTitle>
            <CardDescription>Escaneie o QR Code ou copie o código para pagar</CardDescription>
          </CardHeader>
          <CardContent>
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
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    Copiar
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Após o pagamento, sua assinatura será ativada automaticamente.
              </p>
              <Button variant="outline" onClick={() => { setPixData(null); setShowCheckout(false); }}>
                Fechar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Histórico de Pagamentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingPayments ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : payments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum pagamento registrado</p>
          ) : (
            <div className="overflow-x-auto -mx-5 sm:-mx-6 px-5 sm:px-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="hidden sm:table-cell">Método</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => {
                    const pCfg = paymentStatusConfig[p.status] || paymentStatusConfig.pending;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="text-sm">
                          {format(new Date(p.created_at), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          R$ {(p.amount_cents / 100).toFixed(2)}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm">
                          {methodLabels[p.method || ""] || p.method || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={pCfg.variant} className="text-[10px]">{pCfg.label}</Badge>
                        </TableCell>
                        <TableCell>
                          {p.invoice_url && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                              <a href={p.invoice_url} target="_blank" rel="noopener noreferrer">
                                <ArrowUpRight className="h-3.5 w-3.5" />
                              </a>
                            </Button>
                          )}
                          {p.pix_copy_paste && p.status === "pending" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => {
                                navigator.clipboard.writeText(p.pix_copy_paste!);
                                toast.success("Código PIX copiado!");
                              }}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
