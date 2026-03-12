import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";
import { Button } from "@/components/ui/button";
import { HabitaeLogo } from "@/components/HabitaeLogo";
import { Construction, RefreshCw, Wifi, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

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
  "push_devices",
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
  "support_messages",
  "portal_feeds",
  "crm_import_logs",
  "deleted_property_media",
  "landing_overrides",
];

function escapeSQL(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    // PostgreSQL array literal
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

  // Batch inserts (100 rows per statement for performance)
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

  lines.push(`-- ============================================================`);
  lines.push(`-- ATENÇÃO: Após importar, envie um email de redefinição de senha`);
  lines.push(`-- para todos os usuários, ou altere a senha temporária acima.`);
  lines.push(`-- Senha temporária padrão: PortaMigra2026!`);
  lines.push(`-- ============================================================`);
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

export default function Maintenance() {
  const { isMaintenanceMode, maintenanceMessage, refetch, isLoading } = useMaintenanceMode();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState("");

  useEffect(() => {
    if (!isLoading && !isMaintenanceMode) {
      navigate("/dashboard", { replace: true });
    }
  }, [isMaintenanceMode, isLoading, navigate]);

  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 10_000);
    return () => clearInterval(interval);
  }, [refetch]);

  const handleRetry = async () => {
    setChecking(true);
    await refetch();
    setTimeout(() => setChecking(false), 1000);
  };

  const handleExportDatabase = async () => {
    setExporting(true);
    setExportProgress("Verificando sessão...");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Erro", description: "Você precisa estar logado.", variant: "destructive" });
        return;
      }

      setExportProgress("Exportando todas as tabelas (pode levar 30s)...");

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/export-database`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
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

      // ---- Generate SQL ----
      setExportProgress("Gerando SQL de importação...");

      let sql = `-- ============================================================\n`;
      sql += `-- EXPORTAÇÃO COMPLETA: Porta do Corretor\n`;
      sql += `-- Gerado em: ${new Date().toISOString()}\n`;
      sql += `-- Destino: Supabase externo (executar no SQL Editor)\n`;
      sql += `-- ============================================================\n\n`;
      sql += `-- IMPORTANTE:\n`;
      sql += `-- 1. Aplique TODAS as migrations ANTES de rodar este arquivo\n`;
      sql += `-- 2. Execute com role 'service_role' (não 'anon')\n`;
      sql += `-- 3. Desabilite triggers temporariamente se houver conflitos\n\n`;
      sql += `BEGIN;\n\n`;
      sql += `-- Desabilitar triggers temporariamente para evitar efeitos colaterais\n`;
      sql += `SET session_replication_role = 'replica';\n\n`;

      // Auth users first (if available)
      if (tables["_auth_users"] && tables["_auth_users"].count > 0) {
        // Parse CSV back to rows
        const authRows = csvToRows(tables["_auth_users"].csv);
        sql += authUsersToSQL(authRows);
      }

      // Public tables in dependency order
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

      // Any remaining tables not in our ordered list
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

      sql += `\n-- Reabilitar triggers\n`;
      sql += `SET session_replication_role = 'origin';\n\n`;
      sql += `COMMIT;\n\n`;
      sql += `-- ============================================================\n`;
      sql += `-- FIM DA IMPORTAÇÃO\n`;
      sql += `-- ${tablesExported} tabelas, ${totalRecords.toLocaleString()} registros\n`;
      sql += `-- ============================================================\n`;

      setExportProgress("Baixando arquivos...");

      // Download SQL file
      downloadFile(sql, `porta-migration-${new Date().toISOString().slice(0, 10)}.sql`);

      // Also download individual CSVs
      await new Promise((r) => setTimeout(r, 500));
      const tableNames = Object.keys(tables).filter((t) => tables[t].count > 0);
      for (const tableName of tableNames) {
        if (tables[tableName].csv) {
          downloadFile(tables[tableName].csv, `${tableName}.csv`, "text/csv");
          await new Promise((r) => setTimeout(r, 150));
        }
      }

      toast({
        title: "Exportação SQL concluída!",
        description: `${tablesExported} tabelas, ${totalRecords.toLocaleString()} registros. Arquivo SQL pronto para importar.`,
      });

      if (result.errors?.length > 0) {
        console.warn("Erros:", result.errors);
        toast({
          title: "Algumas tabelas falharam",
          description: result.errors.join(", "),
          variant: "destructive",
        });
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="flex justify-center">
          <HabitaeLogo variant="icon" size="lg" />
        </div>

        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-2xl bg-amber-500/10 flex items-center justify-center">
            <Construction className="h-10 w-10 text-amber-500" />
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-2xl font-bold text-foreground">
            Sistema em Manutenção
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed">
            {maintenanceMessage}
          </p>
        </div>

        <Button
          onClick={handleRetry}
          variant="outline"
          size="lg"
          disabled={checking}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} />
          {checking ? "Verificando..." : "Tentar novamente"}
        </Button>

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

        <p className="text-xs text-muted-foreground/50 tracking-widest uppercase">
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
        if (i + 1 < csv.length && csv[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        current.push(field);
        field = "";
      } else if (ch === "\n" || (ch === "\r" && csv[i + 1] === "\n")) {
        current.push(field);
        field = "";
        if (current.some((v) => v !== "")) result.push(current);
        current = [];
        if (ch === "\r") i++;
      } else {
        field += ch;
      }
    }
  }

  // Last field
  current.push(field);
  if (current.some((v) => v !== "")) result.push(current);

  return result;
}

function parseCSVValue(val: string): unknown {
  if (val === "" || val === "null") return null;
  if (val === "true") return true;
  if (val === "false") return false;

  // Try JSON (for objects/arrays)
  if ((val.startsWith("{") && val.endsWith("}")) || (val.startsWith("[") && val.endsWith("]"))) {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }

  // Numbers (but not UUIDs or dates)
  if (/^-?\d+(\.\d+)?$/.test(val) && val.length < 16 && !val.startsWith("0")) {
    return Number(val);
  }

  return val;
}
