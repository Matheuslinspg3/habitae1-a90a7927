import { useState, useRef } from "react";
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
import { Bug, Loader2, MessageSquarePlus, Paperclip, X, FileText, Image as ImageIcon, Video } from "lucide-react";
import { TicketChat } from "@/components/developer/TicketChat";

const CATEGORIES = [
  { value: "bug", label: "Bug / Erro" },
  { value: "feature", label: "Sugestão de melhoria" },
  { value: "duvida", label: "Dúvida" },
  { value: "outro", label: "Outro" },
];

const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return ImageIcon;
  if (type.startsWith("video/")) return Video;
  return FileText;
}

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
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const valid = selected.filter(f => {
      if (f.size > MAX_FILE_SIZE) {
        toast.error(`${f.name} excede o limite de 10MB`);
        return false;
      }
      return true;
    });
    setFiles(prev => [...prev, ...valid].slice(0, 5));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

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

    // Create ticket
    const { data, error } = await supabase.from("support_tickets" as any).insert({
      user_id: user.id,
      organization_id: profile.organization_id,
      subject: subject.trim(),
      description: description.trim(),
      category,
    } as any).select().single();

    if (!error && data) {
      const ticketId = (data as any).id;

      // Upload files if any
      let attachments: any[] = [];
      if (files.length > 0) {
        for (const file of files) {
          const ext = file.name.split('.').pop();
          const path = `${ticketId}/${crypto.randomUUID()}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from("ticket-attachments")
            .upload(path, file, { contentType: file.type });
          if (uploadError) {
            console.error("Upload error:", uploadError);
            continue;
          }
          const { data: signedData } = await supabase.storage
            .from("ticket-attachments")
            .createSignedUrl(path, 60 * 60 * 24 * 365);
          if (signedData?.signedUrl) {
            attachments.push({
              name: file.name,
              url: signedData.signedUrl,
              type: file.type,
              size: file.size,
            });
          }
        }

        // Insert a user message with attachments
        if (attachments.length > 0) {
          await supabase.from("ticket_messages" as any).insert({
            ticket_id: ticketId,
            sender_role: "user",
            sender_id: user.id,
            content: "📎 Anexo(s) do ticket",
            attachments,
          } as any);
        }
      }

      // Trigger AI diagnostic
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
      setTimeout(() => {
        setCreatedTicketId(null);
        setCreatedTicketSubject("");
        setSubject("");
        setDescription("");
        setCategory("bug");
        setFiles([]);
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
                  rows={4}
                />
              </div>

              {/* File attachments */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  Anexos (opcional)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Fotos, vídeos ou documentos (máx. 10MB cada, até 5 arquivos)
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES}
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={files.length >= 5}
                >
                  <Paperclip className="h-3.5 w-3.5 mr-1" />
                  Adicionar arquivo
                </Button>

                {files.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {files.map((file, i) => {
                      const Icon = getFileIcon(file.type);
                      const isImage = file.type.startsWith("image/");
                      return (
                        <div key={i} className="relative group">
                          {isImage ? (
                            <div className="relative w-16 h-16 rounded-md overflow-hidden border border-border">
                              <img
                                src={URL.createObjectURL(file)}
                                alt={file.name}
                                className="w-full h-full object-cover"
                              />
                              <button
                                onClick={() => removeFile(i)}
                                className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 bg-muted rounded-md px-2 py-1.5 text-xs">
                              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="truncate max-w-[80px]">{file.name}</span>
                              <button
                                onClick={() => removeFile(i)}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
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
