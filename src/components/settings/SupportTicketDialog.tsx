import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Bug, Loader2, MessageSquarePlus, ArrowLeft } from "lucide-react";
import { TicketChat } from "@/components/developer/TicketChat";

const CATEGORIES = [
  { value: "bug", label: "Bug / Erro" },
  { value: "feature", label: "Sugestão de melhoria" },
  { value: "duvida", label: "Dúvida" },
  { value: "outro", label: "Outro" },
];

interface SupportTicketDialogProps {
  trigger?: React.ReactNode;
}

export function SupportTicketDialog({ trigger }: SupportTicketDialogProps) {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("bug");
  const [sending, setSending] = useState(false);
  const [createdTicketId, setCreatedTicketId] = useState<string | null>(null);
  const [createdTicketSubject, setCreatedTicketSubject] = useState("");

  const handleSubmit = async () => {
    if (!subject.trim() || !description.trim()) {
      toast.error("Preencha o assunto e a descrição");
      return;
    }
    if (!user || !profile?.organization_id) {
      toast.error("Você precisa estar logado");
      return;
    }

    setSending(true);
    const { data, error } = await supabase.from("support_tickets" as any).insert({
      user_id: user.id,
      organization_id: profile.organization_id,
      subject: subject.trim(),
      description: description.trim(),
      category,
    } as any).select().single();

    if (!error && data) {
      const ticketId = (data as any).id;

      // Auto-trigger AI diagnostic with the ticket description
      // The webhook will be sent by the ticket-chat edge function AFTER the AI analysis
      supabase.functions.invoke("ticket-chat", {
        body: {
          ticket_id: ticketId,
          message: `${subject.trim()}: ${description.trim()}`,
        },
      }).catch((err) => console.error("AI diagnostic error:", err));

      toast.success("Ticket criado! A IA está analisando seu problema...");
      setCreatedTicketId(ticketId);
      setCreatedTicketSubject(subject.trim());
    }

    setSending(false);
    if (error) {
      toast.error("Erro ao enviar ticket: " + error.message);
    }
  };

  const handleClose = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      // Reset state when dialog closes
      setTimeout(() => {
        setCreatedTicketId(null);
        setCreatedTicketSubject("");
        setSubject("");
        setDescription("");
        setCategory("bug");
      }, 300);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <Bug className="h-4 w-4" />
            Reportar problema
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh]">
        {createdTicketId ? (
          // Show AI chat after ticket creation
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquarePlus className="h-5 w-5 text-primary" />
                Diagnóstico IA
              </DialogTitle>
              <DialogDescription>
                A IA está analisando seu problema. Converse para mais detalhes.
              </DialogDescription>
            </DialogHeader>
            <TicketChat
              ticketId={createdTicketId}
              ticketSubject={createdTicketSubject}
              showSupportButton={false}
            />
          </>
        ) : (
          // Show ticket creation form
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquarePlus className="h-5 w-5 text-primary" />
                Reportar problema
              </DialogTitle>
              <DialogDescription>
                Descreva o problema ou sugestão. Nossa IA fará um diagnóstico inicial.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="ticket-category">Categoria</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ticket-subject">Assunto</Label>
                <Input
                  id="ticket-subject"
                  placeholder="Ex: Erro ao salvar imóvel"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ticket-description">Descrição</Label>
                <Textarea
                  id="ticket-description"
                  placeholder="Descreva o problema com o máximo de detalhes possível..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={sending}>
                {sending && <Loader2 className="h-4 w-4 animate-spin" />}
                Enviar ticket
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
