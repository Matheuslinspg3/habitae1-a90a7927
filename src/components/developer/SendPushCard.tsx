import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function SendPushCard() {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [title, setTitle] = useState("🔔 Teste OneSignal");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const { data: profiles = [] } = useQuery({
    queryKey: ["all-profiles-dev"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, full_name, organization_id");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: authUsers = [] } = useQuery({
    queryKey: ["admin-users-emails"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`,
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      );
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json() as Promise<{ id: string; email: string }[]>;
    },
  });

  const getEmail = (userId: string) => authUsers.find((u) => u.id === userId)?.email || "";

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
        toast.success(`Push enviado via OneSignal! (${data.sent} dispositivo${data.sent > 1 ? "s" : ""})`);
        setMessage("");
      } else if (data?.warning) {
        toast.warning("Usuário sem dispositivos inscritos no OneSignal.");
      } else {
        toast.warning("Nenhum dispositivo encontrado para este usuário.");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "erro desconhecido";
      console.error("Send push error:", e);
      if (msg.includes("ONESIGNAL")) {
        toast.error("Credenciais OneSignal não configuradas nos Secrets");
      } else {
        toast.error("Erro ao enviar push: " + msg);
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Send className="h-4 w-4" />
          Enviar Push (OneSignal)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="push-user">Destinatário</Label>
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger id="push-user">
              <SelectValue placeholder="Selecione um usuário" />
            </SelectTrigger>
            <SelectContent>
              {profiles.map((p) => {
                const email = getEmail(p.user_id);
                return (
                  <SelectItem key={p.user_id} value={p.user_id}>
                    {p.full_name || "Sem nome"} {email ? `(${email})` : ""}
                  </SelectItem>
                );
              })}
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
