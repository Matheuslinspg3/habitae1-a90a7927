import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { Clock, CalendarCheck, AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";
import { differenceInDays, differenceInHours, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export function TrialCountdownSection() {
  const { trialInfo } = useAuth();

  // No trial info = no trial system for this org
  if (!trialInfo || !trialInfo.trial_ends_at) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-5 w-5 text-success" />
            Plano & Renovação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4 rounded-lg bg-success/10 border border-success/20">
            <CheckCircle2 className="h-8 w-8 text-success flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm">Acesso completo ativo</p>
              <p className="text-xs text-muted-foreground">
                Sua conta possui acesso ilimitado a todas as funcionalidades da plataforma.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const now = new Date();
  const endsAt = parseISO(trialInfo.trial_ends_at);
  const startedAt = trialInfo.trial_started_at ? parseISO(trialInfo.trial_started_at) : null;
  const isExpired = trialInfo.is_trial_expired;

  const daysRemaining = Math.max(0, differenceInDays(endsAt, now));
  const hoursRemaining = Math.max(0, differenceInHours(endsAt, now) % 24);
  const totalTrialDays = startedAt ? differenceInDays(endsAt, startedAt) : 7;
  const daysElapsed = startedAt ? differenceInDays(now, startedAt) : totalTrialDays - daysRemaining;
  const progressPercent = Math.min(100, Math.max(0, (daysElapsed / totalTrialDays) * 100));

  const getUrgencyLevel = () => {
    if (isExpired) return "expired";
    if (daysRemaining <= 1) return "critical";
    if (daysRemaining <= 3) return "warning";
    return "safe";
  };

  const urgency = getUrgencyLevel();

  const urgencyConfig = {
    expired: {
      icon: AlertTriangle,
      iconColor: "text-destructive",
      bgColor: "bg-destructive/10 border-destructive/20",
      progressColor: "bg-destructive",
      badge: { label: "Expirado", variant: "destructive" as const },
    },
    critical: {
      icon: AlertTriangle,
      iconColor: "text-warning",
      bgColor: "bg-warning/10 border-warning/20",
      progressColor: "bg-warning",
      badge: { label: "Último dia!", variant: "outline" as const },
    },
    warning: {
      icon: Clock,
      iconColor: "text-warning",
      bgColor: "bg-warning/10 border-warning/20",
      progressColor: "bg-warning",
      badge: { label: `${daysRemaining} dias restantes`, variant: "outline" as const },
    },
    safe: {
      icon: CalendarCheck,
      iconColor: "text-success",
      bgColor: "bg-success/10 border-success/20",
      progressColor: "bg-success",
      badge: { label: `${daysRemaining} dias restantes`, variant: "outline" as const },
    },
  };

  const config = urgencyConfig[urgency];
  const Icon = config.icon;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-5 w-5 text-primary" />
              Plano & Renovação
            </CardTitle>
            <CardDescription>Acompanhe o status do seu período de teste</CardDescription>
          </div>
          <Badge variant={config.badge.variant} className={urgency === "expired" ? "bg-destructive text-destructive-foreground" : ""}>
            {config.badge.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main countdown card */}
        <div className={`flex items-center gap-4 p-4 rounded-xl border ${config.bgColor}`}>
          <Icon className={`h-10 w-10 flex-shrink-0 ${config.iconColor}`} />
          <div className="flex-1 min-w-0">
            {isExpired ? (
              <>
                <p className="font-bold text-sm">Período de teste encerrado</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Seu teste gratuito expirou em {format(endsAt, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}.
                  Entre em contato com o administrador para continuar.
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
                  Teste gratuito até {format(endsAt, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {startedAt && `Início: ${format(startedAt, "dd/MM/yyyy")}`}
            </span>
            <span>
              Término: {format(endsAt, "dd/MM/yyyy")}
            </span>
          </div>
          <div className="relative">
            <Progress value={progressPercent} className="h-2.5" />
          </div>
          <p className="text-xs text-muted-foreground text-center">
            {isExpired
              ? "100% do período utilizado"
              : `${Math.round(progressPercent)}% do período utilizado`}
          </p>
        </div>

        {/* Timeline markers */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-muted/50">
            <p className="text-lg font-bold tabular-nums">{totalTrialDays}</p>
            <p className="text-xs text-muted-foreground">Dias totais</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/50">
            <p className="text-lg font-bold tabular-nums">{Math.min(daysElapsed, totalTrialDays)}</p>
            <p className="text-xs text-muted-foreground">Dias usados</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/50">
            <p className="text-lg font-bold tabular-nums">{daysRemaining}</p>
            <p className="text-xs text-muted-foreground">Dias restantes</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
