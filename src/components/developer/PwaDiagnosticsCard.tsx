import { useState } from "react";
import { Wrench, Activity, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { APP_VERSION } from "@/config/appVersion";
import { getPwaDiagnostics, repairPwa, type PwaDiagnostics } from "@/lib/pwaUtils";
import { toast } from "sonner";

export function PwaDiagnosticsCard() {
  const [diag, setDiag] = useState<PwaDiagnostics | null>(null);
  const [loading, setLoading] = useState(false);
  const [repairing, setRepairing] = useState(false);

  const runDiagnostics = async () => {
    setLoading(true);
    try {
      const result = await getPwaDiagnostics();
      setDiag(result);
    } finally {
      setLoading(false);
    }
  };

  const handleRepair = async () => {
    setRepairing(true);
    try {
      const result = await repairPwa();
      toast.success(`PWA reparado! ${result.cleared} caches limpos. Reabra o app.`);
      // Re-run diagnostics after repair
      const updated = await getPwaDiagnostics();
      setDiag(updated);
    } catch (err) {
      toast.error("Erro ao reparar PWA");
    } finally {
      setRepairing(false);
    }
  };

  const versionMatch = diag?.buildVersion === APP_VERSION;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Diagnóstico PWA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={runDiagnostics} disabled={loading} className="flex-1">
            {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
            Diagnosticar
          </Button>
          <Button size="sm" variant="destructive" onClick={handleRepair} disabled={repairing} className="flex-1">
            {repairing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Wrench className="h-3 w-3 mr-1" />}
            Reparar PWA
          </Button>
        </div>

        {diag && (
          <div className="space-y-2 text-xs">
            <Row label="Versão app" value={`v${APP_VERSION}`} />
            <Row
              label="Versão build"
              value={diag.buildVersion ? `v${diag.buildVersion}` : "—"}
              status={versionMatch ? "ok" : "warn"}
            />
            <Row
              label="Modo"
              value={diag.displayMode}
              status={diag.displayMode === "standalone" ? "ok" : "info"}
            />
            <Row
              label="SW ativo"
              value={diag.swActive ? "✓" : "✗"}
              status={diag.swActive ? "ok" : "warn"}
            />
            <Row
              label="SW waiting"
              value={diag.swWaiting ? "Sim (pendente)" : "Não"}
              status={diag.swWaiting ? "warn" : "ok"}
            />
            <Row label="Scope" value={diag.swScope ?? "—"} />
            <Row label="Caches" value={`${diag.cacheNames.length} entradas`} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status?: "ok" | "warn" | "info";
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1 font-mono">
        {status === "ok" && <CheckCircle className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />}
        {status === "warn" && <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />}
        {value}
      </span>
    </div>
  );
}
