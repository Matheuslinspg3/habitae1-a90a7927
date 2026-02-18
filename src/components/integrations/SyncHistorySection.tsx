import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  Pause,
  Play,
  Trash2,
  Ban,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useImobziImport } from "@/hooks/useImobziImport";
import { useImportProgress } from "@/contexts/ImportProgressContext";
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
  paused: { label: "Pausado", variant: "outline" },
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



function RunDetails({ runId, onRetry, isRetrying, hasApiKey }: { runId: string; onRetry: (items: ImportRunItem[]) => void; isRetrying: boolean; hasApiKey: boolean }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === errorItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(errorItems.map(i => i.id)));
    }
  };

  const selectedItems = errorItems.filter(i => selectedIds.has(i.id));

  return (
    <div className="p-4 space-y-3 border-t">
      {errorItems.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="text-sm font-medium flex items-center gap-1.5">
              <XCircle className="h-4 w-4 text-destructive" />
              {errorItems.length} com erro
            </h4>
            {hasApiKey && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRetry(errorItems)}
                      disabled={isRetrying}
                      className="gap-1.5"
                    >
                      {isRetrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                      Reimportar Todos ({errorItems.length})
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Reimportar todos os imóveis com erro</TooltipContent>
                </Tooltip>
                {selectedIds.size > 0 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => onRetry(selectedItems)}
                        disabled={isRetrying}
                        className="gap-1.5"
                      >
                        {isRetrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                        Reimportar Selecionados ({selectedIds.size})
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Reimportar apenas os itens selecionados</TooltipContent>
                  </Tooltip>
                )}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2 mb-1">
            <Checkbox
              checked={selectedIds.size === errorItems.length && errorItems.length > 0}
              onCheckedChange={toggleAll}
            />
            <span className="text-xs text-muted-foreground">
              {selectedIds.size > 0 ? `${selectedIds.size} selecionado(s)` : "Selecionar todos"}
            </span>
          </div>

          <div className="rounded-md border max-h-60 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Imóvel</TableHead>
                  <TableHead>ID Fonte</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {errorItems.slice(0, 20).map((item) => (
                  <TableRow key={item.id} className={selectedIds.has(item.id) ? "bg-primary/5" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(item.id)}
                        onCheckedChange={() => toggleSelect(item.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium text-sm">{item.source_title || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{item.source_property_id}</TableCell>
                    <TableCell className="text-destructive text-xs max-w-xs truncate">
                      {item.error_message || "Erro desconhecido"}
                    </TableCell>
                  </TableRow>
                ))}
                {errorItems.length > 20 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      ... e mais {errorItems.length - 20} erros
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      
      <div className="text-sm text-muted-foreground">
        {successCount} importados com sucesso • {pendingCount} pendentes
      </div>
    </div>
  );
}

function SyncActionButtons({ run, onAction, isLoading }: { 
  run: ImportRun; 
  onAction: (action: string, runId: string) => void;
  isLoading: string | null;
}) {
  const isActive = ["processing", "running", "starting"].includes(run.status);
  const isPaused = run.status === "paused";
  const isPending = run.status === "pending";

  if (!isActive && !isPaused && !isPending) return null;

  return (
    <div className="flex items-center gap-1.5 mt-2" onClick={(e) => e.stopPropagation()}>
      {/* Active sync: Pause / Delete */}
      {isActive && (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAction('pause', run.id)}
                disabled={isLoading === run.id}
                className="gap-1 h-7 text-xs"
              >
                <Pause className="h-3 w-3" />
                Pausar
              </Button>
            </TooltipTrigger>
            <TooltipContent>Pausar a sincronização em andamento</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onAction('delete', run.id)}
                disabled={isLoading === run.id}
                className="gap-1 h-7 text-xs"
              >
                <Trash2 className="h-3 w-3" />
                Deletar
              </Button>
            </TooltipTrigger>
            <TooltipContent>Deletar a sincronização</TooltipContent>
          </Tooltip>
        </>
      )}

      {/* Paused sync: Continue / Delete */}
      {isPaused && (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                size="sm"
                onClick={() => onAction('resume', run.id)}
                disabled={isLoading === run.id}
                className="gap-1 h-7 text-xs"
              >
                <Play className="h-3 w-3" />
                Continuar
              </Button>
            </TooltipTrigger>
            <TooltipContent>Retomar a sincronização pausada</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onAction('delete', run.id)}
                disabled={isLoading === run.id}
                className="gap-1 h-7 text-xs"
              >
                <Trash2 className="h-3 w-3" />
                Deletar
              </Button>
            </TooltipTrigger>
            <TooltipContent>Deletar a sincronização</TooltipContent>
          </Tooltip>
        </>
      )}

      {/* Pending/queued sync: Cancel */}
      {isPending && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onAction('cancel_queued', run.id)}
              disabled={isLoading === run.id}
              className="gap-1 h-7 text-xs"
            >
              <Ban className="h-3 w-3" />
              Cancelar fila
            </Button>
          </TooltipTrigger>
          <TooltipContent>Cancelar a sincronização pendente na fila</TooltipContent>
        </Tooltip>
      )}

      {isLoading === run.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
    </div>
  );
}

export function SyncHistorySection() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { retryFailedProperties, isRetrying, apiKeys, loadApiKeys } = useImobziImport();
  const { pauseImport, resumeImport, deleteImport, cancelQueuedImport } = useImportProgress();
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { data: runs = [], isLoading, refetch } = useQuery({
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
    refetchInterval: 5000, // Auto-refresh to show live status
  });

  // Load API keys on mount
  useState(() => { loadApiKeys(); });

  const handleAction = async (action: string, runId: string) => {
    setActionLoading(runId);
    try {
      switch (action) {
        case 'pause':
          await pauseImport(runId);
          break;
        case 'resume':
          await resumeImport(runId);
          break;
        case 'delete':
          await deleteImport(runId);
          break;
        case 'cancel_queued':
          await cancelQueuedImport(runId);
          break;
      }
      await refetch();
    } catch (err) {
      console.error(`[SyncHistory] Error performing ${action}:`, err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRetryItems = async (items: ImportRunItem[]) => {
    const key = apiKeys[0];
    if (!key) {
      toast({ title: "Nenhuma chave API", description: "Adicione uma chave API do Imobzi primeiro.", variant: "destructive" });
      return;
    }
    
    toast({ title: "Reimportando imóveis", description: `${items.length} imóvel(is) sendo reimportado(s).` });
    
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
            const isActive = ["processing", "pending", "running", "starting", "paused"].includes(run.status);

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
                            
                            {/* Action buttons for active/pending syncs */}
                            <SyncActionButtons 
                              run={run} 
                              onAction={handleAction} 
                              isLoading={actionLoading} 
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {["processing", "running", "starting"].includes(run.status) && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                          {run.status === "paused" && <Pause className="h-4 w-4 text-muted-foreground" />}
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        </div>
                      </div>
                      {isActive && run.status !== "paused" && <Progress value={progress} className="h-1 mt-2" />}
                      {run.status === "paused" && (
                        <div className="mt-2">
                          <Progress value={progress} className="h-1 opacity-50" />
                        </div>
                      )}
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
