import { useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, CheckCircle2, CloudUpload, Loader2, Play, Square, TestTube, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MigrationResult {
  migrated: number;
  failed: number;
  skipped: number;
  remaining: number;
  errors: string[];
  elapsed_ms: number;
  message: string;
  dryRun?: boolean;
  wouldMigrate?: number;
}

export function CloudinaryMigrationCard() {
  const [status, setStatus] = useState<"idle" | "running" | "dryrun" | "done" | "error">("idle");
  const [batchSize, setBatchSize] = useState("10");
  const [autoMode, setAutoMode] = useState(false);
  const [results, setResults] = useState<MigrationResult | null>(null);
  const [totals, setTotals] = useState({ migrated: 0, failed: 0, batches: 0 });
  const stopRef = useRef(false);

  const runBatch = useCallback(async (isDryRun: boolean): Promise<MigrationResult | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("migrate-cloudinary-to-r2", {
        body: { batchSize: Number(batchSize), dryRun: isDryRun },
      });
      if (error) throw new Error(error.message || "Erro ao chamar função");
      return data as MigrationResult;
    } catch (err: any) {
      toast.error("Erro na migração", { description: err.message });
      return null;
    }
  }, [batchSize]);

  const handleDryRun = async () => {
    setStatus("dryrun");
    const result = await runBatch(true);
    if (result) {
      setResults(result);
      toast.info(`Dry run: ${result.wouldMigrate || 0} imagens seriam migradas. ${result.remaining || 0} total pendentes.`);
    }
    setStatus("idle");
  };

  const handleRunOnce = async () => {
    setStatus("running");
    stopRef.current = false;
    const result = await runBatch(false);
    if (result) {
      setResults(result);
      setTotals(prev => ({
        migrated: prev.migrated + result.migrated,
        failed: prev.failed + result.failed,
        batches: prev.batches + 1,
      }));
      if (result.migrated > 0) {
        toast.success(`Lote concluído: ${result.migrated} migradas, ${result.remaining} restantes`);
      } else if (result.remaining === 0) {
        toast.success("✅ Migração concluída!");
      }
    }
    setStatus(result?.remaining === 0 ? "done" : "idle");
  };

  const handleAutoRun = async () => {
    setStatus("running");
    setAutoMode(true);
    stopRef.current = false;
    let batchCount = 0;

    while (!stopRef.current) {
      const result = await runBatch(false);
      if (!result) break;

      batchCount++;
      setResults(result);
      setTotals(prev => ({
        migrated: prev.migrated + result.migrated,
        failed: prev.failed + result.failed,
        batches: prev.batches + 1,
      }));

      // Stop conditions
      if (result.remaining === 0) {
        toast.success(`✅ Migração concluída! ${batchCount} lotes processados.`);
        break;
      }
      if (result.migrated === 0 && result.failed === 0) {
        toast.warning("Nenhuma imagem processada neste lote. Parando.");
        break;
      }

      // Small delay between batches to avoid hammering
      await new Promise(r => setTimeout(r, 2000));
    }

    setAutoMode(false);
    setStatus("done");
  };

  const handleStop = () => {
    stopRef.current = true;
    setAutoMode(false);
    toast.info("Parando após o lote atual...");
  };

  const handleReset = () => {
    setResults(null);
    setTotals({ migrated: 0, failed: 0, batches: 0 });
    setStatus("idle");
  };

  const isRunning = status === "running";
  const progress = results?.remaining !== undefined && results.remaining >= 0
    ? Math.max(0, 100 - (results.remaining / ((results.remaining + totals.migrated) || 1)) * 100)
    : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CloudUpload className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm">Migração Cloudinary → R2</CardTitle>
          </div>
          {status === "done" && <Badge variant="default" className="bg-green-600 text-[10px]">Concluído</Badge>}
          {isRunning && <Badge variant="secondary" className="text-[10px]">Executando...</Badge>}
        </div>
        <CardDescription className="text-xs">
          Migra imagens do Cloudinary (conta expirada) para o Cloudflare R2.
          Cada lote processa N imagens com retry e timeout de segurança.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={batchSize} onValueChange={setBatchSize} disabled={isRunning}>
            <SelectTrigger className="w-[100px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5 / lote</SelectItem>
              <SelectItem value="10">10 / lote</SelectItem>
              <SelectItem value="20">20 / lote</SelectItem>
              <SelectItem value="30">30 / lote</SelectItem>
              <SelectItem value="50">50 / lote</SelectItem>
            </SelectContent>
          </Select>

          <Button size="sm" variant="outline" onClick={handleDryRun} disabled={isRunning} className="text-xs h-8">
            <TestTube className="h-3.5 w-3.5 mr-1" />
            Dry Run
          </Button>

          <Button size="sm" variant="outline" onClick={handleRunOnce} disabled={isRunning} className="text-xs h-8">
            <Play className="h-3.5 w-3.5 mr-1" />
            1 Lote
          </Button>

          <Button size="sm" onClick={isRunning ? handleStop : handleAutoRun} className="text-xs h-8"
            variant={isRunning ? "destructive" : "default"}>
            {isRunning ? (
              <><Square className="h-3.5 w-3.5 mr-1" />Parar</>
            ) : (
              <><RefreshCw className="h-3.5 w-3.5 mr-1" />Auto (loop)</>
            )}
          </Button>

          {status === "done" && (
            <Button size="sm" variant="ghost" onClick={handleReset} className="text-xs h-8">Reset</Button>
          )}
        </div>

        {/* Progress */}
        {(results || isRunning) && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>
                {isRunning && <Loader2 className="h-3 w-3 animate-spin inline mr-1" />}
                {autoMode ? "Modo automático" : "Manual"}
              </span>
              <span>
                {totals.batches > 0 && `${totals.batches} lotes • `}
                {totals.migrated} migradas • {totals.failed} falhas
                {results?.remaining !== undefined && ` • ${results.remaining} restantes`}
              </span>
            </div>
          </div>
        )}

        {/* Last result */}
        {results && (
          <div className="rounded border p-3 space-y-2 bg-muted/30">
            <div className="flex items-start gap-2">
              {results.failed === 0 && results.migrated > 0 ? (
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              ) : results.failed > 0 ? (
                <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              )}
              <p className="text-xs">{results.message}</p>
            </div>

            {results.elapsed_ms !== undefined && (
              <p className="text-[10px] text-muted-foreground">
                Tempo: {(results.elapsed_ms / 1000).toFixed(1)}s
              </p>
            )}

            {results.errors && results.errors.length > 0 && (
              <details className="text-[10px]">
                <summary className="text-yellow-600 cursor-pointer">
                  {results.errors.length} erro(s) no último lote
                </summary>
                <ul className="mt-1 space-y-0.5 text-muted-foreground max-h-32 overflow-y-auto">
                  {results.errors.map((err, i) => (
                    <li key={i} className="font-mono break-all">{err}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        {/* Info */}
        <p className="text-[10px] text-muted-foreground">
          💡 <strong>Dry Run</strong> mostra quantas imagens serão migradas sem executar.{" "}
          <strong>Auto</strong> executa lotes continuamente até concluir.
          Imagens inacessíveis são marcadas como "cloudinary_dead" para não retentar.
        </p>
      </CardContent>
    </Card>
  );
}
