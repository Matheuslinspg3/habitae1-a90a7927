import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useSubscription, SubscriptionPlan } from "@/hooks/useSubscription";
import { useAuth } from "@/contexts/AuthContext";
import { QrCode, Copy, Check, Loader2, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: SubscriptionPlan | null;
}

export function CheckoutDialog({ open, onOpenChange, plan }: CheckoutDialogProps) {
  const { subscribe } = useSubscription();
  const { profile } = useAuth();

  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "boleto">("pix");
  const [customerName, setCustomerName] = useState(profile?.full_name || "");
  const [customerCpf, setCustomerCpf] = useState("");
  const [pixData, setPixData] = useState<{ qrCode: string; copyPaste: string } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!plan) return null;

  const price = billingCycle === "yearly" ? plan.price_yearly : plan.price_monthly;
  const monthlyEquivalent = billingCycle === "yearly" ? (plan.price_yearly / 12).toFixed(0) : null;
  const savings = billingCycle === "yearly" ? (plan.price_monthly * 12 - plan.price_yearly).toFixed(0) : null;

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 14);
    if (digits.length <= 11) {
      return digits
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    }
    return digits
      .replace(/(\d{2})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1/$2")
      .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  };

  const handleSubmit = async () => {
    if (!customerCpf.replace(/\D/g, "")) {
      toast.error("Informe seu CPF ou CNPJ");
      return;
    }
    if (!customerName.trim()) {
      toast.error("Informe seu nome completo");
      return;
    }

    subscribe.mutate(
      {
        planId: plan.id,
        billingCycle,
        paymentMethod,
        customerName: customerName.trim(),
        customerCpf: customerCpf.replace(/\D/g, ""),
      },
      {
        onSuccess: (data: any) => {
          if (data?.pixData) {
            setPixData({
              qrCode: data.pixData.qrCode,
              copyPaste: data.pixData.copyPaste,
            });
          } else {
            onOpenChange(false);
          }
        },
      }
    );
  };

  const handleCopyPix = () => {
    if (pixData?.copyPaste) {
      navigator.clipboard.writeText(pixData.copyPaste);
      setCopied(true);
      toast.success("Código PIX copiado!");
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleClose = () => {
    setPixData(null);
    setCopied(false);
    onOpenChange(false);
  };

  // PIX QR Code view
  if (pixData) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              Pague com PIX
            </DialogTitle>
            <DialogDescription>
              Escaneie o QR Code ou copie o código para pagar
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-4 py-4">
            <div className="bg-white p-4 rounded-xl border">
              <img
                src={`data:image/png;base64,${pixData.qrCode}`}
                alt="QR Code PIX"
                className="w-56 h-56"
              />
            </div>

            <div className="w-full space-y-2">
              <Label className="text-xs text-muted-foreground">Código PIX (copia e cola)</Label>
              <div className="flex gap-2">
                <Input
                  value={pixData.copyPaste}
                  readOnly
                  className="text-xs font-mono"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyPix}
                  className="shrink-0"
                >
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="text-center space-y-1">
              <p className="text-sm font-medium">R$ {Number(price).toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">
                Plano {plan.name} — {billingCycle === "yearly" ? "Anual" : "Mensal"}
              </p>
              <p className="text-xs text-muted-foreground">
                ⏱️ Após o pagamento, sua assinatura será ativada automaticamente
              </p>
            </div>
          </div>

          <Button variant="outline" onClick={handleClose} className="w-full">
            Fechar
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assinar Plano {plan.name}</DialogTitle>
          <DialogDescription>
            Preencha seus dados para finalizar a assinatura
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Billing cycle */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Período</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setBillingCycle("monthly")}
                className={cn(
                  "p-3 rounded-lg border text-left transition-all",
                  billingCycle === "monthly"
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "hover:border-muted-foreground/30"
                )}
              >
                <p className="text-sm font-medium">Mensal</p>
                <p className="text-lg font-bold">R$ {Number(plan.price_monthly).toFixed(0)}</p>
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle("yearly")}
                className={cn(
                  "p-3 rounded-lg border text-left transition-all relative",
                  billingCycle === "yearly"
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "hover:border-muted-foreground/30"
                )}
              >
                {savings && (
                  <Badge className="absolute -top-2 right-2 text-[10px] bg-green-500 text-white">
                    Economize R$ {savings}
                  </Badge>
                )}
                <p className="text-sm font-medium">Anual</p>
                <p className="text-lg font-bold">R$ {monthlyEquivalent}<span className="text-xs font-normal text-muted-foreground">/mês</span></p>
              </button>
            </div>
          </div>

          <Separator />

          {/* Customer info */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome completo</Label>
              <Input
                id="name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Seu nome completo"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cpf">CPF ou CNPJ</Label>
              <Input
                id="cpf"
                value={customerCpf}
                onChange={(e) => setCustomerCpf(formatCpf(e.target.value))}
                placeholder="000.000.000-00"
                maxLength={18}
              />
            </div>
          </div>

          <Separator />

          {/* Payment method */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Forma de pagamento</Label>
            <RadioGroup
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod(v as "pix" | "boleto")}
              className="grid grid-cols-2 gap-2"
            >
              <label
                className={cn(
                  "flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all",
                  paymentMethod === "pix" && "border-primary bg-primary/5 ring-1 ring-primary"
                )}
              >
                <RadioGroupItem value="pix" />
                <QrCode className="h-4 w-4" />
                <span className="text-sm font-medium">PIX</span>
              </label>
              <label
                className={cn(
                  "flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all",
                  paymentMethod === "boleto" && "border-primary bg-primary/5 ring-1 ring-primary"
                )}
              >
                <RadioGroupItem value="boleto" />
                <CreditCard className="h-4 w-4" />
                <span className="text-sm font-medium">Boleto</span>
              </label>
            </RadioGroup>
          </div>

          {/* Summary */}
          <div className="p-3 rounded-lg bg-muted/50 space-y-1">
            <div className="flex justify-between text-sm">
              <span>Plano {plan.name}</span>
              <span className="font-medium">R$ {Number(price).toFixed(2)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {billingCycle === "yearly" ? "Cobrado anualmente" : "Cobrado mensalmente"} via {paymentMethod === "pix" ? "PIX" : "Boleto"}
            </p>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={subscribe.isPending}
            className="w-full"
            size="lg"
          >
            {subscribe.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Processando...
              </>
            ) : (
              `Assinar por R$ ${Number(price).toFixed(2)}`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
