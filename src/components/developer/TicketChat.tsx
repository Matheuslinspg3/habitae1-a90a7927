import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Send, Bot, User, Headset, Loader2, Paperclip, X, FileText, Image as ImageIcon, Video } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TicketChatProps {
  ticketId: string;
  ticketSubject: string;
  showSupportButton?: boolean;
}

interface Attachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

interface ChatMessage {
  id: string;
  ticket_id: string;
  sender_role: "user" | "ai" | "support";
  sender_id: string | null;
  content: string;
  created_at: string;
  attachments?: Attachment[];
}

const senderConfig: Record<string, { label: string; icon: typeof Bot; color: string }> = {
  user: { label: "Você", icon: User, color: "bg-primary/10 text-primary" },
  ai: { label: "Assistente IA", icon: Bot, color: "bg-muted text-muted-foreground" },
  support: { label: "Suporte", icon: Headset, color: "bg-accent/10 text-accent-foreground" },
};

const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return ImageIcon;
  if (type.startsWith("video/")) return Video;
  return FileText;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentPreview({ attachment }: { attachment: Attachment }) {
  const isImage = attachment.type.startsWith("image/");
  const isVideo = attachment.type.startsWith("video/");

  if (isImage) {
    return (
      <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="block">
        <img
          src={attachment.url}
          alt={attachment.name}
          className="rounded-md max-h-40 max-w-full object-cover border border-border"
        />
      </a>
    );
  }

  if (isVideo) {
    return (
      <video
        src={attachment.url}
        controls
        className="rounded-md max-h-40 max-w-full border border-border"
      />
    );
  }

  const Icon = getFileIcon(attachment.type);
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 border border-border text-xs hover:bg-muted transition-colors"
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="truncate max-w-[150px]">{attachment.name}</span>
      <span className="text-muted-foreground shrink-0">({formatFileSize(attachment.size)})</span>
    </a>
  );
}

export function TicketChat({ ticketId, ticketSubject, showSupportButton = true }: TicketChatProps) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["ticket-messages", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_messages" as any)
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []).map((m: any) => ({
        ...m,
        attachments: m.attachments || [],
      })) as ChatMessage[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`ticket-messages-${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_messages',
          filter: `ticket_id=eq.${ticketId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["ticket-messages", ticketId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId, queryClient]);

  const uploadFiles = async (files: File[]): Promise<Attachment[]> => {
    const attachments: Attachment[] = [];
    for (const file of files) {
      const ext = file.name.split('.').pop();
      const path = `${ticketId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("ticket-attachments")
        .upload(path, file, { contentType: file.type });
      if (error) {
        toast.error(`Erro ao enviar ${file.name}`);
        continue;
      }
      const { data: urlData } = supabase.storage
        .from("ticket-attachments")
        .getPublicUrl(path);
      
      // For private buckets, use createSignedUrl
      const { data: signedData } = await supabase.storage
        .from("ticket-attachments")
        .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 year

      attachments.push({
        name: file.name,
        url: signedData?.signedUrl || urlData.publicUrl,
        type: file.type,
        size: file.size,
      });
    }
    return attachments;
  };

  const sendMessage = useMutation({
    mutationFn: async ({ message, attachments }: { message: string; attachments: Attachment[] }) => {
      // If there are attachments, insert the message directly with attachments
      if (attachments.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        const { error: insertError } = await supabase
          .from("ticket_messages" as any)
          .insert({
            ticket_id: ticketId,
            sender_role: "user",
            sender_id: user?.id,
            content: message || "📎 Anexo(s) enviado(s)",
            attachments: attachments,
          } as any);
        if (insertError) throw insertError;

        // Also trigger AI if there's a text message
        if (message) {
          await supabase.functions.invoke("ticket-chat", {
            body: { ticket_id: ticketId, message },
          }).catch(() => {}); // AI response is optional
        }
        return;
      }

      const { data, error } = await supabase.functions.invoke("ticket-chat", {
        body: { ticket_id: ticketId, message },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-messages", ticketId] });
      setInput("");
      setPendingFiles([]);
    },
    onError: (e: Error) => {
      toast.error(e.message || "Erro ao enviar mensagem");
      queryClient.invalidateQueries({ queryKey: ["ticket-messages", ticketId] });
    },
  });

  const sendSupportMessage = useMutation({
    mutationFn: async ({ message, attachments }: { message: string; attachments: Attachment[] }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("ticket_messages" as any)
        .insert({
          ticket_id: ticketId,
          sender_role: "support",
          sender_id: user?.id,
          content: message || "📎 Anexo(s) enviado(s)",
          attachments: attachments.length > 0 ? attachments : undefined,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-messages", ticketId] });
      setInput("");
      setPendingFiles([]);
    },
    onError: () => toast.error("Erro ao enviar resposta"),
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter(f => {
      if (f.size > MAX_FILE_SIZE) {
        toast.error(`${f.name} excede o limite de 10MB`);
        return false;
      }
      return true;
    });
    setPendingFiles(prev => [...prev, ...valid].slice(0, 5));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = async (asSupport: boolean) => {
    const trimmed = input.trim();
    if (!trimmed && pendingFiles.length === 0) return;

    setUploading(true);
    let attachments: Attachment[] = [];
    if (pendingFiles.length > 0) {
      attachments = await uploadFiles(pendingFiles);
    }
    setUploading(false);

    if (asSupport) {
      sendSupportMessage.mutate({ message: trimmed, attachments });
    } else {
      sendMessage.mutate({ message: trimmed, attachments });
    }
  };

  const isSending = sendMessage.isPending || sendSupportMessage.isPending || uploading;

  return (
    <div className="flex flex-col h-[400px]">
      <ScrollArea className="flex-1 pr-2" ref={scrollRef}>
        <div className="space-y-3 p-1">
          {isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && messages.length === 0 && (
            <div className="text-center py-8">
              <Bot className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">
                Envie uma mensagem para iniciar o atendimento.
                <br />A IA tentará ajudar primeiro.
              </p>
            </div>
          )}

          {messages.map((msg) => {
            const config = senderConfig[msg.sender_role] || senderConfig.user;
            const Icon = config.icon;
            const isUser = msg.sender_role === "user";
            const attachments = msg.attachments || [];

            return (
              <div
                key={msg.id}
                className={`flex gap-2 ${isUser ? "flex-row-reverse" : ""}`}
              >
                <div className={`shrink-0 h-7 w-7 rounded-full flex items-center justify-center ${config.color}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className={`max-w-[80%] ${isUser ? "text-right" : ""}`}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[10px] font-medium text-muted-foreground">{config.label}</span>
                    <span className="text-[10px] text-muted-foreground/60">
                      {format(new Date(msg.created_at), "HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  <div
                    className={`rounded-lg px-3 py-2 text-sm ${
                      isUser
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:m-0 [&>ul]:m-0 [&>ol]:m-0">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                  {attachments.length > 0 && (
                    <div className={`mt-1.5 flex flex-wrap gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
                      {attachments.map((att, i) => (
                        <AttachmentPreview key={i} attachment={att} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isSending && (
            <div className="flex gap-2">
              <div className="shrink-0 h-7 w-7 rounded-full flex items-center justify-center bg-muted text-muted-foreground">
                <Bot className="h-3.5 w-3.5" />
              </div>
              <div className="bg-muted rounded-lg px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Pending files preview */}
      {pendingFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1 pt-2">
          {pendingFiles.map((file, i) => {
            const Icon = getFileIcon(file.type);
            return (
              <div key={i} className="flex items-center gap-1.5 bg-muted rounded-md px-2 py-1 text-xs">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="truncate max-w-[100px]">{file.name}</span>
                <button
                  onClick={() => removePendingFile(i)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Input area */}
      <div className="border-t pt-3 mt-2 space-y-2">
        <div className="flex gap-2">
          <Textarea
            placeholder="Digite sua mensagem..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(false);
              }
            }}
            className="min-h-[60px] max-h-[100px] resize-none text-sm flex-1"
            disabled={isSending}
          />
          <div className="flex flex-col justify-end">
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
              size="icon"
              variant="ghost"
              className="h-9 w-9"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSending}
              title="Anexar arquivo"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          {showSupportButton && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleSend(true)}
              disabled={(!input.trim() && pendingFiles.length === 0) || isSending}
              className="text-xs"
            >
              <Headset className="h-3.5 w-3.5 mr-1" />
              Responder como Suporte
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => handleSend(false)}
            disabled={(!input.trim() && pendingFiles.length === 0) || isSending}
            className="text-xs"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5 mr-1" />
            )}
            {showSupportButton ? "Enviar (IA responde)" : "Enviar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
