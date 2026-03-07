import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Send, Bot, User, Headset, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TicketChatProps {
  ticketId: string;
  ticketSubject: string;
  showSupportButton?: boolean;
}

interface ChatMessage {
  id: string;
  ticket_id: string;
  sender_role: "user" | "ai" | "support";
  sender_id: string | null;
  content: string;
  created_at: string;
}

const senderConfig: Record<string, { label: string; icon: typeof Bot; color: string }> = {
  user: { label: "Você", icon: User, color: "bg-primary/10 text-primary" },
  ai: { label: "Assistente IA", icon: Bot, color: "bg-muted text-muted-foreground" },
  support: { label: "Suporte", icon: Headset, color: "bg-accent/10 text-accent-foreground" },
};

export function TicketChat({ ticketId, ticketSubject, showSupportButton = true }: TicketChatProps) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["ticket-messages", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_messages" as any)
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ChatMessage[];
    },
    // No polling — realtime handles updates
  });

  // Realtime subscription for new messages
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

  const sendMessage = useMutation({
    mutationFn: async (message: string) => {
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
    },
    onError: (e: Error) => {
      toast.error(e.message || "Erro ao enviar mensagem");
      queryClient.invalidateQueries({ queryKey: ["ticket-messages", ticketId] });
    },
  });

  const sendSupportMessage = useMutation({
    mutationFn: async (message: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("ticket_messages" as any)
        .insert({
          ticket_id: ticketId,
          sender_role: "support",
          sender_id: user?.id,
          content: message,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-messages", ticketId] });
      setInput("");
    },
    onError: () => toast.error("Erro ao enviar resposta"),
  });

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (asSupport: boolean) => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (asSupport) {
      sendSupportMessage.mutate(trimmed);
    } else {
      sendMessage.mutate(trimmed);
    }
  };

  const isSending = sendMessage.isPending || sendSupportMessage.isPending;

  return (
    <div className="flex flex-col h-[400px]">
      {/* Messages area */}
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

      {/* Input area */}
      <div className="border-t pt-3 mt-2 space-y-2">
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
          className="min-h-[60px] max-h-[100px] resize-none text-sm"
          disabled={isSending}
        />
        <div className="flex gap-2 justify-end">
          {showSupportButton && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleSend(true)}
              disabled={!input.trim() || isSending}
              className="text-xs"
            >
              <Headset className="h-3.5 w-3.5 mr-1" />
              Responder como Suporte
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => handleSend(false)}
            disabled={!input.trim() || isSending}
            className="text-xs"
          >
            <Send className="h-3.5 w-3.5 mr-1" />
            {showSupportButton ? "Enviar (IA responde)" : "Enviar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
