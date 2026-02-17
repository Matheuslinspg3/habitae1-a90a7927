import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  CheckCircle, 
  XCircle, 
  ChevronDown, 
  RotateCcw, 
  Image, 
  Loader2,
  History,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useImobziImport } from "@/hooks/useImobziImport";
import { useToast } from "@/hooks/use-toast";

interface ImportRun {
  id: string;
  status: string;
  source_provider: string;
  total_properties: number | null;
  imported: number | null;
  errors: number | null;
  images_processed: number | null;
  created_at: string;
  finished_at: string | null;
  error_message: string | null;
}

interface ImportRunItem {
  id: string;
  source_property_id: string;
  source_title: string | null;
  status: string;
  error_message: string | null;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  completed: { label: "Concluído", variant: "default" },
  failed: { label: "Falhou", variant: "destructive" },
  processing: { label: "Processando", variant: "secondary" },
  pending: { label: "Pendente", variant: "outline" },
  running: { label: "Executando", variant: "secondary" },
  starting: { label: "Iniciando", variant: "outline" },
  cancelled: { label: "Cancelado", variant: "destructive" },
};

function RunStatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || { label: status, variant: "outline" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return "Em andamento";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

const MAX_RETRY_ITEMS = 5;

function RunDetails({ runId, onRetry, isRetrying, hasApiKey }: { runId: string; onRetry: (items: ImportRunItem[]) => void; isRetrying: boolean; hasApiKey: boolean }) {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["import-run-items", runId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_run_items")
        .select("id, source_property_id, source_title, status, error_message")
        .eq("run_id", runId)
        .order("status", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ImportRunItem[];
    },
  });

  if (isLoading) return <div className="p-4"><Skeleton className="h-20 w-full" /></div>;

  const errorItems = items.filter(i => i.status === "error");
  const successCount = items.filter(i => i.status === "complete").length;
  const pendingCount = items.filter(i => i.status === "pending").length;
  const retryItems = errorItems.slice(0, MAX_RETRY_ITEMS);

  return (
    <div className="p-4 space-y-3 border-t">
      {errorItems.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium flex items-center gap-1.5">
              <XCircle className="h-4 w-4 text-destructive" />
              {errorItems.length} com erro
            </h4>
            {hasApiKey && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onRetry(retryItems)}
                    disabled={isRetrying}
                    className="gap-1.5"
                  >
                    {isRetrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                    Reimportar {retryItems.length} mais recentes
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Reimporta até {MAX_RETRY_ITEMS} imóveis com erro mais recentes
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          
          <div className="rounded-md border max-h-60 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Imóvel</TableHead>
                  <TableHead>ID Fonte</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {errorItems.slice(0, 20).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium text-sm">{item.source_title || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{item.source_property_id}</TableCell>
                    <TableCell className="text-destructive text-xs max-w-xs truncate">
                      {item.error_message || "Erro desconhecido"}
                    </TableCell>
                  </TableRow>
                ))}
                {errorItems.length > 20 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                      ... e mais {errorItems.length - 20} erros
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {errorItems.length > MAX_RETRY_ITEMS && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Apenas os {MAX_RETRY_ITEMS} mais recentes serão reimportados por vez.
            </p>
          )}
        </div>
      )}
      
      <div className="text-sm text-muted-foreground">
        {successCount} importados com sucesso • {pendingCount} pendentes
      </div>
    </div>
  );
}

export function SyncHistorySection() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { retryFailedProperties, isRetrying, apiKeys, loadApiKeys } = useImobziImport();
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ["import-runs", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      const { data, error } = await supabase
        .from("import_runs")
        .select("id, status, source_provider, total_properties, imported, errors, images_processed, created_at, finished_at, error_message")
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as ImportRun[];
    },
    enabled: !!profile?.organization_id,
  });

  // Load API keys on mount
  useState(() => { loadApiKeys(); });

  const handleRetryItems = async (items: ImportRunItem[]) => {
    const key = apiKeys[0];
    if (!key) {
      toast({ title: "Nenhuma chave API", description: "Adicione uma chave API do Imobzi primeiro.", variant: "destructive" });
      return;
    }
    
    // Show which properties are being retried
    const names = items.map(i => i.source_title || i.source_property_id).join(", ");
    toast({ title: "Reimportando imóveis", description: `Reimportando: ${names}` });
    
    // Create a focused retry with just these property IDs
    if (!profile?.organization_id) return;
    
    const propertyIds = items.map(i => i.source_property_id);
    
    const { data: newRun, error: runError } = await supabase
      .from("import_runs")
      .insert({
        organization_id: profile.organization_id,
        source_provider: "imobzi",
        status: "pending",
        total_properties: propertyIds.length,
        pending_property_ids: propertyIds,
      })
      .select("id")
      .single();

    if (runError || !newRun?.id) {
      toast({ title: "Erro", description: "Não foi possível criar a reimportação.", variant: "destructive" });
      return;
    }

    const itemsToInsert = propertyIds.map(pid => ({
      run_id: newRun.id,
      source_property_id: pid,
      status: "pending",
      source_title: items.find(i => i.source_property_id === pid)?.source_title,
    }));
    await supabase.from("import_run_items").insert(itemsToInsert);

    const { useImportProgress } = await import("@/contexts/ImportProgressContext");
    
    await supabase.functions.invoke("imobzi-process", {
      body: {
        api_key: key.api_key,
        run_id: newRun.id,
        organization_id: profile.organization_id,
        user_id: profile.user_id,
      },
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <History className="h-5 w-5" /> Histórico de Sincronizações
        </h3>
        {[1, 2].map(i => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <History className="h-5 w-5" /> Histórico de Sincronizações
      </h3>

      {runs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <History className="h-10 w-10 text-muted-foreground mb-3" />
            <CardDescription>Nenhuma sincronização realizada ainda.</CardDescription>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {runs.map((run) => {
            const progress = run.total_properties
              ? Math.round(((run.imported || 0) + (run.errors || 0)) / run.total_properties * 100)
              : 0;
            const isExpanded = expandedRunId === run.id;
            const isActive = ["processing", "pending", "running", "starting"].includes(run.status);

            return (
              <Collapsible key={run.id} open={isExpanded} onOpenChange={() => setExpandedRunId(isExpanded ? null : run.id)}>
                <Card className="overflow-hidden">
                  <CollapsibleTrigger className="w-full text-left">
                    <div className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <RunStatusBadge status={run.status} />
                              <span className="text-sm text-muted-foreground">
                                {format(new Date(run.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                ({formatDuration(run.created_at, run.finished_at)})
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                              <span className="flex items-center gap-1">
                                <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                                {run.imported || 0}
                              </span>
                              <span className="flex items-center gap-1">
                                <XCircle className="h-3.5 w-3.5 text-destructive" />
                                {run.errors || 0}
                              </span>
                              <span className="flex items-center gap-1">
                                <Image className="h-3.5 w-3.5 text-blue-500" />
                                {run.images_processed || 0}
                              </span>
                              <span className="text-muted-foreground">/ {run.total_properties || 0}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isActive && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        </div>
                      </div>
                      {isActive && <Progress value={progress} className="h-1 mt-2" />}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <RunDetails
                      runId={run.id}
                      onRetry={handleRetryItems}
                      isRetrying={isRetrying}
                      hasApiKey={apiKeys.length > 0}
                    />
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}
