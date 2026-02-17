import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Database, RefreshCw } from "lucide-react";

interface TableInfo {
  name: string;
  count: number;
}

const TRACKED_TABLES = [
  "properties", "profiles", "organizations", "leads", "contracts",
  "appointments", "tasks", "invoices", "notifications", "lead_interactions",
  "marketplace_properties", "import_runs", "import_run_items", "deleted_property_media",
  "crm_import_logs", "audit_logs", "commissions", "consumer_favorites",
] as const;

export function DatabaseTab() {
  const { data: tables = [], isLoading, refetch, isFetching } = useQuery<TableInfo[]>({
    queryKey: ["dev-db-table-counts"],
    queryFn: async () => {
      const results = await Promise.all(
        TRACKED_TABLES.map(async (table) => {
          const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true });
          return { name: table, count: error ? -1 : (count || 0) };
        })
      );
      return results.sort((a, b) => b.count - a.count);
    },
    staleTime: 5 * 60 * 1000,
  });

  const maxCount = Math.max(...tables.map(t => t.count), 1);
  const totalRows = tables.reduce((sum, t) => sum + Math.max(t.count, 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Total de Registros</p>
            <p className="text-2xl font-bold">{totalRows.toLocaleString("pt-BR")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Tabelas Monitoradas</p>
            <p className="text-2xl font-bold">{tables.length}</p>
          </CardContent>
        </Card>
        <Card className="hidden sm:block">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Maior Tabela</p>
            <p className="text-lg font-bold">{tables[0]?.name || "—"}</p>
            <p className="text-xs text-muted-foreground">{tables[0]?.count.toLocaleString("pt-BR")} registros</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="h-4 w-4" />
                Contagem por Tabela
              </CardTitle>
              <CardDescription>Registros em cada tabela do banco</CardDescription>
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
                  <TableHead>Tabela</TableHead>
                  <TableHead className="text-right">Registros</TableHead>
                  <TableHead className="w-40 hidden sm:table-cell">Proporção</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tables.map((t) => (
                  <TableRow key={t.name}>
                    <TableCell className="font-mono text-sm">{t.name}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {t.count >= 0 ? (
                        t.count.toLocaleString("pt-BR")
                      ) : (
                        <Badge variant="destructive" className="text-[10px]">erro</Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {t.count >= 0 && (
                        <div className="flex items-center gap-2">
                          <Progress value={(t.count / maxCount) * 100} className="h-1.5 flex-1" />
                          <span className="text-[10px] text-muted-foreground w-8 text-right tabular-nums">
                            {totalRows > 0 ? Math.round((t.count / totalRows) * 100) : 0}%
                          </span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {tables.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      {isLoading ? "Carregando..." : "Nenhuma tabela encontrada"}
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
