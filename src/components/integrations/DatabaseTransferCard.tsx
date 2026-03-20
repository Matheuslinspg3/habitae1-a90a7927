import React, { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  ArrowRightLeft, CheckCircle2, XCircle, Loader2, Database,
  Play, TestTube, ChevronDown, ChevronUp, AlertTriangle,
} from "lucide-react";

// Tables with organization_id (direct filter)
const ORG_TABLES = [
  "profiles", "owners", "lead_stages", "lead_types", "property_types",
  "city_codes", "zone_codes", "brand_settings",
  "properties", "leads", "contracts", "contract_templates",
  "appointments", "tasks", "invoices", "transactions", "transaction_categories",
  "subscriptions", "billing_payments", "commissions",
  "marketplace_properties", "portal_feeds",
  "ad_accounts", "ad_entities", "ad_insights_daily", "ad_leads", "ad_settings",
  "notifications", "activity_log", "audit_events", "audit_logs",
  "whatsapp_instances", "push_subscriptions", "saved_searches",
  "imobzi_settings", "imobzi_api_keys", "rd_station_settings",
  "generated_arts", "generated_videos", "anuncios_gerados",
  "import_runs", "import_tokens", "crm_import_logs",
  "deleted_property_media", "organization_invites", "organization_member_events",
  "organization_custom_roles", "platform_invites",
  "lead_document_templates", "lead_documents", "lead_score_events",
  "property_media", "property_owners", "property_status_history",
  "property_visits", "property_landing_overrides",
  "ai_usage_logs", "ai_billing_invoices", "ai_token_usage_events",
  "support_tickets", "rd_station_webhook_logs",
];

// Child tables: need to fetch parent IDs first
const CHILD_TABLES: { table: string; parentTable: string; fkCol: string }[] = [
  { table: "property_images", parentTable: "properties", fkCol: "property_id" },
  { table: "property_landing_content", parentTable: "properties", fkCol: "property_id" },
  { table: "property_share_links", parentTable: "properties", fkCol: "property_id" },
  { table: "property_partnerships", parentTable: "properties", fkCol: "property_id" },
  { table: "property_visibility", parentTable: "properties", fkCol: "property_id" },
  { table: "lead_interactions", parentTable: "leads", fkCol: "lead_id" },
  { table: "lead_document_template_items", parentTable: "lead_document_templates", fkCol: "template_id" },
  { table: "contract_documents", parentTable: "contracts", fkCol: "contract_id" },
  { table: "import_run_items", parentTable: "import_runs", fkCol: "run_id" },
  { table: "ticket_messages", parentTable: "support_tickets", fkCol: "ticket_id" },
  { table: "consumer_favorites", parentTable: "marketplace_properties", fkCol: "property_id" },
  { table: "portal_feed_logs", parentTable: "portal_feeds", fkCol: "feed_id" },
];

interface StepState {
  table: string;
  status: "pending" | "queued" | "running" | "done" | "error" | "skipped";
  count?: number;
  message?: string;
}

export function DatabaseTransferCard() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  const [destUrl, setDestUrl] = useState("");
  const [destKey, setDestKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [steps, setSteps] = useState<StepState[]>([]);
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set([...ORG_TABLES, ...CHILD_TABLES.map(c => c.table)]));
  const abortRef = useRef(false);

  const allTables = [...ORG_TABLES, ...CHILD_TABLES.map(c => c.table)];
  const progress = steps.length > 0 ? (steps.filter(s => s.status === "done" || s.status === "skipped").length / steps.length) * 100 : 0;

  const toggleTable = (t: string) => {
    setSelectedTables(prev => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });
  };

  const selectAll = () => setSelectedTables(new Set(allTables));
  const selectNone = () => setSelectedTables(new Set());

  const updateStep = useCallback((table: string, update: Partial<StepState>) => {
    setSteps(prev => prev.map(s => s.table === table ? { ...s, ...update } : s));
  }, []);

  const testConnection = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("transfer-database", {
        body: { remote_url: destUrl, remote_service_key: destKey, mode: "test" },
      });
      if (error) throw error;
      setConnected(data?.success === true);
      toast[data?.success ? "success" : "error"](data?.success ? "Conexão OK!" : data?.error || "Falha");
    } catch (e: any) {
      setConnected(false);
      toast.error(e.message || "Erro ao testar");
    } finally {
      setTesting(false);
    }
  };

  const fetchAll = async (table: string, orgId: string): Promise<any[]> => {
    const PAGE = 1000;
    let all: any[] = [];
    let from = 0;
    while (true) {
      if (abortRef.current) throw new Error("Abortado");
      const { data, error } = await (supabase as any).from(table).select("*").eq("organization_id", orgId).range(from, from + PAGE - 1);
      if (error) throw error;
      if (!data?.length) break;
      all = all.concat(data);
      if (data.length < PAGE) break;
      from += PAGE;
    }
    return all;
  };

  const fetchByParentIds = async (table: string, fkCol: string, parentIds: string[]): Promise<any[]> => {
    if (!parentIds.length) return [];
    let all: any[] = [];
    for (let i = 0; i < parentIds.length; i += 200) {
      if (abortRef.current) throw new Error("Abortado");
      const chunk = parentIds.slice(i, i + 200);
      let from = 0;
      while (true) {
        const { data, error } = await (supabase as any).from(table).select("*").in(fkCol, chunk).range(from, from + 999);
        if (error) throw error;
        if (!data?.length) break;
        all = all.concat(data);
        if (data.length < 1000) break;
        from += 1000;
      }
    }
    return all;
  };

  const pushRows = async (table: string, rows: any[]) => {
    const BATCH = 300;
    let inserted = 0;
    const errors: string[] = [];
    for (let i = 0; i < rows.length; i += BATCH) {
      if (abortRef.current) throw new Error("Abortado");
      const batch = rows.slice(i, i + BATCH);
      const { data, error } = await supabase.functions.invoke("transfer-database", {
        body: { remote_url: destUrl, remote_service_key: destKey, mode: "push_table", table, rows: batch },
      });
      if (error) errors.push(error.message);
      else inserted += data?.inserted || 0;
    }
    return { inserted, errors };
  };

  const startTransfer = async () => {
    if (!orgId) { toast.error("Organização não encontrada no perfil"); return; }
    setRunning(true);
    abortRef.current = false;

    // Build step list
    const orgSelected = ORG_TABLES.filter(t => selectedTables.has(t));
    const childSelected = CHILD_TABLES.filter(c => selectedTables.has(c.table));
    const initialSteps: StepState[] = [
      ...orgSelected.map(t => ({ table: t, status: "queued" as const })),
      ...childSelected.map(c => ({ table: c.table, status: "queued" as const })),
    ];
    setSteps(initialSteps);

    // Cache parent IDs for child tables
    const parentIdCache: Record<string, string[]> = {};

    // Transfer org tables
    for (const table of orgSelected) {
      if (abortRef.current) break;
      updateStep(table, { status: "running", message: "Buscando..." });
      try {
        const rows = await fetchAll(table, orgId);
        if (!rows.length) { updateStep(table, { status: "done", count: 0, message: "Vazio" }); continue; }
        // Cache IDs if this table is a parent
        parentIdCache[table] = rows.map(r => r.id);
        updateStep(table, { message: `Enviando ${rows.length}...`, count: rows.length });
        const result = await pushRows(table, rows);
        updateStep(table, {
          status: result.errors.length ? "error" : "done",
          count: rows.length,
          message: result.errors.length ? `${result.inserted} ok, erro: ${result.errors[0]}` : `${result.inserted} transferidos`,
        });
      } catch (e: any) {
        updateStep(table, { status: "error", message: e.message });
      }
    }

    // Transfer child tables
    for (const child of childSelected) {
      if (abortRef.current) break;
      updateStep(child.table, { status: "running", message: "Buscando IDs pai..." });
      try {
        let parentIds = parentIdCache[child.parentTable];
        if (!parentIds) {
          // Parent wasn't transferred, fetch IDs directly
          const parents = await fetchAll(child.parentTable, orgId);
          parentIds = parents.map(r => r.id);
        }
        if (!parentIds.length) { updateStep(child.table, { status: "done", count: 0, message: "Sem registros pai" }); continue; }
        const rows = await fetchByParentIds(child.table, child.fkCol, parentIds);
        if (!rows.length) { updateStep(child.table, { status: "done", count: 0, message: "Vazio" }); continue; }
        updateStep(child.table, { message: `Enviando ${rows.length}...`, count: rows.length });
        const result = await pushRows(child.table, rows);
        updateStep(child.table, {
          status: result.errors.length ? "error" : "done",
          count: rows.length,
          message: result.errors.length ? `${result.inserted} ok, erro: ${result.errors[0]}` : `${result.inserted} transferidos`,
        });
      } catch (e: any) {
        updateStep(child.table, { status: "error", message: e.message });
      }
    }

    setRunning(false);
    if (!abortRef.current) toast.success("Transferência concluída!");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Transferir Dados</CardTitle>
            <CardDescription>Migre todos os dados desta organização para outro banco de dados</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Warning */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-accent/50 border border-accent">
          <AlertTriangle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            O schema (tabelas, enums, funções) deve existir previamente no destino. Esta ferramenta transfere apenas os <strong>dados</strong> da organização atual.
          </p>
        </div>

        {/* Destination */}
        <div className="space-y-2">
          <Input placeholder="https://xxxxx.supabase.co" value={destUrl} onChange={e => setDestUrl(e.target.value)} disabled={running} />
          <Input type="password" placeholder="Service Role Key do destino" value={destKey} onChange={e => setDestKey(e.target.value)} disabled={running} />
          <div className="flex items-center gap-3">
            <Button onClick={testConnection} disabled={testing || !destUrl || !destKey || running} variant="outline" size="sm">
              {testing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <TestTube className="h-4 w-4 mr-1" />}
              Testar Conexão
            </Button>
            {connected === true && <Badge variant="default"><CheckCircle2 className="h-3 w-3 mr-1" /> Conectado</Badge>}
            {connected === false && <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Falhou</Badge>}
          </div>
        </div>

        {/* Table selection */}
        {connected && (
          <>
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)} className="text-xs">
                {expanded ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                {selectedTables.size}/{allTables.length} tabelas selecionadas
              </Button>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs" disabled={running}>Todas</Button>
                <Button variant="ghost" size="sm" onClick={selectNone} className="text-xs" disabled={running}>Nenhuma</Button>
              </div>
            </div>

            {expanded && (
              <ScrollArea className="h-48 border rounded-lg p-2">
                <div className="grid grid-cols-2 gap-1">
                  {allTables.map(t => (
                    <label key={t} className="flex items-center gap-2 text-xs py-0.5 cursor-pointer hover:bg-muted/50 rounded px-1">
                      <Checkbox checked={selectedTables.has(t)} onCheckedChange={() => toggleTable(t)} disabled={running} />
                      <span className="truncate">{t}</span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            )}

            {/* Progress */}
            {steps.length > 0 && (
              <div className="space-y-2">
                <Progress value={progress} />
                <ScrollArea className="h-40 border rounded-lg">
                  <div className="p-2 space-y-1">
                    {steps.map(s => (
                      <div key={s.table} className="flex items-center gap-2 text-xs py-1 px-2 rounded hover:bg-muted/30">
                        {s.status === "running" && <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />}
                        {s.status === "done" && <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />}
                        {s.status === "error" && <XCircle className="h-3 w-3 text-destructive shrink-0" />}
                        {(s.status === "queued" || s.status === "pending") && <Database className="h-3 w-3 text-muted-foreground shrink-0" />}
                        <span className="font-medium min-w-[140px] truncate">{s.table}</span>
                        {s.count !== undefined && <Badge variant="secondary" className="text-[10px] h-4">{s.count}</Badge>}
                        {s.message && <span className="text-muted-foreground truncate">{s.message}</span>}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button onClick={startTransfer} disabled={running || selectedTables.size === 0}>
                {running ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
                {running ? "Transferindo..." : "Iniciar Transferência"}
              </Button>
              {running && (
                <Button variant="destructive" onClick={() => { abortRef.current = true; }}>
                  Cancelar
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
