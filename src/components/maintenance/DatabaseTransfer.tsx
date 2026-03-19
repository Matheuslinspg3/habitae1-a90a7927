import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  ArrowRightLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Plug,
  Send,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const TABLE_ORDER = [
  "subscription_plans", "organizations", "profiles", "user_roles", "admin_allowlist",
  "app_runtime_config", "property_types", "property_type_codes", "city_codes", "zone_codes",
  "lead_stages", "lead_types", "owners", "owner_aliases", "properties", "property_images",
  "property_media", "property_owners", "property_share_links", "property_landing_content",
  "property_landing_overrides", "property_partnerships", "property_visibility",
  "leads", "lead_interactions", "contracts", "contract_documents", "commissions",
  "invoices", "transactions", "transaction_categories", "tasks", "appointments",
  "notifications", "push_subscriptions", "user_devices", "activity_log", "audit_logs",
  "saved_searches", "subscriptions", "billing_payments", "billing_webhook_logs",
  "ad_accounts", "ad_entities", "ad_insights_daily", "ad_leads", "ad_settings",
  "marketplace_properties", "marketplace_contact_access", "consumer_favorites",
  "imobzi_settings", "imobzi_api_keys", "import_runs", "import_run_items", "import_tokens",
  "organization_invites", "platform_invites", "support_tickets", "ticket_messages",
  "portal_feeds", "portal_feed_logs", "crm_import_logs", "deleted_property_media",
  "maintenance_audit_log", "rd_station_settings", "rd_station_webhook_logs",
  "scrape_cache", "verification_codes",
];

interface TransferLog {
  step: string;
  status: "ok" | "error" | "pending" | "running";
  detail?: string;
}

function parseCSVLines(csv: string): string[][] {
  const result: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < csv.length && csv[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ",") { current.push(field); field = ""; }
      else if (ch === "\n" || (ch === "\r" && csv[i + 1] === "\n")) {
        current.push(field); field = "";
        if (current.some((v) => v !== "")) result.push(current);
        current = [];
        if (ch === "\r") i++;
      } else { field += ch; }
    }
  }
  current.push(field);
  if (current.some((v) => v !== "")) result.push(current);
  return result;
}

function parseCSVValue(val: string): unknown {
  if (val === "" || val === "null") return null;
  if (val === "true") return true;
  if (val === "false") return false;
  if ((val.startsWith("{") && val.endsWith("}")) || (val.startsWith("[") && val.endsWith("]"))) {
    try { return JSON.parse(val); } catch { return val; }
  }
  if (/^-?\d+(\.\d+)?$/.test(val) && val.length < 16 && !val.startsWith("0")) {
    return Number(val);
  }
  return val;
}

function csvToRows(csv: string): Record<string, unknown>[] {
  if (!csv || csv.trim() === "") return [];
  const lines = parseCSVLines(csv);
  if (lines.length < 2) return [];
  const headers = lines[0];
  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i];
    if (values.length !== headers.length) continue;
    const row: Record<string, unknown> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = parseCSVValue(values[j]);
    }
    rows.push(row);
  }
  return rows;
}

export function DatabaseTransfer() {
  const [remoteUrl, setRemoteUrl] = useState("");
  const [remoteKey, setRemoteKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [logs, setLogs] = useState<TransferLog[]>([]);
  const [progress, setProgress] = useState("");

  const addLog = (step: string, status: TransferLog["status"], detail?: string) => {
    setLogs((prev) => {
      const existing = prev.findIndex((l) => l.step === step);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { step, status, detail };
        return updated;
      }
      return [...prev, { step, status, detail }];
    });
  };

  const callTransfer = async (body: Record<string, unknown>) => {
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    let authToken = anonKey;
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) authToken = session.access_token;

    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/transfer-database`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
          apikey: anonKey,
        },
        body: JSON.stringify({ remote_url: remoteUrl, remote_service_key: remoteKey, ...body }),
      }
    );
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: "Erro desconhecido" }));
      throw new Error(err.error || `HTTP ${response.status}`);
    }
    return response.json();
  };

  const callExport = async (body: Record<string, string>) => {
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    let authToken = anonKey;
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) authToken = session.access_token;

    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/export-database`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
          apikey: anonKey,
        },
        body: JSON.stringify(body),
      }
    );
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: "Erro desconhecido" }));
      throw new Error(err.error || `HTTP ${response.status}`);
    }
    const result = await response.json();
    if (result.error) throw new Error(result.error);
    return result;
  };

  const handleTest = async () => {
    if (!remoteUrl || !remoteKey) {
      toast({ title: "Preencha URL e Service Key", variant: "destructive" });
      return;
    }
    setTesting(true);
    setConnected(false);
    try {
      const result = await callTransfer({ mode: "test" });
      if (result.success) {
        setConnected(true);
        toast({ title: "Conexão OK", description: "Destino acessível e pronto para receber dados." });
      } else {
        throw new Error(result.error || "Falha na conexão");
      }
    } catch (err: any) {
      toast({ title: "Erro de conexão", description: err.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const handleTransfer = async () => {
    if (!connected) {
      toast({ title: "Teste a conexão primeiro", variant: "destructive" });
      return;
    }

    setTransferring(true);
    setLogs([]);

    try {
      // Step 1: Export and push auth users
      setProgress("Exportando usuários da origem...");
      addLog("Auth Users", "running");
      try {
        const authResult = await callExport({ mode: "auth" });
        const authRows = csvToRows(authResult.csv);
        if (authRows.length > 0) {
          setProgress(`Enviando ${authRows.length} usuários para destino...`);
          const pushResult = await callTransfer({ mode: "push_auth", users: authRows });
          addLog("Auth Users", "ok", `${pushResult.created} criados, ${pushResult.skipped} já existiam`);
          if (pushResult.errors?.length > 0) {
            addLog("Auth Users (erros)", "error", pushResult.errors.join("; "));
          }
        } else {
          addLog("Auth Users", "ok", "0 usuários");
        }
      } catch (e: any) {
        addLog("Auth Users", "error", e.message);
      }

      // Step 2: Export and push each table
      for (let i = 0; i < TABLE_ORDER.length; i++) {
        const table = TABLE_ORDER[i];
        setProgress(`Tabela ${i + 1}/${TABLE_ORDER.length}: ${table}`);
        addLog(table, "running");

        try {
          // Export from source
          const exportResult = await callExport({ mode: "table", table });
          
          if (!exportResult.count || exportResult.count === 0) {
            addLog(table, "ok", "0 registros");
            continue;
          }

          // Parse CSV to rows
          const rows = csvToRows(exportResult.csv);
          if (rows.length === 0) {
            addLog(table, "ok", "0 registros (CSV vazio)");
            continue;
          }

          // Push to destination
          const pushResult = await callTransfer({ mode: "push_table", table, rows });
          
          if (pushResult.errors?.length > 0) {
            addLog(table, "error", `${pushResult.inserted} inseridos, erros: ${pushResult.errors[0]}`);
          } else {
            addLog(table, "ok", `${pushResult.inserted} registros`);
          }
        } catch (e: any) {
          addLog(table, "error", e.message);
        }
      }

      setProgress("");
      toast({ title: "Transferência concluída!", description: "Verifique os logs para detalhes." });
    } catch (err: any) {
      toast({ title: "Erro na transferência", description: err.message, variant: "destructive" });
    } finally {
      setTransferring(false);
      setProgress("");
    }
  };

  const errorCount = logs.filter((l) => l.status === "error").length;
  const okCount = logs.filter((l) => l.status === "ok").length;

  return (
    <Card className="text-left border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden mt-4">
      {/* Header */}
      <div className="p-4 border-b border-border/30 flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
          <ArrowRightLeft className="h-4 w-4 text-blue-500" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Transferir Dados para Outro Projeto</h3>
          <p className="text-xs text-muted-foreground">
            Envia dados diretamente do banco atual para um Supabase externo
          </p>
        </div>
      </div>

      {/* Config */}
      <div className="p-4 space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">URL do Supabase Destino</label>
          <input
            type="url"
            placeholder="https://xxxxx.supabase.co"
            value={remoteUrl}
            onChange={(e) => { setRemoteUrl(e.target.value); setConnected(false); }}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            disabled={transferring}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Service Role Key do Destino</label>
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              placeholder="eyJhbGciOiJIUzI1NiIs..."
              value={remoteKey}
              onChange={(e) => { setRemoteKey(e.target.value); setConnected(false); }}
              className="w-full h-9 rounded-md border border-input bg-background px-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono"
              disabled={transferring}
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              type="button"
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground/60">
            ⚠️ A service key é usada apenas durante a transferência e não é armazenada.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleTest}
            variant="outline"
            size="sm"
            disabled={testing || transferring || !remoteUrl || !remoteKey}
            className="gap-2"
          >
            {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plug className="h-3 w-3" />}
            {connected ? "Reconectar" : "Testar Conexão"}
          </Button>

          {connected && (
            <span className="flex items-center gap-1 text-xs text-green-500">
              <CheckCircle2 className="h-3 w-3" /> Conectado
            </span>
          )}
        </div>

        {connected && (
          <div className="pt-2 border-t border-border/20">
            <p className="text-xs text-amber-500/80 mb-3">
              ⚠️ <strong>Pré-requisito:</strong> O schema (tabelas, enums, functions, policies) deve estar criado no destino ANTES de transferir dados. 
              Use a exportação .sql acima e execute a parte de schema no SQL Editor do destino primeiro.
            </p>
            <Button
              onClick={handleTransfer}
              size="sm"
              disabled={transferring}
              className="gap-2 w-full"
            >
              {transferring ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              {transferring ? "Transferindo..." : "Iniciar Transferência de Dados"}
            </Button>
          </div>
        )}
      </div>

      {/* Progress */}
      {transferring && progress && (
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2 text-xs text-primary animate-pulse">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>{progress}</span>
          </div>
        </div>
      )}

      {/* Logs */}
      {logs.length > 0 && (
        <div className="border-t border-border/30">
          <div className="px-4 py-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {okCount} ok · {errorCount} erros · {logs.length} total
            </span>
          </div>
          <ScrollArea className="h-[250px]">
            <div className="px-4 pb-3 space-y-1">
              {logs.map((log, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px] font-mono">
                  {log.status === "ok" && <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />}
                  {log.status === "error" && <AlertCircle className="h-3 w-3 text-destructive mt-0.5 shrink-0" />}
                  {log.status === "running" && <Loader2 className="h-3 w-3 text-primary animate-spin mt-0.5 shrink-0" />}
                  {log.status === "pending" && <div className="h-3 w-3 rounded-full bg-muted mt-0.5 shrink-0" />}
                  <span className="text-foreground/80">
                    <strong>{log.step}</strong>
                    {log.detail && <span className="text-muted-foreground"> — {log.detail}</span>}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </Card>
  );
}
