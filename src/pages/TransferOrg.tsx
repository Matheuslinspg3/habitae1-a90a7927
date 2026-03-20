import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowRightLeft, CheckCircle2, XCircle, Loader2, Database,
  Users, Home, Image, MessageSquare, UserCheck, Play, TestTube,
} from "lucide-react";

const ORG_ID = "fd75cd4a-5321-481d-a34b-87ee879e775c";
const ORG_NAME = "Porto Caiçara Imóveis Ltda";

interface TransferStep {
  table: string;
  label: string;
  icon: React.ReactNode;
  count: number;
  status: "pending" | "running" | "done" | "error";
  message?: string;
}

export default function TransferOrg() {
  const [destUrl, setDestUrl] = useState("");
  const [destKey, setDestKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [running, setRunning] = useState(false);
  const abortRef = useRef(false);

  const [steps, setSteps] = useState<TransferStep[]>([
    { table: "owners", label: "Proprietários", icon: <UserCheck className="h-4 w-4" />, count: 188, status: "pending" },
    { table: "properties", label: "Imóveis", icon: <Home className="h-4 w-4" />, count: 977, status: "pending" },
    { table: "property_images", label: "Imagens", icon: <Image className="h-4 w-4" />, count: 15075, status: "pending" },
    { table: "property_owners", label: "Vínculos Prop-Dono", icon: <Database className="h-4 w-4" />, count: 931, status: "pending" },
    { table: "leads", label: "Leads", icon: <Users className="h-4 w-4" />, count: 731, status: "pending" },
    { table: "lead_interactions", label: "Interações", icon: <MessageSquare className="h-4 w-4" />, count: 492, status: "pending" },
  ]);

  const updateStep = (table: string, update: Partial<TransferStep>) => {
    setSteps(prev => prev.map(s => s.table === table ? { ...s, ...update } : s));
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("transfer-database", {
        body: { remote_url: destUrl, remote_service_key: destKey, mode: "test" },
      });
      if (error) throw error;
      setConnected(data?.success === true);
      toast[data?.success ? "success" : "error"](data?.success ? "Conexão OK!" : "Falha na conexão");
    } catch (e: any) {
      setConnected(false);
      toast.error(e.message || "Erro ao testar");
    } finally {
      setTesting(false);
    }
  };

  const fetchAll = async (table: string, filterCol: string, filterVal: string) => {
    const PAGE = 1000;
    let all: any[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await (supabase as any)
        .from(table)
        .select("*")
        .eq(filterCol, filterVal)
        .range(from, from + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      all = all.concat(data);
      if (data.length < PAGE) break;
      from += PAGE;
    }
    return all;
  };

  const fetchJoined = async (table: string, joinTable: string, joinCol: string, orgCol: string) => {
    const parentIds = await (supabase as any)
      .from(joinTable)
      .select("id")
      .eq(orgCol, ORG_ID);
    if (parentIds.error) throw parentIds.error;
    const ids = (parentIds.data || []).map((r: any) => r.id);
    if (ids.length === 0) return [];
    let all: any[] = [];
    // Fetch in chunks of 200 IDs
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const PAGE = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .in(joinCol, chunk)
          .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
    }
    return all;
  };

  const pushRows = async (table: string, rows: any[]) => {
    const BATCH = 300;
    let totalInserted = 0;
    const errors: string[] = [];
    for (let i = 0; i < rows.length; i += BATCH) {
      if (abortRef.current) throw new Error("Abortado pelo usuário");
      const batch = rows.slice(i, i + BATCH);
      const { data, error } = await supabase.functions.invoke("transfer-database", {
        body: { remote_url: destUrl, remote_service_key: destKey, mode: "push_table", table, rows: batch },
      });
      if (error) errors.push(error.message);
      else totalInserted += data?.inserted || 0;
    }
    return { totalInserted, errors };
  };

  const startTransfer = async () => {
    setRunning(true);
    abortRef.current = false;

    const plan: { table: string; fetchFn: () => Promise<any[]> }[] = [
      { table: "owners", fetchFn: () => fetchAll("owners", "organization_id", ORG_ID) },
      { table: "properties", fetchFn: () => fetchAll("properties", "organization_id", ORG_ID) },
      { table: "property_images", fetchFn: () => fetchJoined("property_images", "properties", "property_id", "organization_id") },
      { table: "property_owners", fetchFn: () => fetchJoined("property_owners", "properties", "property_id", "organization_id") },
      { table: "leads", fetchFn: () => fetchAll("leads", "organization_id", ORG_ID) },
      { table: "lead_interactions", fetchFn: () => fetchJoined("lead_interactions", "leads", "lead_id", "organization_id") },
    ];

    for (const { table, fetchFn } of plan) {
      if (abortRef.current) break;
      updateStep(table, { status: "running", message: "Buscando dados..." });
      try {
        const rows = await fetchFn();
        updateStep(table, { count: rows.length, message: `Enviando ${rows.length} registros...` });
        if (rows.length === 0) {
          updateStep(table, { status: "done", message: "Nenhum registro" });
          continue;
        }
        const result = await pushRows(table, rows);
        if (result.errors.length > 0) {
          updateStep(table, { status: "error", message: `${result.totalInserted} ok, erros: ${result.errors[0]}` });
        } else {
          updateStep(table, { status: "done", message: `${result.totalInserted} transferidos` });
        }
      } catch (e: any) {
        updateStep(table, { status: "error", message: e.message });
      }
    }
    setRunning(false);
    toast.success("Transferência concluída!");
  };

  const doneCount = steps.filter(s => s.status === "done").length;
  const progress = (doneCount / steps.length) * 100;

  return (
    <div className="min-h-screen bg-background p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <ArrowRightLeft className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Transferir Dados — {ORG_NAME}</h1>
          <p className="text-sm text-muted-foreground">
            Org ID: <code className="text-xs">{ORG_ID}</code>
          </p>
        </div>
      </div>

      {/* Destination config */}
      <Card>
        <CardHeader><CardTitle className="text-base">Destino Supabase</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="https://xxxxx.supabase.co"
            value={destUrl}
            onChange={e => setDestUrl(e.target.value)}
            disabled={running}
          />
          <Input
            type="password"
            placeholder="Service Role Key do destino"
            value={destKey}
            onChange={e => setDestKey(e.target.value)}
            disabled={running}
          />
          <div className="flex items-center gap-3">
            <Button onClick={testConnection} disabled={testing || !destUrl || !destKey || running} variant="outline" size="sm">
              {testing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <TestTube className="h-4 w-4 mr-1" />}
              Testar Conexão
            </Button>
            {connected === true && <Badge variant="default" className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" /> Conectado</Badge>}
            {connected === false && <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Falhou</Badge>}
          </div>
        </CardContent>
      </Card>

      {/* Transfer steps */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Tabelas a Transferir</CardTitle>
          <Button onClick={startTransfer} disabled={!connected || running} size="sm">
            {running ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
            {running ? "Transferindo..." : "Iniciar Transferência"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {running && <Progress value={progress} className="mb-3" />}
          {steps.map(step => (
            <div key={step.table} className="flex items-center gap-3 p-3 rounded-lg border">
              <div className="text-muted-foreground">{step.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{step.label}</span>
                  <Badge variant="secondary" className="text-xs">{step.count.toLocaleString()}</Badge>
                </div>
                {step.message && <p className="text-xs text-muted-foreground truncate">{step.message}</p>}
              </div>
              {step.status === "running" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              {step.status === "done" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
              {step.status === "error" && <XCircle className="h-4 w-4 text-destructive" />}
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        ⚠️ O schema (tabelas, enums, funções) deve existir previamente no destino. Esta ferramenta transfere apenas dados.
      </p>
    </div>
  );
}
