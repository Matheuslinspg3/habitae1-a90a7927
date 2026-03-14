import { useState, useRef } from 'react';
import { useLeadDocuments } from '@/hooks/useLeadDocuments';
import { useUserRoles } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
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
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

const OPERATION_TYPES = [
  { value: 'compra_financiada', label: 'Compra Financiada' },
  { value: 'compra_vista', label: 'Compra à Vista' },
  { value: 'locacao', label: 'Locação' },
  { value: 'permuta', label: 'Permuta' },
];

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
  const { toast } = useToast();

  const [operationType, setOperationType] = useState<string>('');
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectDocId, setRejectDocId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const [viewMimeType, setViewMimeType] = useState<string>('');
  const [avulsoName, setAvulsoName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avulsoFileRef = useRef<HTMLInputElement>(null);
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);

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

  const progressColorClass = progressPercent >= 80
    ? 'text-success'
    : progressPercent >= 40
      ? 'text-warning'
      : 'text-destructive';

  // Avulso docs (no template_item_id)
  const avulsoDocs = documents.filter((d: any) => !d.template_item_id);

  const handleFileUpload = async (file: File, templateItemId: string | null, maxSizeMb?: number, acceptedFormats?: string[]) => {
    if (maxSizeMb && file.size > maxSizeMb * 1024 * 1024) {
      toast({ title: 'Arquivo muito grande', description: `Máximo: ${maxSizeMb}MB`, variant: 'destructive' });
      return;
    }
    if (acceptedFormats && acceptedFormats.length > 0) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext && !acceptedFormats.includes(ext)) {
        toast({ title: 'Formato inválido', description: `Formatos aceitos: ${acceptedFormats.join(', ')}`, variant: 'destructive' });
        return;
      }
    }
    setUploadingItemId(templateItemId);
    await uploadDocument.mutateAsync({ file, templateItemId });
    setUploadingItemId(null);
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
      toast({ title: 'Erro ao abrir documento', variant: 'destructive' });
    }
  };

  const handleReject = (docId: string) => {
    setRejectDocId(docId);
    setRejectReason('');
    setRejectDialogOpen(true);
  };

  const confirmReject = async () => {
    if (!rejectDocId || !rejectReason.trim()) return;
    await reviewDocument.mutateAsync({ documentId: rejectDocId, status: 'rejected', rejectionReason: rejectReason });
    setRejectDialogOpen(false);
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'approved': return { icon: CheckCircle2, label: 'Aprovado', className: 'bg-success/15 text-success border-success/30' };
      case 'rejected': return { icon: XCircle, label: 'Rejeitado', className: 'bg-destructive/15 text-destructive border-destructive/30' };
      case 'received': return { icon: Paperclip, label: 'Recebido', className: 'bg-info/15 text-info border-info/30' };
      default: return { icon: Clock, label: 'Pendente', className: 'bg-muted text-muted-foreground border-border' };
    }
  };

  if (isLoadingTemplates || isLoadingDocs) {
    return (
      <div className="space-y-3 py-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 py-2">
      {/* Operation type selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Tipo de operação</label>
        <Select value={operationType} onValueChange={setOperationType}>
          <SelectTrigger>
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
        <div className="text-center py-6 space-y-3">
          <FileText className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhum template de documentos encontrado.</p>
          {isAdminOrAbove && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => createDefaultTemplates.mutate()}
              disabled={createDefaultTemplates.isPending}
              className="gap-1.5"
            >
              <FolderPlus className="h-4 w-4" />
              {createDefaultTemplates.isPending ? 'Criando...' : 'Criar templates padrão'}
            </Button>
          )}
        </div>
      )}

      {activeTemplate && sortedItems.length > 0 && (
        <>
          {/* Progress bar */}
          <div className="space-y-1.5">
            <p className={`text-xs font-medium ${progressColorClass}`}>
              {completedRequired.length} de {requiredItems.length} documentos obrigatórios — {progressPercent}%
            </p>
            <Progress value={progressPercent} className="h-2" />
          </div>

          {/* Checklist */}
          <div className="space-y-2">
            {sortedItems.map((item) => {
              const doc = documents.find((d: any) => d.template_item_id === item.id);
              const statusConfig = doc ? getStatusConfig(doc.status) : getStatusConfig('pending');
              const StatusIcon = statusConfig.icon;
              const aiValidation = doc?.ai_validation as any;

              return (
                <div key={item.id} className="border border-border rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <StatusIcon className="h-4 w-4 shrink-0" />
                      <span className="text-sm font-medium truncate">{item.name}</span>
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${item.is_required ? 'bg-destructive/10 text-destructive border-destructive/30' : ''}`}>
                        {item.is_required ? 'Obrigatório' : 'Opcional'}
                      </Badge>
                    </div>
                  </div>

                  {doc && doc.status === 'rejected' && doc.rejection_reason && (
                    <p className="text-xs text-destructive pl-6">❌ {doc.rejection_reason}</p>
                  )}

                  {/* AI Validation Badge */}
                  {doc && aiValidation && (
                    <div className="pl-6">
                      {aiValidation.valid ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-success">
                          <ShieldCheck className="h-3 w-3" />
                          IA identificou: {aiValidation.detected_type} ({Math.round(aiValidation.confidence * 100)}%)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-warning">
                          <AlertTriangle className="h-3 w-3" />
                          Verifique manualmente
                        </span>
                      )}
                    </div>
                  )}

                  {/* Actions row */}
                  <div className="flex items-center gap-1.5 pl-6 flex-wrap">
                    {(!doc || doc.status === 'pending' || doc.status === 'rejected') && (
                      <>
                        <input
                          type="file"
                          className="hidden"
                          ref={fileInputRef}
                          accept={item.accepted_formats?.map((f: string) => `.${f}`).join(',') || '*'}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(file, item.id, item.max_size_mb, item.accepted_formats);
                            e.target.value = '';
                          }}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          disabled={uploadingItemId === item.id}
                          onClick={() => {
                            // Create new file input each time to avoid stale refs
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = item.accepted_formats?.map((f: string) => `.${f}`).join(',') || '*';
                            input.onchange = (e) => {
                              const file = (e.target as HTMLInputElement).files?.[0];
                              if (file) handleFileUpload(file, item.id, item.max_size_mb, item.accepted_formats);
                            };
                            input.click();
                          }}
                        >
                          <Upload className="h-3 w-3" />
                          {uploadingItemId === item.id ? 'Enviando...' : 'Enviar'}
                        </Button>
                      </>
                    )}

                    {doc && (doc.status === 'received' || doc.status === 'approved') && (
                      <>
                        <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                          {doc.file_name}
                        </span>
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => handleView(doc)}>
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = item.accepted_formats?.map((f: string) => `.${f}`).join(',') || '*';
                            input.onchange = (e) => {
                              const file = (e.target as HTMLInputElement).files?.[0];
                              if (file) handleFileUpload(file, item.id, item.max_size_mb, item.accepted_formats);
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
                          className="h-7 text-xs gap-1 text-success border-success/30"
                          onClick={() => reviewDocument.mutate({ documentId: doc.id, status: 'approved' })}
                        >
                          <CheckCircle2 className="h-3 w-3" /> Aprovar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1 text-destructive border-destructive/30"
                          onClick={() => handleReject(doc.id)}
                        >
                          <XCircle className="h-3 w-3" /> Rejeitar
                        </Button>
                      </>
                    )}

                    {doc && isAdminOrAbove && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-destructive"
                        onClick={() => deleteDocument.mutate({ id: doc.id, storage_path: doc.storage_path })}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>

                  {doc && (
                    <p className="text-[10px] text-muted-foreground pl-6">
                      Enviado {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <Separator />

      {/* Avulso documents */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">Documentos avulsos</h4>

        {avulsoDocs.map((doc: any) => {
          const statusConfig = getStatusConfig(doc.status);
          const StatusIcon = statusConfig.icon;
          return (
            <div key={doc.id} className="flex items-center gap-2 border border-border rounded-lg p-2">
              <StatusIcon className="h-4 w-4 shrink-0" />
              <span className="text-xs font-medium truncate flex-1">{doc.file_name}</span>
              {doc.notes && <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">{doc.notes}</span>}
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleView(doc)}>
                <Eye className="h-3 w-3" />
              </Button>
              {isAdminOrAbove && doc.status === 'received' && (
                <>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-success" onClick={() => reviewDocument.mutate({ documentId: doc.id, status: 'approved' })}>
                    <CheckCircle2 className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => handleReject(doc.id)}>
                    <XCircle className="h-3 w-3" />
                  </Button>
                </>
              )}
              {isAdminOrAbove && (
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => deleteDocument.mutate({ id: doc.id, storage_path: doc.storage_path })}>
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
            className="text-xs h-8"
          />
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-1 h-8"
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
          >
            <Plus className="h-3 w-3" />
            Enviar
          </Button>
        </div>
      </div>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar documento</DialogTitle>
            <DialogDescription>Informe o motivo da rejeição.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Motivo da rejeição..."
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || reviewDocument.isPending}
              onClick={confirmReject}
            >
              Rejeitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Visualizar Documento</DialogTitle>
          </DialogHeader>
          {viewUrl && viewMimeType === 'image' && (
            <img src={viewUrl} alt="Documento" className="w-full rounded-lg" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
