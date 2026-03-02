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
import { Bug, Loader2, MessageSquarePlus } from "lucide-react";

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

    // Enviar para webhook n8n/WhatsApp independente do retorno do data
    if (!error) {
      // Buscar nome da organização para o webhook
      const orgName = await supabase
        .from("organizations")
        .select("name")
        .eq("id", profile.organization_id)
        .single()
        .then((r) => (r.data as any)?.name || "Desconhecida");

      supabase.functions.invoke("send-ticket-webhook", {
        body: {
          webhook_url: "https://n8n.costazul.shop/webhook/lovableportadocorrerora",
          payload: {
            ticket_id: (data as any)?.id ?? "unknown",
            subject: subject.trim(),
            description: description.trim(),
            category,
            status: "open",
            source: "porta_do_corretor",
            user_name: profile.full_name || "Desconhecido",
            user_email: user.email || "",
            organization_name: orgName,
          },
        },
      }).catch((err) => console.error("Webhook error:", err));
    }

    setSending(false);
    if (error) {
      toast.error("Erro ao enviar ticket: " + error.message);
    } else {
      toast.success("Ticket enviado com sucesso! A equipe técnica irá analisar.");
      setSubject("");
      setDescription("");
      setCategory("bug");
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <Bug className="h-4 w-4" />
            Reportar problema
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquarePlus className="h-5 w-5 text-primary" />
            Reportar problema
          </DialogTitle>
          <DialogDescription>
            Descreva o problema ou sugestão. Nossa equipe técnica receberá e responderá em breve.
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
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={sending}>
            {sending && <Loader2 className="h-4 w-4 animate-spin" />}
            Enviar ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
