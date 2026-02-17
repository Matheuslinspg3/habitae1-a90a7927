import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Trash2, Eye, AlertTriangle, Loader2, FolderOpen, Shield, XCircle, Clock, CheckCircle2, Zap, FolderX, Flame } from "lucide-react";

interface PreviewResult {
  total_resources: number;
  total_bytes: number;
  folders: Record<string, { count: number; bytes: number }>;
  public_ids: string[];
  oldest: string | null;
  newest: string | null;
  truncated?: boolean;
  next_cursor?: string | null;
}

const BATCH_SIZE = 100;
const CONFIRM_PHRASE = "EXCLUIR TUDO";

const formatBytes = (bytes: number) => {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

interface CloudinaryCleanupProps {
  account?: string; // "2" for Cloudinary 2, undefined for default
  label?: string;
}

export function CloudinaryCleanupSection({ account, label = "Cloudinary" }: CloudinaryCleanupProps) {
  // Background cleanup queue state
  const [bgQueue, setBgQueue] = useState<{ pending: number; cleaned: number; errors: number; oldest: string | null } | null>(null);
  const [bgLoading, setBgLoading] = useState(true);

  const fetchBgQueue = useCallback(async () => {
    const { data, error } = await supabase
      .from('deleted_property_media')
      .select('cleaned_at, cleanup_error, deleted_at');
    if (error || !data) { setBgLoading(false); return; }
    const pending = data.filter(r => !r.cleaned_at).length;
    const cleaned = data.filter(r => r.cleaned_at).length;
    const errors = data.filter(r => r.cleanup_error).length;
    const pendingItems = data.filter(r => !r.cleaned_at);
    const oldest = pendingItems.length > 0
      ? pendingItems.reduce((o, r) => r.deleted_at < o ? r.deleted_at : o, pendingItems[0].deleted_at)
      : null;
    setBgQueue({ pending, cleaned, errors, oldest });
    setBgLoading(false);
  }, []);

  useEffect(() => {
    fetchBgQueue();
    const interval = setInterval(fetchBgQueue, 30000);
    return () => clearInterval(interval);
  }, [fetchBgQueue]);

  const [prefix, setPrefix] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");

  // Resumable preview state
  const [accumulatedPreview, setAccumulatedPreview] = useState<PreviewResult | null>(null);
  const [isResuming, setIsResuming] = useState(false);

  // Deletion progress state
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(0);
  const [deletedCount, setDeletedCount] = useState(0);
  const [deleteErrors, setDeleteErrors] = useState<string[]>([]);
  const [deleteTotalAttempted, setDeleteTotalAttempted] = useState(0);
  const [deleteComplete, setDeleteComplete] = useState(false);
  const cancelRef = useRef(false);

  // Folder deletion state
  const [deletingFolder, setDeletingFolder] = useState<string | null>(null);
  const [folderDeleteResult, setFolderDeleteResult] = useState<{ folder: string; deleted: number; rounds: number } | null>(null);

  // Purge total state
  const [isPurging, setIsPurging] = useState(false);
  const [purgeResult, setPurgeResult] = useState<{ deleted: number; rounds: number; errors?: string[] } | null>(null);
  const [purgeConfirmOpen, setPurgeConfirmOpen] = useState(false);
  const [purgeConfirmInput, setPurgeConfirmInput] = useState("");

  const handlePurgeAll = useCallback(async () => {
    setPurgeConfirmOpen(false);
    setPurgeConfirmInput("");
    setIsPurging(true);
    setPurgeResult(null);

    const accountKey = account === "2" ? "cloudinary2" : "cloudinary1";
    let totalDeleted = 0;
    let totalRounds = 0;
    const errors: string[] = [];

    // Loop until done (each call is time-limited)
    let keepGoing = true;
    while (keepGoing) {
      try {
        const { data, error } = await supabase.functions.invoke("cloudinary-purge", {
          body: { accounts: [accountKey] },
        });
        if (error) { errors.push(error.message); keepGoing = false; break; }

        const acctResult = data?.results?.[accountKey];
        if (!acctResult) { keepGoing = false; break; }

        totalDeleted += acctResult.deleted || 0;
        totalRounds += acctResult.rounds || 0;

        // If deleted 0 this round, we're done
        if ((acctResult.deleted || 0) === 0) {
          keepGoing = false;
        }
      } catch (e: any) {
        errors.push(e.message);
        keepGoing = false;
      }
    }

    setPurgeResult({ deleted: totalDeleted, rounds: totalRounds, errors: errors.length > 0 ? errors : undefined });
    setIsPurging(false);

    if (errors.length > 0) {
      toast({ title: `Purge parcial: ${totalDeleted} excluídos com erros`, variant: "destructive" });
    } else {
      toast({ title: `Purge completo: ${totalDeleted} arquivos excluídos em ${totalRounds} rodada(s)!` });
    }
  }, [account]);

  // ── SOLUTION 1: Resumable Preview (handles timeout by accumulating pages) ──
  const handlePreview = useCallback(async (cursor?: string) => {
    const isResume = !!cursor;
    if (isResume) {
      setIsResuming(true);
    } else {
      setIsLoadingPreview(true);
      setAccumulatedPreview(null);
    }
    setDeleteComplete(false);

    try {
      const { data, error } = await supabase.functions.invoke("cloudinary-cleanup", {
        body: { action: "preview", prefix: prefix || undefined, cursor: cursor || undefined, account },
      });
      if (error) throw error;

      const result = data as PreviewResult;

      if (isResume && accumulatedPreview) {
        // Merge with previous results
        const merged: PreviewResult = {
          total_resources: accumulatedPreview.total_resources + result.total_resources,
          total_bytes: accumulatedPreview.total_bytes + result.total_bytes,
          folders: { ...accumulatedPreview.folders },
          public_ids: [...accumulatedPreview.public_ids, ...result.public_ids],
          oldest: accumulatedPreview.oldest && result.oldest
            ? (accumulatedPreview.oldest < result.oldest ? accumulatedPreview.oldest : result.oldest)
            : accumulatedPreview.oldest || result.oldest,
          newest: accumulatedPreview.newest && result.newest
            ? (accumulatedPreview.newest > result.newest ? accumulatedPreview.newest : result.newest)
            : accumulatedPreview.newest || result.newest,
          truncated: result.truncated,
          next_cursor: result.next_cursor,
        };
        // Merge folder counts
        for (const [folder, stats] of Object.entries(result.folders)) {
          if (merged.folders[folder]) {
            merged.folders[folder].count += stats.count;
            merged.folders[folder].bytes += stats.bytes;
          } else {
            merged.folders[folder] = { ...stats };
          }
        }
        setAccumulatedPreview(merged);
        setPreview(merged);
      } else {
        setAccumulatedPreview(result);
        setPreview(result);
      }
    } catch (e: any) {
      toast({ title: "Erro ao listar", description: e.message, variant: "destructive" });
    } finally {
      setIsLoadingPreview(false);
      setIsResuming(false);
    }
  }, [prefix, accumulatedPreview, account]);

  // ── SOLUTION 2: Standard batch delete (existing, works with full preview) ──
  const handleDelete = useCallback(async () => {
    if (!preview?.public_ids?.length) return;

    setConfirmOpen(false);
    setConfirmInput("");
    setIsDeleting(true);
    setDeleteProgress(0);
    setDeletedCount(0);
    setDeleteErrors([]);
    setDeleteComplete(false);
    cancelRef.current = false;

    const ids = preview.public_ids;
    let totalDeleted = 0;
    let totalAttempted = 0;
    const errors: string[] = [];

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      if (cancelRef.current) {
        errors.push(`Cancelado pelo usuário após ${totalDeleted} exclusões`);
        break;
      }

      const batch = ids.slice(i, i + BATCH_SIZE);
      totalAttempted += batch.length;
      setDeleteTotalAttempted(totalAttempted);

      try {
        const { data, error } = await supabase.functions.invoke("cloudinary-cleanup", {
          body: { action: "delete-batch", public_ids: batch, account },
        });

        if (error) {
          errors.push(`Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
        } else if (data?.error) {
          errors.push(`Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${data.error}`);
        } else {
          totalDeleted += data?.deleted || 0;
        }
      } catch (e: any) {
        errors.push(`Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${e.message}`);
      }

      setDeletedCount(totalDeleted);
      setDeleteErrors([...errors]);
      setDeleteProgress(Math.round(((i + batch.length) / ids.length) * 100));
    }

    setDeleteProgress(100);
    setDeleteComplete(true);
    setIsDeleting(false);
    setPreview(null);
    setAccumulatedPreview(null);

    if (errors.length > 0) {
      toast({ title: `${totalDeleted} excluídas com ${errors.length} erro(s)`, variant: "destructive" });
    } else {
      toast({ title: `${totalDeleted} imagens excluídas com sucesso!` });
    }
  }, [preview, account]);

  // ── SOLUTION 3 (Innovative): Delete entire folder via API without listing ──
  const handleDeleteFolder = useCallback(async (folder: string) => {
    const folderPrefix = folder === '(root)' ? '' : folder;
    if (!folderPrefix) {
      toast({ title: "Não é possível excluir a pasta raiz diretamente", description: "Use o prefixo no campo de filtro.", variant: "destructive" });
      return;
    }

    setDeletingFolder(folder);
    setFolderDeleteResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("cloudinary-cleanup", {
        body: { action: "delete-all-by-prefix", prefix: folderPrefix, account },
      });
      if (error) throw error;

      setFolderDeleteResult({ folder, deleted: data.deleted, rounds: data.rounds });

      if (data.error) {
        toast({ title: `Erro parcial na pasta ${folder}`, description: data.error, variant: "destructive" });
      } else {
        toast({ title: `${data.deleted} imagens excluídas da pasta "${folder}" em ${data.rounds} rodada(s)` });
      }

      // Remove folder from preview
      if (preview) {
        const updatedFolders = { ...preview.folders };
        delete updatedFolders[folder];
        const removedIds = preview.public_ids.filter(id => {
          const idFolder = id.includes('/') ? id.substring(0, id.lastIndexOf('/')) : '(root)';
          return idFolder !== folder && idFolder !== folderPrefix;
        });
        setPreview({
          ...preview,
          folders: updatedFolders,
          public_ids: removedIds,
          total_resources: removedIds.length,
          total_bytes: Object.values(updatedFolders).reduce((s, f) => s + f.bytes, 0),
        });
        setAccumulatedPreview(null);
      }
    } catch (e: any) {
      toast({ title: "Erro ao excluir pasta", description: e.message, variant: "destructive" });
    } finally {
      setDeletingFolder(null);
    }
  }, [preview, account]);

  const handleCancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Trash2 className="h-4 w-4 text-destructive" />
          Limpeza — {label}
        </CardTitle>
        <CardDescription>
          Visualize e remova imagens do Cloudinary. Três estratégias disponíveis: preview resumável, exclusão por lote e exclusão direta por pasta.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Background Cleanup Queue */}
        {!bgLoading && bgQueue && bgQueue.pending > 0 && (
          <div className="border rounded-lg p-4 bg-muted/20 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-warning animate-pulse" />
                Limpeza em segundo plano
              </h4>
              <Badge variant="outline" className="text-xs">
                Automática (a cada 1h)
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-2 rounded bg-background">
                <p className="text-xs text-muted-foreground">Pendentes</p>
                <p className="text-lg font-bold text-warning">{bgQueue.pending.toLocaleString('pt-BR')}</p>
              </div>
              <div className="text-center p-2 rounded bg-background">
                <p className="text-xs text-muted-foreground">Limpas</p>
                <p className="text-lg font-bold text-primary">{bgQueue.cleaned.toLocaleString('pt-BR')}</p>
              </div>
              <div className="text-center p-2 rounded bg-background">
                <p className="text-xs text-muted-foreground">Com erro</p>
                <p className="text-lg font-bold text-destructive">{bgQueue.errors}</p>
              </div>
            </div>
            {bgQueue.oldest && (
              <p className="text-xs text-muted-foreground">
                Mais antiga na fila: {new Date(bgQueue.oldest).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        )}

        {!bgLoading && bgQueue && bgQueue.pending === 0 && bgQueue.cleaned > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground border rounded-lg p-3 bg-muted/10">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Nenhuma limpeza pendente em segundo plano. {bgQueue.cleaned.toLocaleString('pt-BR')} já processadas.
          </div>
        )}

        {/* Purge Total Button */}
        <div className="border rounded-lg p-4 bg-destructive/5 border-destructive/20 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium flex items-center gap-2 text-sm">
                <Flame className="h-4 w-4 text-destructive" />
                Purge Total — {label}
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                Exclui TODOS os arquivos físicos da conta via Admin API, sem necessidade de preview.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => { setPurgeConfirmOpen(true); setPurgeConfirmInput(""); }}
              disabled={isPurging}
            >
              {isPurging ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Flame className="h-4 w-4 mr-1" />
              )}
              {isPurging ? "Purgando..." : "Purge Total"}
            </Button>
          </div>

          {purgeResult && (
            <div className="flex items-center gap-2 text-sm border rounded-lg p-3 bg-background">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              <span>
                {purgeResult.deleted.toLocaleString('pt-BR')} arquivos excluídos em {purgeResult.rounds} rodada(s).
                {purgeResult.errors && ` (${purgeResult.errors.length} erro(s))`}
              </span>
            </div>
          )}
        </div>

        {/* Purge Confirmation Dialog */}
        <AlertDialog open={purgeConfirmOpen} onOpenChange={setPurgeConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-destructive" />
                Purge Total — {label}
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>
                    Isso vai excluir <strong>TODOS</strong> os arquivos físicos da conta {label} via Admin API.
                    O processo é irreversível e pode levar vários minutos dependendo do volume.
                  </p>
                  <p className="font-medium text-destructive">
                    Esta ação é irreversível!
                  </p>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      Digite <strong>PURGE</strong> para confirmar:
                    </label>
                    <Input
                      value={purgeConfirmInput}
                      onChange={(e) => setPurgeConfirmInput(e.target.value)}
                      placeholder="PURGE"
                      className="font-mono"
                    />
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={purgeConfirmInput !== "PURGE"}
                onClick={(e) => {
                  e.preventDefault();
                  handlePurgeAll();
                }}
              >
                <Flame className="h-4 w-4 mr-1" /> Iniciar Purge
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Filter + Preview button */}
        {!isDeleting && (
          <div className="flex gap-2 flex-wrap items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground mb-1 block">
                Filtrar por prefixo (pasta) — deixe vazio para tudo
              </label>
              <Input
                placeholder="ex: habitae/properties"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                disabled={isLoadingPreview || isResuming}
              />
            </div>
            <Button
              variant="outline"
              onClick={() => handlePreview()}
              disabled={isLoadingPreview || isResuming}
            >
              {isLoadingPreview ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Eye className="h-4 w-4 mr-1" />
              )}
              Visualizar
            </Button>
          </div>
        )}

        {/* Deletion Progress */}
        {(isDeleting || deleteComplete) && (
          <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
            <div className="flex items-center justify-between">
              <h4 className="font-medium flex items-center gap-2">
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin text-destructive" />
                ) : (
                  <Shield className="h-4 w-4 text-primary" />
                )}
                {isDeleting ? "Excluindo imagens..." : "Exclusão concluída"}
              </h4>
              {isDeleting && (
                <Button variant="outline" size="sm" onClick={handleCancel}>
                  <XCircle className="h-4 w-4 mr-1" /> Cancelar
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progresso</span>
                <span className="font-mono font-medium">
                  {deletedCount} excluídas / {deleteTotalAttempted} processadas
                </span>
              </div>
              <Progress value={deleteProgress} className="h-3" />
              <p className="text-xs text-muted-foreground text-right">{deleteProgress}%</p>
            </div>

            {deleteComplete && (
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-2 rounded bg-background">
                  <p className="text-xs text-muted-foreground">Excluídas</p>
                  <p className="text-lg font-bold text-primary">{deletedCount}</p>
                </div>
                <div className="text-center p-2 rounded bg-background">
                  <p className="text-xs text-muted-foreground">Processadas</p>
                  <p className="text-lg font-bold">{deleteTotalAttempted}</p>
                </div>
                <div className="text-center p-2 rounded bg-background">
                  <p className="text-xs text-muted-foreground">Erros</p>
                  <p className="text-lg font-bold text-destructive">{deleteErrors.length}</p>
                </div>
              </div>
            )}

            {deleteErrors.length > 0 && (
              <div className="text-sm space-y-1 max-h-32 overflow-auto">
                <p className="font-medium text-destructive">Erros:</p>
                {deleteErrors.map((err, i) => (
                  <p key={i} className="text-xs font-mono text-muted-foreground">{err}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Folder delete result */}
        {folderDeleteResult && (
          <div className="flex items-center gap-2 text-sm border rounded-lg p-3 bg-muted/10">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Pasta "{folderDeleteResult.folder}": {folderDeleteResult.deleted} imagens excluídas em {folderDeleteResult.rounds} rodada(s).
          </div>
        )}

        {/* Preview Results */}
        {preview && !isDeleting && (
          <div className="space-y-4 border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Preview — O que será excluído
              </h4>
              <Badge variant="destructive">{preview.total_resources.toLocaleString("pt-BR")} imagens</Badge>
            </div>

            {/* SOLUTION 1: Resumable cursor button */}
            {preview.truncated && preview.next_cursor && (
              <div className="flex items-center gap-2 text-sm text-warning border border-warning/30 rounded-lg p-3 bg-warning/5">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <div className="flex-1">
                  <span>Resultados parciais — listagem interrompida por timeout. </span>
                  <span className="font-medium">{preview.total_resources.toLocaleString("pt-BR")} encontradas até agora.</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePreview(preview.next_cursor!)}
                  disabled={isResuming}
                >
                  {isResuming ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <Zap className="h-3.5 w-3.5 mr-1" />
                  )}
                  Continuar listagem
                </Button>
              </div>
            )}

            {preview.truncated && !preview.next_cursor && (
              <div className="flex items-center gap-2 text-sm text-warning border border-warning/30 rounded-lg p-3 bg-warning/5">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Resultados parciais — use um prefixo de pasta para filtrar menos recursos.</span>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center p-2 rounded bg-muted/50">
                <p className="text-xs text-muted-foreground">Total de Imagens</p>
                <p className="text-lg font-bold">{preview.total_resources.toLocaleString("pt-BR")}</p>
              </div>
              <div className="text-center p-2 rounded bg-muted/50">
                <p className="text-xs text-muted-foreground">Espaço a liberar</p>
                <p className="text-lg font-bold">{formatBytes(preview.total_bytes)}</p>
              </div>
              <div className="text-center p-2 rounded bg-muted/50">
                <p className="text-xs text-muted-foreground">Mais antiga</p>
                <p className="text-sm font-medium">
                  {preview.oldest ? new Date(preview.oldest).toLocaleDateString("pt-BR") : "—"}
                </p>
              </div>
              <div className="text-center p-2 rounded bg-muted/50">
                <p className="text-xs text-muted-foreground">Pastas</p>
                <p className="text-lg font-bold">{Object.keys(preview.folders).length}</p>
              </div>
            </div>

            {/* SOLUTION 3: Folder breakdown with per-folder delete */}
            {Object.keys(preview.folders).length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead><FolderOpen className="h-3.5 w-3.5 inline mr-1" />Pasta</TableHead>
                    <TableHead className="text-right">Imagens</TableHead>
                    <TableHead className="text-right">Tamanho</TableHead>
                    <TableHead className="w-32">%</TableHead>
                    <TableHead className="w-24 text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(preview.folders)
                    .sort(([, a], [, b]) => b.bytes - a.bytes)
                    .map(([folder, stats]) => {
                      const pct = preview.total_bytes > 0
                        ? Math.round((stats.bytes / preview.total_bytes) * 100) : 0;
                      return (
                        <TableRow key={folder}>
                          <TableCell className="font-mono text-sm">{folder}</TableCell>
                          <TableCell className="text-right">{stats.count.toLocaleString("pt-BR")}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{formatBytes(stats.bytes)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={pct} className="h-2 flex-1" />
                              <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteFolder(folder)}
                              disabled={deletingFolder === folder || folder === '(root)'}
                              title={folder === '(root)' ? 'Use prefixo no filtro' : `Excluir pasta ${folder}`}
                            >
                              {deletingFolder === folder ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <FolderX className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            )}

            {/* SOLUTION 2: Full batch delete button */}
            <div className="flex justify-between items-center pt-2 border-t gap-2 flex-wrap">
              <p className="text-xs text-muted-foreground">
                💡 Dica: Clique em <FolderX className="h-3 w-3 inline" /> para excluir uma pasta inteira sem listar (mais rápido).
              </p>
              <Button
                variant="destructive"
                onClick={() => { setConfirmOpen(true); setConfirmInput(""); }}
                disabled={preview.total_resources === 0}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Excluir todas ({preview.total_resources.toLocaleString("pt-BR")} imagens)
              </Button>
            </div>
          </div>
        )}

        {/* Confirmation Dialog */}
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Confirmar exclusão em massa
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>
                    Você está prestes a excluir permanentemente{" "}
                    <strong>{preview?.total_resources.toLocaleString("pt-BR")} imagens</strong>{" "}
                    ({formatBytes(preview?.total_bytes || 0)}) do Cloudinary em{" "}
                    <strong>{Math.ceil((preview?.total_resources || 0) / BATCH_SIZE)} lotes</strong>.
                  </p>
                  {preview?.truncated && (
                    <p className="text-warning text-sm">
                      ⚠️ A listagem foi parcial. Apenas as imagens listadas serão excluídas. 
                      Para excluir tudo, use "Continuar listagem" ou exclua por pasta.
                    </p>
                  )}
                  <p className="font-medium text-destructive">
                    Esta ação é irreversível. Você pode cancelar durante a execução.
                  </p>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      Digite <strong>{CONFIRM_PHRASE}</strong> para confirmar:
                    </label>
                    <Input
                      value={confirmInput}
                      onChange={(e) => setConfirmInput(e.target.value)}
                      placeholder={CONFIRM_PHRASE}
                      className="font-mono"
                    />
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={confirmInput !== CONFIRM_PHRASE}
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete();
                }}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Iniciar exclusão
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
