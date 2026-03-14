import { useState, useRef, useCallback } from 'react';
import { useLeadDocuments } from '@/hooks/useLeadDocuments';
import { useUserRoles } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Paperclip,
  Upload,
  Eye,
  RefreshCw,
  Trash2,
  FileText,
  FolderPlus,
  ShieldCheck,
  AlertTriangle,
  Plus,
  ChevronDown,
  File,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const OPERATION_TYPES = [
  { value: 'compra_financiada', label: 'Compra Financiada' },
  { value: 'compra_vista', label: 'Compra à Vista' },
  { value: 'locacao', label: 'Locação' },
  { value: 'permuta', label: 'Permuta' },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FilePreview({ file }: { file: File }) {
  const isImage = file.type.startsWith('image/');
  const [previewUrl] = useState(() => isImage ? URL.createObjectURL(file) : null);

  return (
    <div className="flex items-center gap-2 p-2 border rounded-lg bg-muted/30 text-xs">
      {isImage && previewUrl ? (
        <img src={previewUrl} alt="Preview" className="h-8 w-8 rounded object-cover shrink-0" />
      ) : (
        <File className="h-4 w-4 text-muted-foreground shrink-0" />
      )}
      <span className="truncate flex-1">{file.name}</span>
      <span className="text-muted-foreground shrink-0">{formatFileSize(file.size)}</span>
    </div>
  );
}

interface LeadDocumentsTabProps {
  leadId: string;
}

export function LeadDocumentsTab({ leadId }: LeadDocumentsTabProps) {
  const {
    templates,
    documents,
    isLoadingTemplates,
    isLoadingDocs,
    uploadDocument,
    reviewDocument,
    deleteDocument,
    createDefaultTemplates,
    getDocumentUrl,
  } = useLeadDocuments(leadId);
  const { isAdminOrAbove } = useUserRoles();

  const [operationType, setOperationType] = useState<string>('');
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectDocId, setRejectDocId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [replaceConfirmDocId, setReplaceConfirmDocId] = useState<string | null>(null);
  const [pendingReplaceFile, setPendingReplaceFile] = useState<{ file: File; itemId: string; maxSize?: number; formats?: string[] } | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [viewMimeType, setViewMimeType] = useState<string>('');
  const [avulsoName, setAvulsoName] = useState('');
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [avulsoOpen, setAvulsoOpen] = useState(false);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{ file: File; itemId: string | null } | null>(null);

  const activeTemplate = templates.find((t: any) => t.operation_type === operationType);
  const templateItems: any[] = activeTemplate?.lead_document_template_items || [];
  const sortedItems = [...templateItems].sort((a, b) => a.position - b.position);

  // Calculate progress
  const requiredItems = sortedItems.filter((i) => i.is_required);
  const completedRequired = requiredItems.filter((item) => {
    const doc = documents.find((d: any) => d.template_item_id === item.id);
    return doc && (doc.status === 'received' || doc.status === 'approved');
  });
  const progressPercent = requiredItems.length > 0
    ? Math.round((completedRequired.length / requiredItems.length) * 100)
    : 0;

  // Avulso docs (no template_item_id)
  const avulsoDocs = documents.filter((d: any) => !d.template_item_id);

  const handleFileUpload = async (file: File, templateItemId: string | null, maxSizeMb?: number, acceptedFormats?: string[]) => {
    if (maxSizeMb && file.size > maxSizeMb * 1024 * 1024) {
      toast.error(`Arquivo muito grande. Máximo: ${maxSizeMb}MB`);
      return;
    }
    if (acceptedFormats && acceptedFormats.length > 0) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext && !acceptedFormats.includes(ext)) {
        toast.error(`Formato inválido. Aceitos: ${acceptedFormats.join(', ')}`);
        return;
      }
    }

    setUploadingItemId(templateItemId);
    setUploadProgress((prev) => ({ ...prev, [templateItemId || 'avulso']: 0 }));

    // Simulate progress
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        const current = prev[templateItemId || 'avulso'] || 0;
        if (current >= 90) return prev;
        return { ...prev, [templateItemId || 'avulso']: current + 10 };
      });
    }, 200);

    try {
      await uploadDocument.mutateAsync({ file, templateItemId });
      setUploadProgress((prev) => ({ ...prev, [templateItemId || 'avulso']: 100 }));
      toast.success('Documento enviado com sucesso!');
    } catch {
      toast.error('Não foi possível enviar o documento. Tente novamente.');
    } finally {
      clearInterval(progressInterval);
      setUploadingItemId(null);
      setPreviewFile(null);
      setTimeout(() => {
        setUploadProgress((prev) => {
          const next = { ...prev };
          delete next[templateItemId || 'avulso'];
          return next;
        });
      }, 1000);
    }
  };

  const handleReplaceAttempt = (file: File, itemId: string, doc: any, maxSizeMb?: number, acceptedFormats?: string[]) => {
    if (doc && (doc.status === 'approved')) {
      // Confirm before replacing approved doc
      setPendingReplaceFile({ file, itemId, maxSize: maxSizeMb, formats: acceptedFormats });
      setReplaceConfirmDocId(doc.id);
    } else {
      handleFileUpload(file, itemId, maxSizeMb, acceptedFormats);
    }
  };

  const confirmReplace = () => {
    if (pendingReplaceFile) {
      handleFileUpload(pendingReplaceFile.file, pendingReplaceFile.itemId, pendingReplaceFile.maxSize, pendingReplaceFile.formats);
    }
    setReplaceConfirmDocId(null);
    setPendingReplaceFile(null);
  };

  const handleView = async (doc: any) => {
    try {
      const url = await getDocumentUrl(doc.storage_path);
      if (doc.mime_type?.startsWith('image/')) {
        setViewMimeType('image');
        setViewUrl(url);
        setViewDialogOpen(true);
      } else {
        window.open(url, '_blank');
      }
    } catch {
      toast.error('Não foi possível abrir o documento.');
    }
  };

  const handleReject = (docId: string) => {
    setRejectDocId(docId);
    setRejectReason('');
    setRejectDialogOpen(true);
  };

  const confirmReject = async () => {
    if (!rejectDocId || !rejectReason.trim()) return;
    try {
      await reviewDocument.mutateAsync({ documentId: rejectDocId, status: 'rejected', rejectionReason: rejectReason });
      toast.success('Documento rejeitado.');
    } catch {
      toast.error('Erro ao rejeitar documento.');
    }
    setRejectDialogOpen(false);
  };

  const handleDrop = useCallback((e: React.DragEvent, itemId: string, maxSizeMb?: number, acceptedFormats?: string[], doc?: any) => {
    e.preventDefault();
    setDragOverItemId(null);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (doc && (doc.status === 'approved' || doc.status === 'received')) {
      handleReplaceAttempt(file, itemId, doc, maxSizeMb, acceptedFormats);
    } else {
      handleFileUpload(file, itemId, maxSizeMb, acceptedFormats);
    }
  }, []);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'approved': return { icon: CheckCircle2, label: 'Aprovado', variant: 'default' as const };
      case 'rejected': return { icon: XCircle, label: 'Rejeitado', variant: 'destructive' as const };
      case 'received': return { icon: Paperclip, label: 'Recebido', variant: 'secondary' as const };
      default: return { icon: Clock, label: 'Pendente', variant: 'outline' as const };
    }
  };

  if (isLoadingTemplates || isLoadingDocs) {
    return (
      <div className="space-y-3 py-2">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-2 w-full rounded" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4 py-2">
      {/* Operation type selector */}
      <div className="space-y-2">
        <Label htmlFor="operation-type-select">Tipo de operação</Label>
        <Select value={operationType} onValueChange={setOperationType}>
          <SelectTrigger id="operation-type-select">
            <SelectValue placeholder="Selecione o tipo..." />
          </SelectTrigger>
          <SelectContent>
            {OPERATION_TYPES.map((op) => (
              <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {operationType && !activeTemplate && (
        <div className="flex flex-col items-center justify-center py-8 text-center border rounded-lg bg-muted/30">
          <FolderPlus className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <h3 className="text-sm font-medium text-muted-foreground">Nenhum template de documentos encontrado</h3>
          <p className="text-xs text-muted-foreground mt-1 mb-3">
            Crie um template para organizar os documentos necessários desta operação.
          </p>
          {isAdminOrAbove && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => createDefaultTemplates.mutate()}
              disabled={createDefaultTemplates.isPending}
              className="gap-1.5 h-9"
            >
              {createDefaultTemplates.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FolderPlus className="h-4 w-4" />
              )}
              {createDefaultTemplates.isPending ? 'Criando...' : 'Criar templates padrão'}
            </Button>
          )}
        </div>
      )}

      {activeTemplate && sortedItems.length > 0 && (
        <>
          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">
                {completedRequired.length} de {requiredItems.length} obrigatórios
              </p>
              <Badge variant={progressPercent >= 100 ? "default" : progressPercent >= 50 ? "secondary" : "outline"} className="text-xs">
                {progressPercent}%
              </Badge>
            </div>
            <Progress value={progressPercent} className="h-2 transition-all duration-500" />
          </div>

          {/* Checklist */}
          <div className="space-y-2">
            {sortedItems.map((item) => {
              const doc = documents.find((d: any) => d.template_item_id === item.id);
              const statusConfig = doc ? getStatusConfig(doc.status) : getStatusConfig('pending');
              const StatusIcon = statusConfig.icon;
              const aiValidation = doc?.ai_validation as any;
              const isRejected = doc?.status === 'rejected';
              const uploadProg = uploadProgress[item.id];
              const isDragOver = dragOverItemId === item.id;

              return (
                <div
                  key={item.id}
                  className={cn(
                    "border rounded-lg p-3 space-y-2 transition-colors",
                    isRejected && "border-destructive/50 bg-destructive/5",
                    isDragOver && "border-primary bg-primary/5"
                  )}
                  onDragOver={(e) => { e.preventDefault(); setDragOverItemId(item.id); }}
                  onDragLeave={() => setDragOverItemId(null)}
                  onDrop={(e) => handleDrop(e, item.id, item.max_size_mb, item.accepted_formats, doc)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <StatusIcon className="h-4 w-4 shrink-0" />
                      <span className="text-sm font-medium truncate">{item.name}</span>
                      <Badge variant={statusConfig.variant} className="text-[10px] shrink-0">
                        {doc ? statusConfig.label : item.is_required ? 'Obrigatório' : 'Opcional'}
                      </Badge>
                    </div>
                  </div>

                  {/* Rejection reason - prominent */}
                  {isRejected && doc.rejection_reason && (
                    <div className="flex items-start gap-2 pl-6 text-xs text-destructive bg-destructive/10 rounded p-2">
                      <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>{doc.rejection_reason}</span>
                    </div>
                  )}

                  {/* AI Validation Badge */}
                  {doc && aiValidation && (
                    <div className="pl-6">
                      {aiValidation.valid ? (
                        <Badge
                          variant={aiValidation.confidence < 0.6 ? "secondary" : "outline"}
                          className={cn(
                            "gap-1 text-[10px]",
                            aiValidation.confidence < 0.6 && "border-warning text-warning"
                          )}
                        >
                          {aiValidation.confidence < 0.6 ? (
                            <AlertTriangle className="h-3 w-3" />
                          ) : (
                            <ShieldCheck className="h-3 w-3" />
                          )}
                          IA: {aiValidation.detected_type} ({Math.round(aiValidation.confidence * 100)}%)
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1 text-[10px] border-warning text-warning">
                          <AlertTriangle className="h-3 w-3" />
                          Verifique manualmente
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Upload progress bar inline */}
                  {uploadProg !== undefined && (
                    <div className="pl-6">
                      <Progress value={uploadProg} className="h-1.5 transition-all duration-300" />
                    </div>
                  )}

                  {/* File preview before upload */}
                  {previewFile && previewFile.itemId === item.id && (
                    <div className="pl-6">
                      <FilePreview file={previewFile.file} />
                    </div>
                  )}

                  {/* Actions row */}
                  <div className="flex items-center gap-1.5 pl-6 flex-wrap">
                    {(!doc || doc.status === 'pending' || doc.status === 'rejected') && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1"
                        disabled={uploadingItemId === item.id}
                        aria-label={`Enviar documento ${item.name}`}
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = item.accepted_formats?.map((f: string) => `.${f}`).join(',') || '*';
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) {
                              setPreviewFile({ file, itemId: item.id });
                              handleFileUpload(file, item.id, item.max_size_mb, item.accepted_formats);
                            }
                          };
                          input.click();
                        }}
                      >
                        {uploadingItemId === item.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Upload className="h-3 w-3" />
                        )}
                        {uploadingItemId === item.id ? 'Enviando...' : 'Enviar'}
                      </Button>
                    )}

                    {doc && (doc.status === 'received' || doc.status === 'approved') && (
                      <>
                        <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                          {doc.file_name}
                        </span>
                        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={() => handleView(doc)} aria-label="Visualizar documento">
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs gap-1"
                          aria-label="Substituir documento"
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = item.accepted_formats?.map((f: string) => `.${f}`).join(',') || '*';
                            input.onchange = (e) => {
                              const file = (e.target as HTMLInputElement).files?.[0];
                              if (file) handleReplaceAttempt(file, item.id, doc, item.max_size_mb, item.accepted_formats);
                            };
                            input.click();
                          }}
                        >
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                      </>
                    )}

                    {doc && doc.status === 'received' && isAdminOrAbove && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1"
                          onClick={() => reviewDocument.mutate({ documentId: doc.id, status: 'approved' })}
                          aria-label="Aprovar documento"
                        >
                          <CheckCircle2 className="h-3 w-3" /> Aprovar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1 text-destructive"
                          onClick={() => handleReject(doc.id)}
                          aria-label="Rejeitar documento"
                        >
                          <XCircle className="h-3 w-3" /> Rejeitar
                        </Button>
                      </>
                    )}

                    {doc && isAdminOrAbove && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-destructive"
                        onClick={() => deleteDocument.mutate({ id: doc.id, storage_path: doc.storage_path })}
                        aria-label="Excluir documento"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>

                  {/* Drag hint */}
                  {(!doc || doc.status === 'pending' || doc.status === 'rejected') && !isDragOver && (
                    <p className="text-[10px] text-muted-foreground pl-6">
                      Arraste um arquivo aqui ou clique em Enviar
                    </p>
                  )}
                  {isDragOver && (
                    <p className="text-[10px] text-primary pl-6 font-medium">
                      Solte o arquivo aqui
                    </p>
                  )}

                  {doc && (
                    <p className="text-[10px] text-muted-foreground pl-6">
                      Enviado {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true, locale: ptBR })}
                      {doc.file_size_bytes ? ` · ${formatFileSize(doc.file_size_bytes)}` : ''}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <Separator />

      {/* Avulso documents - collapsed by default */}
      <Collapsible open={avulsoOpen} onOpenChange={setAvulsoOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between h-10 px-2 text-sm font-medium text-muted-foreground">
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Documentos avulsos
              {avulsoDocs.length > 0 && (
                <Badge variant="secondary" className="text-[10px]">{avulsoDocs.length}</Badge>
              )}
            </span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", avulsoOpen && "rotate-180")} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2">
          {avulsoDocs.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhum documento avulso enviado.</p>
          )}

          {avulsoDocs.map((doc: any) => {
            const statusConfig = getStatusConfig(doc.status);
            const StatusIcon = statusConfig.icon;
            return (
              <div key={doc.id} className="flex items-center gap-2 border rounded-lg p-2">
                <StatusIcon className="h-4 w-4 shrink-0" />
                <span className="text-xs font-medium truncate flex-1">{doc.file_name}</span>
                {doc.notes && <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">{doc.notes}</span>}
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleView(doc)} aria-label="Visualizar documento avulso">
                  <Eye className="h-3 w-3" />
                </Button>
                {isAdminOrAbove && doc.status === 'received' && (
                  <>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => reviewDocument.mutate({ documentId: doc.id, status: 'approved' })} aria-label="Aprovar">
                      <CheckCircle2 className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => handleReject(doc.id)} aria-label="Rejeitar">
                      <XCircle className="h-3 w-3" />
                    </Button>
                  </>
                )}
                {isAdminOrAbove && (
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteDocument.mutate({ id: doc.id, storage_path: doc.storage_path })} aria-label="Excluir documento avulso">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            );
          })}

          <div className="flex gap-2">
            <Input
              placeholder="Nome do documento (opcional)"
              value={avulsoName}
              onChange={(e) => setAvulsoName(e.target.value)}
              className="text-xs h-9"
              aria-label="Nome do documento avulso"
            />
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1 h-9"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.pdf,.jpg,.jpeg,.png';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) {
                    uploadDocument.mutate({ file, templateItemId: null, notes: avulsoName || undefined });
                    setAvulsoName('');
                  }
                };
                input.click();
              }}
              disabled={uploadDocument.isPending}
              aria-label="Enviar documento avulso"
            >
              {uploadDocument.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Plus className="h-3 w-3" />
              )}
              Enviar
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="w-full sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rejeitar documento</DialogTitle>
            <DialogDescription>Informe o motivo da rejeição para o corretor.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Motivo da rejeição..."
            rows={3}
            aria-label="Motivo da rejeição"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || reviewDocument.isPending}
              onClick={confirmReject}
            >
              {reviewDocument.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Rejeitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Replace Confirm Dialog */}
      <Dialog open={!!replaceConfirmDocId} onOpenChange={() => { setReplaceConfirmDocId(null); setPendingReplaceFile(null); }}>
        <DialogContent className="w-full sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Substituir documento aprovado?</DialogTitle>
            <DialogDescription>
              Este documento já foi aprovado. Ao substituí-lo, ele precisará ser revisado novamente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReplaceConfirmDocId(null); setPendingReplaceFile(null); }}>
              Cancelar
            </Button>
            <Button onClick={confirmReplace}>
              Substituir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="w-full sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Visualizar Documento</DialogTitle>
          </DialogHeader>
          {viewUrl && viewMimeType === 'image' && (
            <img src={viewUrl} alt="Documento visualizado" className="w-full rounded-lg" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
