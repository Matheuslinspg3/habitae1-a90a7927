import { useState } from "react";
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Download, Loader2, FileSpreadsheet, Database } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

const EXPORTABLE_TABLES = [
  "activity_log","ad_accounts","ad_entities","ad_insights_daily","ad_leads","ad_settings",
  "admin_allowlist","ai_billing_config","ai_billing_invoices","ai_billing_pricing",
  "ai_provider_config","ai_token_usage_events","ai_usage_logs","anuncios_gerados",
  "app_runtime_config","appointments","audit_events","audit_logs","billing_payments",
  "billing_webhook_logs","brand_settings","city_codes","commissions","consumer_favorites",
  "contract_documents","contract_templates","contracts","crm_import_logs",
  "deleted_property_media","generated_arts","generated_videos","imobzi_api_keys",
  "imobzi_settings","import_run_items","import_runs","import_tokens","invoices",
  "lead_document_template_items","lead_document_templates","lead_documents",
  "lead_interactions","lead_score_events","lead_stages","lead_types","leads",
  "maintenance_audit_log","marketplace_contact_access","marketplace_properties",
  "notifications","organization_custom_roles","organization_invites",
  "organization_member_events","organizations","owner_aliases","owners",
  "platform_invites","portal_feed_logs","portal_feeds","profiles","properties",
  "property_images","property_landing_content","property_landing_overrides",
  "property_media","property_owners","property_partnerships","property_share_links",
  "property_status_history","property_type_codes","property_types",
  "property_visibility","property_visits","push_subscriptions","rd_station_settings",
  "rd_station_webhook_logs","saved_searches","scrape_cache","subscription_plans",
  "subscriptions","support_tickets","tasks","ticket_messages","transaction_categories",
  "transactions","user_devices","user_roles","verification_codes","whatsapp_instances",
  "zone_codes",
] as const;

type ExportableTable = (typeof EXPORTABLE_TABLES)[number];

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escapeCSV(r[h])).join(",")),
  ].join("\n");
}

function downloadBlob(content: BlobPart, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function fetchAll(table: string): Promise<Record<string, unknown>[]> {
  const PAGE = 1000;
  let offset = 0;
  const all: Record<string, unknown>[] = [];
  while (true) {
    const { data, error } = await (supabase as any)
      .from(table)
      .select("*")
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...(data as Record<string, unknown>[]));
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

export function ExportTablesCard() {
  const [loadingTable, setLoadingTable] = useState<string | null>(null);
  const [loadingAll, setLoadingAll] = useState(false);
  const [filter, setFilter] = useState("");

  const exportOne = async (table: ExportableTable) => {
    setLoadingTable(table);
    try {
      const rows = await fetchAll(table);
      if (rows.length === 0) {
        toast({ title: "Sem dados", description: `Nenhum registro em ${table}.` });
        return;
      }
      const csv = toCSV(rows);
      const filename = `${table}_${format(new Date(), "yyyy-MM-dd_HHmm")}.csv`;
      downloadBlob("\ufeff" + csv, filename, "text/csv;charset=utf-8;");
      toast({
        title: "Exportação concluída",
        description: `${rows.length.toLocaleString("pt-BR")} registros de ${table}.`,
      });
    } catch (err) {
      toast({
        title: "Erro na exportação",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setLoadingTable(null);
    }
  };

  const exportAll = async () => {
    setLoadingAll(true);
    const stamp = format(new Date(), "yyyy-MM-dd_HHmm");
    const errors: string[] = [];
    let totalRows = 0;
    let totalTables = 0;
    try {
      const zip = new JSZip();
      for (const table of EXPORTABLE_TABLES) {
        try {
          setLoadingTable(table);
          const rows = await fetchAll(table);
          if (rows.length === 0) continue;
          const csv = toCSV(rows);
          zip.file(`${table}.csv`, "\ufeff" + csv);
          totalRows += rows.length;
          totalTables += 1;
        } catch (e) {
          errors.push(e instanceof Error ? e.message : String(e));
        }
      }
      if (errors.length) {
        zip.file("_errors.txt", errors.join("\n"));
      }
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
      downloadBlob(blob, `export_database_${stamp}.zip`, "application/zip");
      toast({
        title: "Exportação geral concluída",
        description: `${totalTables} tabelas, ${totalRows.toLocaleString("pt-BR")} registros em ZIP.${errors.length ? ` ${errors.length} erro(s).` : ""}`,
        variant: errors.length ? "destructive" : "default",
      });
    } finally {
      setLoadingAll(false);
      setLoadingTable(null);
    }
  };

  const filtered = EXPORTABLE_TABLES.filter((t) =>
    t.toLowerCase().includes(filter.toLowerCase().trim()),
  );

  const busy = loadingAll || loadingTable !== null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Exportar Tabelas ({EXPORTABLE_TABLES.length})
        </CardTitle>
        <CardDescription>
          Baixe CSV de qualquer tabela do sistema ou exporte todas de uma vez. Sujeito às policies RLS do seu usuário.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={exportAll} disabled={busy} className="sm:w-auto">
            {loadingAll ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Database className="h-4 w-4 mr-2" />
            )}
            Exportar Todas
          </Button>
          <Input
            placeholder="Filtrar tabelas..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-96 overflow-y-auto pr-1">
          {filtered.map((table) => (
            <Button
              key={table}
              variant="outline"
              size="sm"
              className="justify-start font-mono text-xs"
              onClick={() => exportOne(table)}
              disabled={busy}
            >
              {loadingTable === table ? (
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin shrink-0" />
              ) : (
                <Download className="h-3.5 w-3.5 mr-2 shrink-0" />
              )}
              <span className="truncate">{table}</span>
            </Button>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-full text-center py-4">
              Nenhuma tabela encontrada.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
