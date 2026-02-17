import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  CreditCard, Calendar, Shield, RefreshCw, XCircle, ArrowUpRight,
  Loader2, CheckCircle2, Clock, AlertTriangle, Receipt, QrCode, Copy
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSubscription } from "@/hooks/useSubscription";
import { PlanCatalogDialog } from "./PlanCatalogDialog";
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
  debit: "Débito",
  credit_card: "Cartão de Crédito",
};

const paymentStatusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "secondary" },
  confirmed: { label: "Confirmado", variant: "default" },
  failed: { label: "Falhou", variant: "destructive" },
  refunded: { label: "Reembolsado", variant: "outline" },
};

export function SubscriptionSection() {
  const { subscription, payments, loadingSub, loadingPayments, cancel, renew, isOverdue, isCancelled } = useSubscription();
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [showPixDialog, setShowPixDialog] = useState(false);

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

  const plan = subscription?.plan;
  const status = subscription?.status || "cancelled";
  const cfg = statusConfig[status] || statusConfig.cancelled;
  const StatusIcon = cfg.icon;

  return (
    <div className="space-y-4">
      {/* Card 1 - Status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Plano e Assinatura
              </CardTitle>
              <CardDescription>Gerencie seu plano e forma de pagamento</CardDescription>
            </div>
            <Badge variant={cfg.variant} className="gap-1">
              <StatusIcon className="h-3 w-3" />
              {cfg.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {subscription ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Plano atual</p>
                <p className="font-semibold text-lg">{plan?.name || "—"}</p>
                <p className="text-xs text-muted-foreground">{plan?.description}</p>
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
          ) : (
            <div className="text-center py-6 space-y-2">
              <Shield className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhuma assinatura ativa</p>
              <p className="text-xs text-muted-foreground">Escolha um plano para começar</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Overdue Banner */}
      {isOverdue && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">Pagamento pendente</p>
              <p className="text-xs text-muted-foreground">Sua assinatura está com pagamento em atraso. Renove para manter o acesso.</p>
            </div>
            <Button size="sm" variant="destructive" onClick={() => setShowPlanDialog(true)}>
              <RefreshCw className="h-3 w-3 mr-1" /> Renovar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Card 2 - Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowPlanDialog(true)}>
              <ArrowUpRight className="h-3.5 w-3.5 mr-1" />
              {subscription ? "Alterar plano" : "Escolher plano"}
            </Button>

            {(isOverdue || isCancelled) && (
              <Button size="sm" onClick={() => setShowPlanDialog(true)}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Renovar agora
              </Button>
            )}

            {subscription && !isCancelled && (
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
                      Tem certeza que deseja cancelar sua assinatura do plano <strong>{plan?.name}</strong>?
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

      {/* Card 3 - Payment History */}
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

      <PlanCatalogDialog open={showPlanDialog} onOpenChange={setShowPlanDialog} />
    </div>
  );
}
