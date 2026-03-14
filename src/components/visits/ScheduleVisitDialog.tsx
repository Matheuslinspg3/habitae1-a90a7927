import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CalendarPlus, AlertTriangle } from "lucide-react";
import { useVisits } from "@/hooks/useVisits";
import { useProperties } from "@/hooks/useProperties";
import { useBrokers } from "@/hooks/useBrokers";
import { useLeads } from "@/hooks/useLeads";

interface ScheduleVisitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultLeadId?: string;
  defaultPropertyId?: string;
}

export function ScheduleVisitDialog({
  open,
  onOpenChange,
  defaultLeadId,
  defaultPropertyId,
}: ScheduleVisitDialogProps) {
  const { createVisit, isCreating } = useVisits();
  const { properties } = useProperties();
  const { brokers } = useBrokers();
  const { leads } = useLeads();

  const [propertyId, setPropertyId] = useState(defaultPropertyId || "");
  const [leadId, setLeadId] = useState(defaultLeadId || "");
  const [agentId, setAgentId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [notes, setNotes] = useState("");
  const [propertySearch, setPropertySearch] = useState("");
  const [leadSearch, setLeadSearch] = useState("");

  useEffect(() => {
    if (open) {
      setPropertyId(defaultPropertyId || "");
      setLeadId(defaultLeadId || "");
      setAgentId("");
      setNotes("");
      // Set default datetime to tomorrow 10:00
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      tomorrow.setMinutes(tomorrow.getMinutes() - tomorrow.getTimezoneOffset());
      setScheduledAt(tomorrow.toISOString().slice(0, 16));
    }
  }, [open, defaultPropertyId, defaultLeadId]);

  const filteredProperties = useMemo(() =>
    (properties || []).filter(
      (p) =>
        !propertySearch ||
        p.title?.toLowerCase().includes(propertySearch.toLowerCase()) ||
        p.property_code?.toLowerCase().includes(propertySearch.toLowerCase())
    ).slice(0, 20),
    [properties, propertySearch]
  );

  const filteredLeads = useMemo(() =>
    (leads || []).filter(
      (l) =>
        !leadSearch ||
        l.name?.toLowerCase().includes(leadSearch.toLowerCase()) ||
        l.phone?.includes(leadSearch)
    ).slice(0, 20),
    [leads, leadSearch]
  );

  // Date validation
  const dateValidation = useMemo(() => {
    if (!scheduledAt) return null;
    const date = new Date(scheduledAt);
    const now = new Date();
    
    if (date < now) {
      return { type: "error" as const, message: "Não é possível agendar no passado." };
    }
    
    const hours = date.getHours();
    if (hours < 8 || hours >= 20) {
      return { type: "warning" as const, message: "Horário fora do comercial (8h–20h)." };
    }
    
    return null;
  }, [scheduledAt]);

  const isPastDate = dateValidation?.type === "error";
  const canSubmit = propertyId && leadId && agentId && scheduledAt && !isPastDate;

  // Min date for input
  const minDateTime = useMemo(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  }, []);

  const handleSubmit = () => {
    if (!canSubmit) return;
    createVisit(
      {
        property_id: propertyId,
        lead_id: leadId,
        agent_id: agentId,
        scheduled_at: new Date(scheduledAt).toISOString(),
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: () => onOpenChange(false),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-primary" />
            Agendar Visita
          </DialogTitle>
          <DialogDescription>
            Preencha os dados para agendar uma visita ao imóvel.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Property */}
          <div className="space-y-1.5">
            <Label htmlFor="visit-property-search">Imóvel *</Label>
            {!defaultPropertyId && (
              <Input
                id="visit-property-search"
                placeholder="Buscar imóvel..."
                value={propertySearch}
                onChange={(e) => setPropertySearch(e.target.value)}
                className="h-9 text-sm mb-1"
              />
            )}
            <Select value={propertyId} onValueChange={setPropertyId}>
              <SelectTrigger className="h-10 text-sm" aria-label="Selecionar imóvel">
                <SelectValue placeholder="Selecione um imóvel" />
              </SelectTrigger>
              <SelectContent className="max-h-48">
                {filteredProperties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.property_code ? `#${p.property_code} - ` : ""}{p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Lead */}
          <div className="space-y-1.5">
            <Label htmlFor="visit-lead-search">Lead *</Label>
            {!defaultLeadId && (
              <Input
                id="visit-lead-search"
                placeholder="Buscar lead..."
                value={leadSearch}
                onChange={(e) => setLeadSearch(e.target.value)}
                className="h-9 text-sm mb-1"
              />
            )}
            <Select value={leadId} onValueChange={setLeadId}>
              <SelectTrigger className="h-10 text-sm" aria-label="Selecionar lead">
                <SelectValue placeholder="Selecione um lead" />
              </SelectTrigger>
              <SelectContent className="max-h-48">
                {filteredLeads.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}{l.phone ? ` · ${l.phone}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Agent */}
          <div className="space-y-1.5">
            <Label htmlFor="visit-agent-select">Corretor Responsável *</Label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger id="visit-agent-select" className="h-10 text-sm">
                <SelectValue placeholder="Selecione um corretor" />
              </SelectTrigger>
              <SelectContent className="max-h-48">
                {brokers.map((b) => (
                  <SelectItem key={b.user_id} value={b.user_id}>
                    {b.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* DateTime */}
          <div className="space-y-1.5">
            <Label htmlFor="visit-datetime">Data e Horário *</Label>
            <Input
              id="visit-datetime"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              min={minDateTime}
              className="h-10 text-sm"
            />
            {dateValidation && (
              <div className={`flex items-center gap-1.5 text-xs ${dateValidation.type === "error" ? "text-destructive" : "text-warning"}`}>
                <AlertTriangle className="h-3 w-3 shrink-0" />
                {dateValidation.message}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="visit-notes">Observações</Label>
            <Textarea
              id="visit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações sobre a visita..."
              rows={2}
              className="text-sm resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="h-10">
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isCreating || !canSubmit}
            className="h-10 gap-2"
          >
            {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
            {isCreating ? "Agendando..." : "Agendar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
