import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";
import { Button } from "@/components/ui/button";
import { HabitaeLogo } from "@/components/HabitaeLogo";
import { Construction, RefreshCw, Wifi, Loader2, Download, Copy, Check, X, Database, ChevronDown, ChevronUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

// NOTE: Migrations are applied separately via CLI (supabase db push)
// This page only handles DATA export (INSERTs + auth.users)


// Order respects foreign key dependencies
const TABLE_ORDER = [
  "subscription_plans",
  "organizations",
  "profiles",
  "user_roles",
  "admin_allowlist",
  "app_runtime_config",
  "property_types",
  "property_type_codes",
  "city_codes",
  "zone_codes",
  "lead_stages",
  "lead_types",
  "owners",
  "owner_aliases",
  "properties",
  "property_images",
  "property_media",
  "property_owners",
  "property_share_links",
  "property_landing_content",
  "property_landing_overrides",
  "property_partnerships",
  "property_visibility",
  "leads",
  "lead_interactions",
  "contracts",
  "contract_documents",
  "commissions",
  "invoices",
  "transactions",
  "transaction_categories",
  "tasks",
  "appointments",
  "notifications",
  "push_subscriptions",
  "user_devices",
  "activity_log",
  "audit_logs",
  "saved_searches",
  "subscriptions",
  "billing_payments",
  "billing_webhook_logs",
  "ad_accounts",
  "ad_entities",
  "ad_insights_daily",
  "ad_leads",
  "ad_settings",
  "marketplace_properties",
  "marketplace_contact_access",
  "consumer_favorites",
  "imobzi_settings",
  "imobzi_api_keys",
  "import_runs",
  "import_run_items",
  "import_tokens",
  "organization_invites",
  "platform_invites",
  "support_tickets",
  "ticket_messages",
  "portal_feeds",
  "portal_feed_logs",
  "crm_import_logs",
  "deleted_property_media",
  "maintenance_audit_log",
  "rd_station_settings",
  "rd_station_webhook_logs",
  "scrape_cache",
  "verification_codes",
];

function escapeSQL(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    const items = value.map((v) => `"${String(v).replace(/"/g, '\\"')}"`).join(",");
    return `'{${items}}'`;
  }
  if (typeof value === "object") {
    const json = JSON.stringify(value).replace(/'/g, "''");
    return `'${json}'::jsonb`;
  }
  const str = String(value).replace(/'/g, "''");
  return `'${str}'`;
}

function rowsToSQL(tableName: string, rows: Record<string, unknown>[]): string {
  if (!rows || rows.length === 0) return `-- ${tableName}: 0 registros\n`;
  const columns = Object.keys(rows[0]);
  const colList = columns.map((c) => `"${c}"`).join(", ");
  const lines: string[] = [];
  lines.push(`-- ============================================================`);
  lines.push(`-- TABELA: ${tableName} (${rows.length} registros)`);
  lines.push(`-- ============================================================`);
  lines.push("");
  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const values = batch.map((row) => {
      const vals = columns.map((col) => escapeSQL(row[col]));
      return `  (${vals.join(", ")})`;
    });
    lines.push(`INSERT INTO public."${tableName}" (${colList})`);
    lines.push(`VALUES`);
    lines.push(values.join(",\n"));
    lines.push(`ON CONFLICT DO NOTHING;`);
    lines.push("");
  }
  return lines.join("\n");
}

function authUsersToSQL(users: Record<string, unknown>[]): string {
  if (!users || users.length === 0) return "-- auth.users: 0 registros\n";
  const lines: string[] = [];
  lines.push(`-- ============================================================`);
  lines.push(`-- AUTH.USERS (${users.length} usuários)`);
  lines.push(`-- IMPORTANTE: Execute no SQL Editor do Supabase com service_role`);
  lines.push(`-- As senhas NÃO são exportáveis. Usuários precisarão redefinir.`);
  lines.push(`-- ============================================================`);
  lines.push("");
  for (const u of users) {
    const metadata = u.user_metadata ? JSON.stringify(u.user_metadata).replace(/'/g, "''") : "{}";
    const appMeta = u.app_metadata ? JSON.stringify(u.app_metadata).replace(/'/g, "''") : "{}";
    const email = String(u.email || "").replace(/'/g, "''");
    const phone = u.phone ? `'${String(u.phone).replace(/'/g, "''")}'` : "NULL";
    lines.push(`-- Usuário: ${email}`);
    lines.push(`INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, phone, phone_confirmed_at,
  created_at, updated_at, last_sign_in_at,
  raw_user_meta_data, raw_app_meta_data,
  is_super_admin, confirmation_token, recovery_token, email_change_token_new
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '${u.id}',
  'authenticated',
  'authenticated',
  '${email}',
  crypt('PortaMigra2026!', gen_salt('bf')),
  ${u.email_confirmed_at ? `'${u.email_confirmed_at}'` : "NULL"},
  ${phone},
  ${u.phone_confirmed_at ? `'${u.phone_confirmed_at}'` : "NULL"},
  '${u.created_at || new Date().toISOString()}',
  '${u.updated_at || new Date().toISOString()}',
  ${u.last_sign_in_at ? `'${u.last_sign_in_at}'` : "NULL"},
  '${metadata}'::jsonb,
  '${appMeta}'::jsonb,
  FALSE, '', '', ''
) ON CONFLICT (id) DO NOTHING;`);
    lines.push("");
  }
  lines.push(`-- Senha temporária padrão: PortaMigra2026!`);
  lines.push("");
  return lines.join("\n");
}

function downloadFile(content: string, filename: string, mimeType = "text/sql") {
  const blob = new Blob([content], { type: `${mimeType}; charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface ExportStats {
  tablesExported: number;
  totalRecords: number;
  authUsers: number;
  hasSchema: boolean;
  errors: string[];
}

export default function Maintenance() {
  const { isMaintenanceMode, maintenanceMessage, refetch, isLoading } = useMaintenanceMode();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState("");
  const [generatedSQL, setGeneratedSQL] = useState<string | null>(null);
  const [exportStats, setExportStats] = useState<ExportStats | null>(null);
  const [copied, setCopied] = useState(false);
  const [showFullSQL, setShowFullSQL] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [disabling, setDisabling] = useState(false);

  // Check if current user is a system admin
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.email) return;
      const { data } = await supabase
        .from("admin_allowlist")
        .select("id")
        .ilike("email", session.user.email)
        .maybeSingle();
      setIsAdmin(!!data);
    })();
  }, []);

  const handleDisableMaintenance = async () => {
    setDisabling(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sem sessão");

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/toggle-maintenance-mode`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: anonKey,
          },
          body: JSON.stringify({ action: "deactivate" }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      toast({ title: "Manutenção desativada!", description: "Redirecionando..." });
      await refetch();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setDisabling(false);
    }
  };

  useEffect(() => {
    if (!isLoading && !isMaintenanceMode) {
      navigate("/dashboard", { replace: true });
    }
  }, [isMaintenanceMode, isLoading, navigate]);

  useEffect(() => {
    const interval = setInterval(() => { refetch(); }, 10_000);
    return () => clearInterval(interval);
  }, [refetch]);

  const handleRetry = async () => {
    setChecking(true);
    await refetch();
    setTimeout(() => setChecking(false), 1000);
  };

  const handleCopySQL = async () => {
    if (!generatedSQL) return;
    await navigator.clipboard.writeText(generatedSQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copiado!", description: "SQL copiado para a área de transferência." });
  };

  const handleDownloadSQL = () => {
    if (!generatedSQL) return;
    downloadFile(generatedSQL, `porta-migration-${new Date().toISOString().slice(0, 10)}.sql`);
  };

  const handleExportDatabase = async () => {
    setExporting(true);
    setGeneratedSQL(null);
    setExportStats(null);
    setExportProgress("Exportando todas as tabelas (pode levar 30s)...");

    try {
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

      // Try to get session token, fall back to anon key
      let authToken = anonKey;
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        authToken = session.access_token;
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/export-database`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
            apikey: anonKey,
          },
          body: JSON.stringify({}),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(err.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      if (result.error) throw new Error(result.error);

      const tables = result.tables as Record<string, { count: number; csv: string }>;
      const schemaDDL = result.schema_ddl as string || "";

      setExportProgress("Gerando SQL de importação...");

      let sql = `-- ============================================================\n`;
      sql += `-- EXPORTAÇÃO COMPLETA: Porta do Corretor\n`;
      sql += `-- Gerado em: ${new Date().toISOString()}\n`;
      sql += `-- Inclui: Schema (DDL) + Dados (INSERTs) + Auth Users\n`;
      sql += `-- Destino: Supabase novo (executar no SQL Editor com service_role)\n`;
      sql += `-- ============================================================\n\n`;
      sql += `-- INSTRUÇÕES:\n`;
      sql += `-- 1. Crie um projeto Supabase novo\n`;
      sql += `-- 2. Abra o SQL Editor com role 'service_role'\n`;
      sql += `-- 3. Cole/carregue este arquivo e execute\n`;
      sql += `-- 4. Após importar, envie redefinição de senha aos usuários\n`;
      sql += `-- 5. Senha temporária padrão: PortaMigra2026!\n\n`;

      // ---- PART 1: Schema DDL ----
      if (schemaDDL) {
        sql += `-- ============================================================\n`;
        sql += `-- PARTE 1: SCHEMA (Enums, Tabelas, Funções, Triggers, RLS)\n`;
        sql += `-- ============================================================\n\n`;
        sql += schemaDDL;
        sql += `\n`;
      }

      // ---- PART 2: Data ----
      sql += `\n-- ============================================================\n`;
      sql += `-- PARTE 2: DADOS (INSERTs)\n`;
      sql += `-- ============================================================\n\n`;
      sql += `BEGIN;\n\n`;
      sql += `SET session_replication_role = 'replica';\n\n`;

      let authUsersCount = 0;
      if (tables["_auth_users"] && tables["_auth_users"].count > 0) {
        const authRows = csvToRows(tables["_auth_users"].csv);
        authUsersCount = authRows.length;
        sql += authUsersToSQL(authRows);
      }

      let totalRecords = 0;
      let tablesExported = 0;
      for (const tableName of TABLE_ORDER) {
        if (tables[tableName] && tables[tableName].count > 0) {
          const rows = csvToRows(tables[tableName].csv);
          sql += rowsToSQL(tableName, rows);
          totalRecords += rows.length;
          tablesExported++;
        }
      }

      for (const tableName of Object.keys(tables)) {
        if (tableName === "_auth_users") continue;
        if (TABLE_ORDER.includes(tableName)) continue;
        if (tables[tableName].count > 0) {
          const rows = csvToRows(tables[tableName].csv);
          sql += rowsToSQL(tableName, rows);
          totalRecords += rows.length;
          tablesExported++;
        }
      }

      sql += `\nSET session_replication_role = 'origin';\n\n`;
      sql += `COMMIT;\n\n`;
      sql += `-- ============================================================\n`;
      sql += `-- FIM: ${tablesExported} tabelas + ${totalRecords.toLocaleString()} registros\n`;
      sql += `-- ============================================================\n`;

      setGeneratedSQL(sql);
      setExportStats({
        tablesExported,
        totalRecords,
        authUsers: authUsersCount,
        hasSchema: !!schemaDDL,
        errors: result.errors || [],
      });

      toast({
        title: "SQL completo gerado!",
        description: `${tablesExported} tabelas + ${totalRecords.toLocaleString()} registros exportados.`,
      });

      if (result.errors?.length > 0) {
        console.warn("Erros:", result.errors);
      }
    } catch (err: any) {
      console.error("Export error:", err);
      toast({
        title: "Erro na exportação",
        description: err.message || "Não foi possível exportar os dados.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
      setExportProgress("");
    }
  };

  const sqlLines = generatedSQL?.split("\n").length ?? 0;
  const sqlSizeKB = generatedSQL ? Math.round(new Blob([generatedSQL]).size / 1024) : 0;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-8">
      <div className="max-w-2xl w-full text-center space-y-6">
        <div className="flex justify-center">
          <HabitaeLogo variant="icon" size="lg" />
        </div>

        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-2xl bg-amber-500/10 flex items-center justify-center">
            <Construction className="h-10 w-10 text-amber-500" />
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-2xl font-bold text-foreground">Sistema em Manutenção</h1>
          <p className="text-muted-foreground text-base leading-relaxed">{maintenanceMessage}</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Button onClick={handleRetry} variant="outline" size="lg" disabled={checking} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} />
            {checking ? "Verificando..." : "Tentar novamente"}
          </Button>

          {isAdmin && (
            <Button
              onClick={handleDisableMaintenance}
              variant="destructive"
              size="lg"
              disabled={disabling}
              className="gap-2"
            >
              {disabling ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              {disabling ? "Desativando..." : "Remover Manutenção"}
            </Button>
          )}
        </div>

        {/* SQL Preview Card */}
        {generatedSQL && exportStats && (
          <Card className="text-left border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-border/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Database className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">SQL de Migração</h3>
                  <p className="text-xs text-muted-foreground">
                    {exportStats.hasSchema ? "Schema ✓ · " : ""}{exportStats.tablesExported} tabelas · {exportStats.totalRecords.toLocaleString()} registros · {exportStats.authUsers} usuários · {sqlSizeKB} KB
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setGeneratedSQL(null); setExportStats(null); }}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* SQL Preview */}
            <div className="relative">
              <ScrollArea className={showFullSQL ? "h-[400px]" : "h-[200px]"}>
                <pre className="p-4 text-[11px] leading-relaxed font-mono text-muted-foreground whitespace-pre overflow-x-auto">
                  {showFullSQL ? generatedSQL : generatedSQL.slice(0, 3000) + (generatedSQL.length > 3000 ? "\n\n... (clique para ver tudo)" : "")}
                </pre>
              </ScrollArea>

              {/* Fade overlay when collapsed */}
              {!showFullSQL && generatedSQL.length > 3000 && (
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-card to-transparent pointer-events-none" />
              )}
            </div>

            {/* Toggle expand */}
            {generatedSQL.length > 3000 && (
              <button
                onClick={() => setShowFullSQL(!showFullSQL)}
                className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1 border-t border-border/20"
              >
                {showFullSQL ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {showFullSQL ? "Recolher" : `Ver tudo (${sqlLines.toLocaleString()} linhas)`}
              </button>
            )}

            {/* Actions */}
            <div className="p-3 border-t border-border/30 flex gap-2">
              <Button onClick={handleCopySQL} variant="outline" size="sm" className="flex-1 gap-2 text-xs">
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copiado!" : "Copiar SQL"}
              </Button>
              <Button onClick={handleDownloadSQL} size="sm" className="flex-1 gap-2 text-xs">
                <Download className="h-3 w-3" />
                Baixar .sql
              </Button>
            </div>

            {/* Errors */}
            {exportStats.errors.length > 0 && (
              <div className="px-4 pb-3">
                <p className="text-xs text-destructive">
                  ⚠️ Tabelas com erro: {exportStats.errors.join(", ")}
                </p>
              </div>
            )}
          </Card>
        )}

        {/* Auto-check + hidden export trigger */}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/60">
          <Wifi className="h-3 w-3" />
          <span>
            <button
              onClick={handleExportDatabase}
              disabled={exporting}
              className="hover:text-muted-foreground transition-colors cursor-default bg-transparent border-none p-0 text-inherit text-xs"
            >
              {exporting ? "Exportando..." : "Verificação"}
            </button>
            {" automática ativa — você será redirecionado assim que a manutenção terminar"}
          </span>
        </div>

        {exporting && (
          <div className="flex items-center justify-center gap-2 text-xs text-primary animate-pulse">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>{exportProgress}</span>
          </div>
        )}

        <p className="text-xs text-muted-foreground/50 tracking-widths uppercase">
          Porta do Corretor
        </p>
      </div>
    </div>
  );
}

// ---- CSV Parser ----
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
