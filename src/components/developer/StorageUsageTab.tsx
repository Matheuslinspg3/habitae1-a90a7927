import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Cloud, Database, Image, TrendingUp, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CloudinaryCleanupSection } from "./CloudinaryCleanupSection";

interface R2Data {
  configured: boolean;
  total_objects?: number;
  total_bytes?: number;
  by_folder?: Record<string, { count: number; bytes: number }>;
  free_limit_bytes?: number;
  error?: string | null;
}

interface CloudinaryData {
  configured: boolean;
  storage_used_bytes?: number;
  bandwidth_used_bytes?: number;
  total_resources?: number;
  credits_used?: number;
  credits_limit?: number;
  plan?: string;
  free_limit_bytes?: number;
  error?: string | null;
}

interface StorageMetrics {
  r2: R2Data;
  cloudinary: CloudinaryData;
  cloudinary2: CloudinaryData;
}

const formatBytes = (bytes: number) => {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const getUsageColor = (percent: number) => {
  if (percent >= 90) return "text-destructive";
  if (percent >= 70) return "text-yellow-500";
  return "text-emerald-500";
};

function CloudinaryCard({
  data,
  label,
  badgeLabel,
}: {
  data: CloudinaryData | undefined;
  label: string;
  badgeLabel: string;
}) {
  const cloudBytes = data?.storage_used_bytes || 0;
  const cloudLimit = data?.free_limit_bytes || 25 * 1024 * 1024 * 1024;
  const cloudPercent = Math.min((cloudBytes / cloudLimit) * 100, 100);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Image className="h-4 w-4" />
            {label}
          </CardTitle>
          <div className="flex gap-1.5">
            {data?.plan && (
              <Badge variant="outline">{data.plan}</Badge>
            )}
            <Badge variant="outline">{badgeLabel}</Badge>
          </div>
        </div>
        <CardDescription>CDN de imagens · 25 créditos (storage + bandwidth + transforms)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {data?.error ? (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            Erro ao consultar {label}
          </div>
        ) : !data?.configured ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            Não configurado
          </div>
        ) : (
          <>
            {data?.credits_limit ? (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Créditos utilizados</span>
                  <span className={`font-mono font-medium ${getUsageColor(
                    ((data.credits_used || 0) / data.credits_limit) * 100
                  )}`}>
                    {(data.credits_used || 0).toFixed(2)} / {data.credits_limit}
                  </span>
                </div>
                <Progress
                  value={Math.min(((data.credits_used || 0) / data.credits_limit) * 100, 100)}
                  className="h-3"
                />
                <p className="text-xs text-muted-foreground">
                  1 crédito = 1GB storage OU 1GB bandwidth OU 500 transformações
                </p>
              </div>
            ) : null}
            <div className="space-y-2 pt-2 border-t">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Storage</span>
                <span className="font-mono font-medium">{formatBytes(cloudBytes)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Bandwidth (30d)</span>
                <span className="font-mono font-medium">{formatBytes(data?.bandwidth_used_bytes || 0)}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2 border-t">
              <div>
                <p className="text-xs text-muted-foreground">Recursos totais</p>
                <p className="text-lg font-semibold">{(data?.total_resources || 0).toLocaleString("pt-BR")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tamanho médio</p>
                <p className="text-lg font-semibold">
                  {data?.total_resources ? formatBytes(cloudBytes / data.total_resources) : "—"}
                </p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function StorageUsageTab() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<StorageMetrics>({
    queryKey: ["dev-storage-metrics"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("storage-metrics");
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const r2 = data?.r2;
  const cloudinary = data?.cloudinary;
  const cloudinary2 = data?.cloudinary2;

  const r2Bytes = r2?.total_bytes || 0;
  const r2Limit = r2?.free_limit_bytes || 10 * 1024 * 1024 * 1024;
  const r2Percent = Math.min((r2Bytes / r2Limit) * 100, 100);

  const cloud1Bytes = cloudinary?.storage_used_bytes || 0;
  const cloud2Bytes = cloudinary2?.storage_used_bytes || 0;

  const totalBytes = r2Bytes + cloud1Bytes + cloud2Bytes;
  const totalObjects = (r2?.total_objects || 0) + (cloudinary?.total_resources || 0) + (cloudinary2?.total_resources || 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
        <RefreshCw className="h-4 w-4 animate-spin" />
        Consultando APIs do R2 e Cloudinary...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-muted-foreground">Erro ao buscar métricas: {(error as Error).message}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Provider Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* R2 Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Cloud className="h-4 w-4" />
                Cloudflare R2
              </CardTitle>
              <Badge variant={r2Percent >= 90 ? "destructive" : "secondary"}>Primário</Badge>
            </div>
            <CardDescription>Storage S3-compatible · 10GB gratuitos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {r2?.error ? (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                Erro ao consultar R2
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Espaço utilizado</span>
                    <span className={`font-mono font-medium ${getUsageColor(r2Percent)}`}>
                      {formatBytes(r2Bytes)} / 10GB
                    </span>
                  </div>
                  <Progress value={r2Percent} className="h-3" />
                  <p className="text-xs text-muted-foreground text-right">{r2Percent.toFixed(1)}% utilizado</p>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">Arquivos</p>
                    <p className="text-lg font-semibold">{(r2?.total_objects || 0).toLocaleString("pt-BR")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tamanho médio</p>
                    <p className="text-lg font-semibold">
                      {r2?.total_objects ? formatBytes(r2Bytes / r2.total_objects) : "—"}
                    </p>
                  </div>
                </div>

                {r2?.by_folder && Object.keys(r2.by_folder).length > 0 && (
                  <div className="pt-2 border-t space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Por pasta</p>
                    {Object.entries(r2.by_folder)
                      .sort(([, a], [, b]) => b.bytes - a.bytes)
                      .map(([folder, stats]) => (
                        <div key={folder} className="flex items-center justify-between text-sm">
                          <span className="font-mono text-xs">{folder}/</span>
                          <span className="text-muted-foreground text-xs">
                            {stats.count} arquivos · {formatBytes(stats.bytes)}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Cloudinary 1 Card */}
        <CloudinaryCard data={cloudinary} label="Cloudinary 1" badgeLabel="Fallback" />

        {/* Cloudinary 2 Card */}
        <CloudinaryCard data={cloudinary2} label="Cloudinary 2" badgeLabel="Pool 2" />
      </div>

      {/* Totals Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Resumo Total
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Total de Arquivos</p>
              <p className="text-xl font-bold">{totalObjects.toLocaleString("pt-BR")}</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Storage Total</p>
              <p className="text-xl font-bold">{formatBytes(totalBytes)}</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">% no R2</p>
              <p className="text-xl font-bold">
                {totalBytes > 0 ? Math.round((r2Bytes / totalBytes) * 100) : 0}%
              </p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">% Cloudinary 1</p>
              <p className="text-xl font-bold">
                {totalBytes > 0 ? Math.round((cloud1Bytes / totalBytes) * 100) : 0}%
              </p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">% Cloudinary 2</p>
              <p className="text-xl font-bold">
                {totalBytes > 0 ? Math.round((cloud2Bytes / totalBytes) * 100) : 0}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* R2 Folder Breakdown Table */}
      {r2?.by_folder && Object.keys(r2.by_folder).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4" />
              R2 — Detalhamento por Pasta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pasta</TableHead>
                  <TableHead className="text-right">Arquivos</TableHead>
                  <TableHead className="text-right">Tamanho</TableHead>
                  <TableHead className="w-32">% do Total R2</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(r2.by_folder)
                  .sort(([, a], [, b]) => b.bytes - a.bytes)
                  .map(([folder, stats]) => {
                    const pct = r2Bytes > 0 ? Math.round((stats.bytes / r2Bytes) * 100) : 0;
                    return (
                      <TableRow key={folder}>
                        <TableCell className="font-mono text-sm">{folder}/</TableCell>
                        <TableCell className="text-right">{stats.count.toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{formatBytes(stats.bytes)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={pct} className="h-2 flex-1" />
                            <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Cloudinary Cleanup - Account 1 */}
      <CloudinaryCleanupSection account={undefined} label="Cloudinary 1" />

      {/* Cloudinary Cleanup - Account 2 */}
      {cloudinary2?.configured && (
        <CloudinaryCleanupSection account="2" label="Cloudinary 2" />
      )}
    </div>
  );
}
