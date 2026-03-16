import React, { useState, memo } from "react";
import { AdLead, useAdLeads } from "@/hooks/useAdLeads";
import { useLeadStages } from "@/hooks/useLeadStages";
import { useAdSettings } from "@/hooks/useAdSettings";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Eye, Send, Archive, AlertCircle, CheckCircle2, Clock, Mail, Phone, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  new: { label: "Novo", variant: "destructive" },
  read: { label: "Lido", variant: "secondary" },
  sent_to_crm: { label: "Enviado ao CRM", variant: "default" },
  send_failed: { label: "Falha no envio", variant: "destructive" },
  archived: { label: "Arquivado", variant: "outline" },
};

interface AdLeadRowProps {
  lead: AdLead;
  adName?: string;
  showAdName?: boolean;
}

export function AdLeadRow({ lead, adName, showAdName }: AdLeadRowProps) {
  const { updateStatus, sendToCrm, isSending } = useAdLeads();
  const { leadStages } = useLeadStages();
  const { settings } = useAdSettings();
  const [showCrmDialog, setShowCrmDialog] = useState(false);
  const [selectedStage, setSelectedStage] = useState(settings?.crm_stage_id || leadStages[0]?.id || "");
  const navigate = useNavigate();

  const statusInfo = STATUS_LABELS[lead.status] || STATUS_LABELS.new;

  const handleMarkRead = () => {
    if (lead.status === 'new') {
      updateStatus({ id: lead.id, status: 'read' });
    }
  };

  const handleSendToCrm = () => {
    if (!selectedStage) return;
    sendToCrm({ leadId: lead.id, stageId: selectedStage });
    setShowCrmDialog(false);
  };

  const handleArchive = () => {
    updateStatus({ id: lead.id, status: 'archived' });
  };

  return (
    <>
      <Card className={`transition-colors ${lead.status === 'new' ? 'border-primary/50 bg-primary/5' : ''}`}>
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              {lead.name && (
                <span className="font-medium text-sm flex items-center gap-1">
                  <User className="h-3 w-3" /> {lead.name}
                </span>
              )}
              <Badge variant={statusInfo.variant} className="text-xs">{statusInfo.label}</Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              {lead.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{lead.email}</span>}
              {lead.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{lead.phone}</span>}
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(new Date(lead.created_time), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </span>
            </div>
            {showAdName && adName && (
              <p
                className="text-xs text-primary cursor-pointer hover:underline"
                onClick={() => navigate(`/marketing/ad/${lead.external_ad_id}`)}
              >
                Anúncio: {adName}
              </p>
            )}
            {lead.status === 'send_failed' && lead.status_reason && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {lead.status_reason}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {lead.status === 'new' && (
              <Button variant="ghost" size="sm" onClick={handleMarkRead}>
                <Eye className="h-4 w-4 mr-1" /> Marcar como lido
              </Button>
            )}
            {(lead.status === 'new' || lead.status === 'read' || lead.status === 'send_failed') && (
              <Button variant="outline" size="sm" onClick={() => setShowCrmDialog(true)}>
                <Send className="h-4 w-4 mr-1" /> Enviar ao CRM
              </Button>
            )}
            {lead.status !== 'archived' && lead.status !== 'sent_to_crm' && (
              <Button variant="ghost" size="sm" onClick={handleArchive}>
                <Archive className="h-4 w-4" />
              </Button>
            )}
            {lead.status === 'sent_to_crm' && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" /> No CRM
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showCrmDialog} onOpenChange={setShowCrmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar Lead para o CRM</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              O lead <strong>{lead.name || lead.email || 'sem nome'}</strong> será criado no CRM no estágio selecionado.
            </p>
            <div className="space-y-2">
              <Label>Estágio do CRM</Label>
              <Select value={selectedStage} onValueChange={setSelectedStage}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {leadStages.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                        {s.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCrmDialog(false)}>Cancelar</Button>
            <Button onClick={handleSendToCrm} disabled={!selectedStage || isSending}>
              {isSending ? "Enviando..." : "Enviar ao CRM"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
