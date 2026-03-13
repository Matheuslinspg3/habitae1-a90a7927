import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ScrollText, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface LogEntry {
  id: string;
  provider: string;
  model: string | null;
  function_name: string;
  usage_type: string;
  tokens_input: number | null;
  tokens_output: number | null;
  estimated_cost_usd: number | null;
  success: boolean | null;
  error_message: string | null;
  created_at: string;
}

const PROVIDER_COLORS: Record<string, string> = {
  lovable: "bg-primary/20 text-primary",
  openai: "bg-green-500/20 text-green-700 dark:text-green-400",
  gemini: "bg-blue-500/20 text-blue-700 dark:text-blue-400",
  anthropic: "bg-orange-500/20 text-orange-700 dark:text-orange-400",
  groq: "bg-purple-500/20 text-purple-700 dark:text-purple-400",
  stability: "bg-cyan-500/20 text-cyan-700 dark:text-cyan-400",
  leonardo: "bg-pink-500/20 text-pink-700 dark:text-pink-400",
  flux: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
};

export function AILogsTable() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      const { data, error } = await supabase
        .from("ai_usage_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      setLogs((data as any[]) || []);
    } catch (err) {
      console.error("Erro ao carregar logs:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-primary" />
          Últimas Requisições de IA
        </CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum log registrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Data</TableHead>
                  <TableHead className="text-xs">Provedor</TableHead>
                  <TableHead className="text-xs">Modelo</TableHead>
                  <TableHead className="text-xs">Função</TableHead>
                  <TableHead className="text-xs">Tipo</TableHead>
                  <TableHead className="text-xs text-right">Tokens</TableHead>
                  <TableHead className="text-xs text-right">Custo</TableHead>
                  <TableHead className="text-xs text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`text-[10px] ${PROVIDER_COLORS[log.provider] || ""}`}>
                        {log.provider}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono">{log.model || "—"}</TableCell>
                    <TableCell className="text-xs">{log.function_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{log.usage_type}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-right text-muted-foreground">
                      {(log.tokens_input || 0) + (log.tokens_output || 0) > 0
                        ? `${((log.tokens_input || 0) + (log.tokens_output || 0)).toLocaleString()}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-right font-medium">
                      {log.estimated_cost_usd ? `$${log.estimated_cost_usd.toFixed(4)}` : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {log.success ? (
                        <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                      ) : (
                        <span title={log.error_message || ""}>
                          <XCircle className="h-4 w-4 text-destructive mx-auto" />
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
