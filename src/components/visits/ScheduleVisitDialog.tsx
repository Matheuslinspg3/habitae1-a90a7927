import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CalendarPlus } from "lucide-react";
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

  const filteredProperties = properties?.filter(
    (p) =>
      !propertySearch ||
      p.title?.toLowerCase().includes(propertySearch.toLowerCase()) ||
      p.property_code?.toLowerCase().includes(propertySearch.toLowerCase())
  ).slice(0, 20) || [];

  const filteredLeads = leads?.filter(
    (l) =>
      !leadSearch ||
      l.name?.toLowerCase().includes(leadSearch.toLowerCase()) ||
      l.phone?.includes(leadSearch)
  ).slice(0, 20) || [];

  const handleSubmit = () => {
    if (!propertyId || !leadId || !agentId || !scheduledAt) return;
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-primary" />
            Agendar Visita
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Property */}
          <div className="space-y-1.5">
            <Label className="text-sm">Imóvel *</Label>
            <Input
              placeholder="Buscar imóvel..."
              value={propertySearch}
              onChange={(e) => setPropertySearch(e.target.value)}
              className="h-8 text-sm mb-1"
            />
            <Select value={propertyId} onValueChange={setPropertyId}>
              <SelectTrigger className="h-9 text-sm">
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
            <Label className="text-sm">Lead *</Label>
            <Input
              placeholder="Buscar lead..."
              value={leadSearch}
              onChange={(e) => setLeadSearch(e.target.value)}
              className="h-8 text-sm mb-1"
            />
            <Select value={leadId} onValueChange={setLeadId}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Selecione um lead" />
              </SelectTrigger>
              <SelectContent className="max-h-48">
                {filteredLeads.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Agent */}
          <div className="space-y-1.5">
            <Label className="text-sm">Corretor Responsável *</Label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger className="h-9 text-sm">
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
            <Label className="text-sm">Data e Horário *</Label>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-sm">Observações</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações sobre a visita..."
              rows={2}
              className="text-sm resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isCreating || !propertyId || !leadId || !agentId || !scheduledAt}
          >
            {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Agendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
