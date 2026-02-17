import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { RefreshCw, Download, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusConfig: Record<string, { label: string; icon: React.ElementType; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  completed: { label: "Concluído", icon: CheckCircle2, variant: "default" },
  running: { label: "Em andamento", icon: Clock, variant: "secondary" },
  failed: { label: "Falhou", icon: XCircle, variant: "destructive" },
  partial: { label: "Parcial", icon: AlertTriangle, variant: "outline" },
};

export function ImportHistoryTab() {
  const { data: runs = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["dev-import-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_runs")
        .select("id, status, source_provider, total_properties, imported, updated, errors, skipped, started_at, finished_at, organization_id, images_processed, images_scraped, images_failed, scrape_failed")
        .order("started_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: orgs = [] } = useQuery({
    queryKey: ["dev-orgs-map"],
    queryFn: async () => {
      const { data, error } = await supabase.from("organizations").select("id, name");
      if (error) throw error;
      return data || [];
    },
  });

  const getOrgName = (id: string) => orgs.find(o => o.id === id)?.name || id.slice(0, 8);

  const getDuration = (start: string, end: string | null) => {
    if (!end) return "—";
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    return `${Math.round(ms / 60000)}min`;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Download className="h-4 w-4" />
                Histórico de Importações
              </CardTitle>
              <CardDescription>Últimas 50 importações de todas as organizações</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-5 sm:-mx-6 px-5 sm:px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead className="hidden sm:table-cell">Organização</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Importados</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Imagens</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Erros</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Duração</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => {
                  const cfg = statusConfig[run.status] || statusConfig.partial;
                  const StatusIcon = cfg.icon;
                  return (
                    <TableRow key={run.id}>
                      <TableCell className="text-sm">
                        <div>
                          <p className="font-medium">{format(new Date(run.started_at), "dd/MM", { locale: ptBR })}</p>
                          <p className="text-[10px] text-muted-foreground">{format(new Date(run.started_at), "HH:mm")}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm hidden sm:table-cell">{getOrgName(run.organization_id)}</TableCell>
                      <TableCell>
                        <Badge variant={cfg.variant} className="gap-1 text-[10px]">
                          <StatusIcon className="h-3 w-3" />
                          <span className="hidden sm:inline">{cfg.label}</span>
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{run.total_properties || 0}</TableCell>
                      <TableCell className="text-right tabular-nums hidden sm:table-cell">{run.imported || 0}</TableCell>
                      <TableCell className="text-right tabular-nums hidden md:table-cell">{run.images_processed || 0}</TableCell>
                      <TableCell className="text-right tabular-nums hidden sm:table-cell">
                        {(run.errors || 0) > 0 ? (
                          <span className="text-destructive font-medium">{run.errors}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm hidden md:table-cell">{getDuration(run.started_at, run.finished_at)}</TableCell>
                    </TableRow>
                  );
                })}
                {runs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      {isLoading ? "Carregando..." : "Nenhuma importação encontrada"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
