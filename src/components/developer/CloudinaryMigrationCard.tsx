import { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, Ban, CheckCircle2, CloudUpload, Filter, Loader2, Play, Search, Square, TestTube, RefreshCw, X } from "lucide-react";
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

interface PropertyOption {
  id: string;
  title: string;
  code: string;
  cloudinaryCount: number;
}

export function CloudinaryMigrationCard() {
  const [status, setStatus] = useState<"idle" | "running" | "dryrun" | "done" | "error" | "cancelled">("idle");
  const [batchSize, setBatchSize] = useState("10");
  const [autoMode, setAutoMode] = useState(false);
  const [results, setResults] = useState<MigrationResult | null>(null);
  const [totals, setTotals] = useState({ migrated: 0, failed: 0, batches: 0 });
  const stopRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // Property selection
  const [showFilter, setShowFilter] = useState(false);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  const [propertySearch, setPropertySearch] = useState("");
  const [loadingProperties, setLoadingProperties] = useState(false);

  // Load properties with cloudinary images
  const loadProperties = useCallback(async () => {
    setLoadingProperties(true);
    try {
      const { data, error } = await supabase
        .from("property_images")
        .select("property_id, properties!inner(id, title, property_code)")
        .or("storage_provider.eq.cloudinary,storage_provider.is.null")
        .like("url", "%res.cloudinary.com%")
        .is("r2_key_full", null);

      if (error) throw error;

      // Aggregate by property
      const map = new Map<string, PropertyOption>();
      for (const row of (data || []) as any[]) {
        const p = row.properties;
        if (!p?.id) continue;
        const existing = map.get(p.id);
        if (existing) {
          existing.cloudinaryCount++;
        } else {
          map.set(p.id, {
            id: p.id,
            title: p.title || "Sem título",
            code: p.property_code || "—",
            cloudinaryCount: 1,
          });
        }
      }
      setProperties(Array.from(map.values()).sort((a, b) => b.cloudinaryCount - a.cloudinaryCount));
    } catch (err: any) {
      toast.error("Erro ao carregar imóveis", { description: err.message });
    } finally {
      setLoadingProperties(false);
    }
  }, []);

  useEffect(() => {
    if (showFilter && properties.length === 0) loadProperties();
  }, [showFilter, loadProperties, properties.length]);

  const filteredProperties = properties.filter(p =>
    !propertySearch ||
    p.title.toLowerCase().includes(propertySearch.toLowerCase()) ||
    p.code.includes(propertySearch)
  );

  const toggleProperty = (id: string) => {
    setSelectedPropertyIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const runBatch = useCallback(async (isDryRun: boolean): Promise<MigrationResult | null> => {
    try {
      abortRef.current = new AbortController();
      const body: any = { batchSize: Number(batchSize), dryRun: isDryRun };
      if (selectedPropertyIds.length > 0) {
        body.propertyIds = selectedPropertyIds;
      }
      const { data, error } = await supabase.functions.invoke("migrate-cloudinary-to-r2", { body });
      if (error) throw new Error(error.message || "Erro ao chamar função");
      return data as MigrationResult;
    } catch (err: any) {
      if (err.name === "AbortError") return null;
      toast.error("Erro na migração", { description: err.message });
      return null;
    } finally {
      abortRef.current = null;
    }
  }, [batchSize, selectedPropertyIds]);

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

      if (result.remaining === 0) {
        toast.success(`✅ Migração concluída! ${batchCount} lotes.`);
        break;
      }
      if (result.migrated === 0 && result.failed === 0) {
        toast.warning("Nenhuma imagem processada. Parando.");
        break;
      }

      await new Promise(r => setTimeout(r, 2000));
    }

    setAutoMode(false);
    setStatus(stopRef.current ? "cancelled" : "done");
  };

  const handleStop = () => {
    stopRef.current = true;
    setAutoMode(false);
    toast.info("Parando após o lote atual...");
  };

  const handleCancel = () => {
    stopRef.current = true;
    setAutoMode(false);
    abortRef.current?.abort();
    setStatus("cancelled");
    toast.warning("Operação cancelada.");
  };

  const handleReset = () => {
    setResults(null);
    setTotals({ migrated: 0, failed: 0, batches: 0 });
    setStatus("idle");
  };

  const isRunning = status === "running";
  const totalProcessed = totals.migrated + totals.failed;
  const totalScope = results?.remaining !== undefined ? results.remaining + totalProcessed : 0;
  const progress = totalScope > 0 ? Math.min(100, (totalProcessed / totalScope) * 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CloudUpload className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm">Migração Cloudinary → R2</CardTitle>
          </div>
          <div className="flex items-center gap-1.5">
            {status === "done" && <Badge variant="default" className="bg-green-600 text-[10px]">Concluído</Badge>}
            {status === "cancelled" && <Badge variant="secondary" className="text-[10px]">Cancelado</Badge>}
            {isRunning && <Badge variant="secondary" className="text-[10px]">Executando...</Badge>}
            {selectedPropertyIds.length > 0 && (
              <Badge variant="outline" className="text-[10px]">{selectedPropertyIds.length} imóveis</Badge>
            )}
          </div>
        </div>
        <CardDescription className="text-xs">
          Migra imagens do Cloudinary (conta expirada) para o Cloudflare R2.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controls row 1: batch size + filter */}
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

          <Button size="sm" variant={showFilter ? "secondary" : "outline"} onClick={() => setShowFilter(!showFilter)}
            disabled={isRunning} className="text-xs h-8">
            <Filter className="h-3.5 w-3.5 mr-1" />
            Filtrar Imóveis
          </Button>

          {selectedPropertyIds.length > 0 && !isRunning && (
            <Button size="sm" variant="ghost" className="text-xs h-8" onClick={() => setSelectedPropertyIds([])}>
              <X className="h-3.5 w-3.5 mr-1" />Limpar filtro
            </Button>
          )}
        </div>

        {/* Property filter panel */}
        {showFilter && (
          <div className="rounded border p-3 space-y-2 bg-muted/20">
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por título ou código..."
                value={propertySearch}
                onChange={e => setPropertySearch(e.target.value)}
                className="h-7 text-xs"
              />
            </div>
            {loadingProperties ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{properties.length} imóveis com imagens Cloudinary</span>
                  <div className="flex gap-2">
                    <button className="underline" onClick={() => setSelectedPropertyIds(filteredProperties.map(p => p.id))}>
                      Selecionar todos
                    </button>
                    <button className="underline" onClick={() => setSelectedPropertyIds([])}>
                      Limpar
                    </button>
                  </div>
                </div>
                <ScrollArea className="max-h-48">
                  <div className="space-y-1">
                    {filteredProperties.map(p => (
                      <label key={p.id} className="flex items-center gap-2 text-xs p-1.5 rounded hover:bg-muted/50 cursor-pointer">
                        <Checkbox
                          checked={selectedPropertyIds.includes(p.id)}
                          onCheckedChange={() => toggleProperty(p.id)}
                        />
                        <span className="font-mono text-[10px] text-muted-foreground w-10">#{p.code}</span>
                        <span className="truncate flex-1">{p.title}</span>
                        <Badge variant="outline" className="text-[9px] shrink-0">{p.cloudinaryCount} img</Badge>
                      </label>
                    ))}
                    {filteredProperties.length === 0 && (
                      <p className="text-[10px] text-muted-foreground text-center py-2">Nenhum imóvel encontrado.</p>
                    )}
                  </div>
                </ScrollArea>
              </>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={handleDryRun} disabled={isRunning} className="text-xs h-8">
            <TestTube className="h-3.5 w-3.5 mr-1" />
            Dry Run
          </Button>

          <Button size="sm" variant="outline" onClick={handleRunOnce} disabled={isRunning} className="text-xs h-8">
            <Play className="h-3.5 w-3.5 mr-1" />
            1 Lote
          </Button>

          {!isRunning ? (
            <Button size="sm" onClick={handleAutoRun} className="text-xs h-8">
              <RefreshCw className="h-3.5 w-3.5 mr-1" />Auto (loop)
            </Button>
          ) : (
            <>
              <Button size="sm" variant="secondary" onClick={handleStop} className="text-xs h-8">
                <Square className="h-3.5 w-3.5 mr-1" />Parar (após lote)
              </Button>
              <Button size="sm" variant="destructive" onClick={handleCancel} className="text-xs h-8">
                <Ban className="h-3.5 w-3.5 mr-1" />Cancelar agora
              </Button>
            </>
          )}

          {(status === "done" || status === "cancelled") && (
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
                {selectedPropertyIds.length > 0 && ` • ${selectedPropertyIds.length} imóveis selecionados`}
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
                <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
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

            {results.errors?.length > 0 && (
              <details className="text-[10px]">
                <summary className="text-amber-600 cursor-pointer">
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

        <p className="text-[10px] text-muted-foreground">
          💡 <strong>Filtrar Imóveis</strong> permite migrar apenas os imóveis selecionados.{" "}
          <strong>Parar</strong> espera o lote atual terminar. <strong>Cancelar</strong> aborta imediatamente.
        </p>
      </CardContent>
    </Card>
  );
}
