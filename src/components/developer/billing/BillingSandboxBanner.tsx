import { AlertTriangle, FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { BillingConfig } from "@/services/ai-billing/types";

export function BillingSandboxBanner({ config }: { config?: BillingConfig | null }) {
  const isSandbox = config?.sandbox_mode !== false;
  const isEnabled = config?.billing_enabled === true;

  return (
    <div className={`flex items-center gap-3 rounded-lg border p-3 ${
      isSandbox 
        ? "bg-yellow-500/10 border-yellow-500/30" 
        : "bg-green-500/10 border-green-500/30"
    }`}>
      <FlaskConical className={`h-5 w-5 shrink-0 ${isSandbox ? "text-yellow-600" : "text-green-600"}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold">AI Token Billing</span>
          <Badge variant="outline" className={`text-[10px] ${
            isSandbox 
              ? "border-yellow-500/50 text-yellow-700 dark:text-yellow-400" 
              : "border-green-500/50 text-green-700 dark:text-green-400"
          }`}>
            {isSandbox ? "🧪 SANDBOX" : "🟢 PRODUCTION"}
          </Badge>
          <Badge variant="outline" className={`text-[10px] ${
            isEnabled
              ? "border-primary/50 text-primary"
              : "border-muted-foreground/30 text-muted-foreground"
          }`}>
            {isEnabled ? "Ativo" : "Desativado"}
          </Badge>
          {config?.stripe_test_mode && (
            <Badge variant="outline" className="text-[10px] border-purple-500/50 text-purple-700 dark:text-purple-400">
              Stripe Test Mode
            </Badge>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {isSandbox
            ? "Modo sandbox ativo — nenhuma cobrança real será efetuada. Dados de billing são simulados."
            : "Modo produção — cobranças reais estão ativas."}
        </p>
      </div>
      {isSandbox && <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />}
    </div>
  );
}
