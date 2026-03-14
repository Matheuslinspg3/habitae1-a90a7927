import { useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Phone,
  Mail,
  Home,
  User,
  UserPlus,
  Calendar,
  DollarSign,
  MapPin,
  FileText,
  Pencil,
  Trash2,
  XCircle,
  Building2,
  BedDouble,
  Ruler,
  Clock,
  Flame,
  Snowflake,
  Sun,
  Zap,
  Thermometer,
  FolderOpen,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LEAD_SOURCES, type Lead } from '@/hooks/useLeads';
import type { LeadStage } from '@/hooks/useLeadStages';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { LeadInteractionTimeline } from './LeadInteractionTimeline';
import { LeadSuggestedProperties } from './LeadSuggestedProperties';
import { LeadScoreSection } from './LeadScoreSection';
import { LeadDocumentsTab } from './LeadDocumentsTab';
import { useActivityLogger } from '@/hooks/useActivityLogger';

interface LeadDetailsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  leadStages: LeadStage[];
  onEdit: () => void;
  onDelete: () => void;
  onInactivate?: () => void;
  onAssign?: () => void;
  isDeleting?: boolean;
  isInactivating?: boolean;
}

function formatCurrency(value: number | null | undefined) {
  if (!value) return 'Não informado';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function getSourceLabel(sourceId: string | null | undefined) {
  if (!sourceId) return null;
  const source = LEAD_SOURCES.find((s) => s.id === sourceId);
  return source?.label || sourceId;
}

export function LeadDetails({
  open,
  onOpenChange,
  lead,
  leadStages,
  onEdit,
  onDelete,
  onInactivate,
  onAssign,
  isDeleting,
  isInactivating,
}: LeadDetailsProps) {
  const { logActivity } = useActivityLogger();

  useEffect(() => {
    if (open && lead) {
      logActivity({
        actionType: 'viewed',
        entityType: 'lead',
        entityId: lead.id,
        entityName: lead.name,
      });
    }
  }, [open, lead?.id]);

  if (!lead) return null;

  const stage = leadStages.find(s => s.id === lead.lead_stage_id);
  const sourceLabel = getSourceLabel(lead.source);
  const leadAny = lead as any;
  const daysSinceUpdate = formatDistanceToNow(new Date(lead.updated_at), { locale: ptBR, addSuffix: true });

  const TEMP_MAP: Record<string, { icon: typeof Flame; label: string; badgeClass: string }> = {
    frio: { icon: Snowflake, label: 'Frio', badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' },
    morno: { icon: Sun, label: 'Morno', badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' },
    quente: { icon: Flame, label: 'Quente', badgeClass: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300' },
    prioridade: { icon: Zap, label: 'Prioridade', badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' },
  };
  const tempInfo = lead.temperature ? TEMP_MAP[lead.temperature] : null;
  const TempIcon = tempInfo?.icon;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto p-4 sm:p-6">
        <SheetHeader>
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle className="text-xl">{lead.name}</SheetTitle>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {stage && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                    {stage.name}
                  </Badge>
                )}
                {tempInfo && TempIcon && (
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${tempInfo.badgeClass}`}>
                    <TempIcon className="h-3 w-3" />
                    {tempInfo.label}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>Atualizado {daysSinceUpdate}</span>
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Contact Info */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Contato</h3>
            <div className="space-y-2">
              {lead.phone ? (
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${lead.phone}`} className="text-sm hover:underline">{lead.phone}</a>
                </div>
              ) : (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span className="text-sm">Não informado</span>
                </div>
              )}
              {lead.email ? (
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${lead.email}`} className="text-sm hover:underline">{lead.email}</a>
                </div>
              ) : (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span className="text-sm">Não informado</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Details */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Detalhes</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{formatCurrency(lead.estimated_value)}</span>
              </div>
              {sourceLabel && (
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Origem: {sourceLabel}</span>
                </div>
              )}
              {lead.interested_property_type && (
                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Tipo de Imóvel: {lead.interested_property_type.name}</span>
                </div>
              )}
              {lead.property && (
                <div className="flex items-center gap-3">
                  <Home className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Imóvel: {lead.property.title}</span>
                </div>
              )}
              {lead.broker && (
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Corretor: {lead.broker.full_name}</span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  Criado em {format(new Date(lead.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </span>
              </div>
            </div>
          </div>

          {/* Interest Criteria */}
          {(leadAny.transaction_interest || leadAny.min_bedrooms || leadAny.max_area || 
            (leadAny.preferred_neighborhoods && leadAny.preferred_neighborhoods.length > 0) ||
            (leadAny.preferred_cities && leadAny.preferred_cities.length > 0) ||
            leadAny.additional_requirements) && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">Critérios de Interesse</h3>
                <div className="space-y-2">
                  {leadAny.transaction_interest && (
                    <div className="flex items-center gap-3">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {leadAny.transaction_interest === 'venda' ? 'Compra' : leadAny.transaction_interest === 'aluguel' ? 'Aluguel' : 'Compra ou Aluguel'}
                      </span>
                    </div>
                  )}
                  {(leadAny.min_bedrooms || leadAny.max_bedrooms) && (
                    <div className="flex items-center gap-3">
                      <BedDouble className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        Quartos: {leadAny.min_bedrooms || '?'} – {leadAny.max_bedrooms || '?'}
                      </span>
                    </div>
                  )}
                  {(leadAny.min_area || leadAny.max_area) && (
                    <div className="flex items-center gap-3">
                      <Ruler className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        Área: {leadAny.min_area || '?'} – {leadAny.max_area || '?'} m²
                      </span>
                    </div>
                  )}
                  {leadAny.preferred_neighborhoods?.length > 0 && (
                    <div className="flex items-start gap-3">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <span className="text-sm">Bairros: {leadAny.preferred_neighborhoods.join(', ')}</span>
                    </div>
                  )}
                  {leadAny.preferred_cities?.length > 0 && (
                    <div className="flex items-start gap-3">
                      <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <span className="text-sm">Cidades: {leadAny.preferred_cities.join(', ')}</span>
                    </div>
                  )}
                  {leadAny.additional_requirements && (
                    <div className="flex items-start gap-3">
                      <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <p className="text-sm whitespace-pre-wrap">{leadAny.additional_requirements}</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {lead.notes && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">Observações</h3>
                <div className="flex items-start gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <p className="text-sm whitespace-pre-wrap">{lead.notes}</p>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Lead Score Section */}
          <LeadScoreSection lead={lead} />

          <Separator />

          <LeadInteractionTimeline leadId={lead.id} leadName={lead.name} />

          <Separator />

          {/* Actions */}
          <div className="flex flex-col gap-2 pb-safe">
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onEdit}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </Button>
              {onAssign && (
                <Button variant="outline" className="flex-1" onClick={onAssign}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Atribuir
                </Button>
              )}
              {onInactivate && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="secondary" className="flex-1">
                      <XCircle className="h-4 w-4 mr-2" />
                      Inativar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="mx-4 sm:mx-0">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Inativar lead?</AlertDialogTitle>
                      <AlertDialogDescription>
                        O lead "{lead.name}" será movido para a lista de inativos. Você poderá reativá-lo a qualquer momento.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                      <AlertDialogCancel className="sm:w-auto w-full">Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={onInactivate}
                        disabled={isInactivating}
                        className="sm:w-auto w-full"
                      >
                        {isInactivating ? 'Inativando...' : 'Inativar'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="mx-4 sm:mx-0">
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir lead?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. O lead "{lead.name}" será
                    permanentemente removido.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                  <AlertDialogCancel className="sm:w-auto w-full">Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onDelete}
                    disabled={isDeleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:w-auto w-full"
                  >
                    {isDeleting ? 'Excluindo...' : 'Excluir'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <Separator />

          <LeadSuggestedProperties lead={lead} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
