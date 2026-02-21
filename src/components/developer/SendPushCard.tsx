import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Send, Loader2 } from "lucide-react";
import { useBrokers } from "@/hooks/useBrokers";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function SendPushCard() {
  const { brokers, isLoading: loadingBrokers } = useBrokers();
  const [selectedUserId, setSelectedUserId] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!selectedUserId || !title.trim()) {
      toast.error("Selecione um usuário e preencha o título");
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-push", {
        body: {
          user_id: selectedUserId,
          title: title.trim(),
          message: message.trim(),
          notification_type: "dev_test",
        },
      });

      if (error) throw error;

      if (data?.sent > 0) {
        toast.success(`Push enviado! (${data.sent} dispositivo${data.sent > 1 ? "s" : ""}, ${data.staleRemoved || 0} tokens removidos)`);
        setTitle("");
        setMessage("");
      } else {
        toast.warning(`Nenhum dispositivo encontrado para este usuário. Tokens removidos: ${data?.staleRemoved || 0}`);
      }
    } catch (e: any) {
      console.error("Send push error:", e);
      toast.error("Erro ao enviar push: " + (e.message || "erro desconhecido"));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Send className="h-4 w-4" />
          Enviar Push para Usuário
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="push-user">Destinatário</Label>
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger id="push-user">
              <SelectValue placeholder={loadingBrokers ? "Carregando..." : "Selecione um usuário"} />
            </SelectTrigger>
            <SelectContent>
              {brokers.map((b) => (
                <SelectItem key={b.user_id} value={b.user_id}>
                  {b.full_name || "Sem nome"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="push-title">Título</Label>
          <Input
            id="push-title"
            placeholder="Ex: 🔔 Novo lead!"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="push-message">Mensagem (opcional)</Label>
          <Textarea
            id="push-message"
            placeholder="Corpo da notificação..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={500}
            rows={3}
          />
        </div>

        <Button
          onClick={handleSend}
          disabled={isSending || !selectedUserId || !title.trim()}
          className="w-full gap-2"
        >
          {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Enviar Notificação
        </Button>
      </CardContent>
    </Card>
  );
}
