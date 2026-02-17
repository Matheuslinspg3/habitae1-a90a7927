import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, Sparkles } from "lucide-react";
import { differenceInDays, differenceInHours } from "date-fns";

export function RenewalBanner() {
  const { trialInfo } = useAuth();

  if (!trialInfo || !trialInfo.trial_ends_at) return null;

  const now = new Date();
  const endsAt = new Date(trialInfo.trial_ends_at);
  const daysRemaining = Math.max(0, differenceInDays(endsAt, now));
  const hoursRemaining = Math.max(0, differenceInHours(endsAt, now));
  const isExpired = trialInfo.is_trial_expired;

  // Only show in the last 3 days or if expired
  if (!isExpired && daysRemaining > 3) return null;

  const isLastDay = !isExpired && daysRemaining <= 1;
  const timeLabel = isExpired
    ? "Seu teste expirou"
    : isLastDay
      ? `${hoursRemaining}h restantes`
      : `${daysRemaining} dias restantes`;

  const bgClass = isExpired
    ? "bg-destructive/10 border-destructive/30"
    : isLastDay
      ? "bg-warning/15 border-warning/30"
      : "bg-warning/10 border-warning/20";

  const Icon = isExpired ? AlertTriangle : isLastDay ? Clock : Sparkles;
  const iconColor = isExpired ? "text-destructive" : "text-warning";

  return (
    <div className={`mx-4 mt-4 mb-0 sm:mx-6 rounded-xl border p-3 sm:p-4 flex items-center justify-between gap-3 ${bgClass}`}>
      <div className="flex items-center gap-3 min-w-0">
        <Icon className={`h-5 w-5 flex-shrink-0 ${iconColor}`} />
        <div className="min-w-0">
          <p className="font-semibold text-sm">
            Renove Aqui!
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {timeLabel} — {isExpired ? "Renove para continuar usando" : "Garanta acesso contínuo"}
          </p>
        </div>
      </div>
      <Button
        size="sm"
        variant={isExpired ? "default" : "gold"}
        className="flex-shrink-0"
        onClick={() => {
          window.location.href = "/configuracoes#subscription";
        }}
      >
        Renovar
      </Button>
    </div>
  );
}
