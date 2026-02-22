import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Loader2, Stethoscope } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function SendPushCard() {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);

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

  const diagnosePush = async () => {
    setIsDiagnosing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push?health=1`,
        {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );

      const payload = await res.json();
      const status = payload?.status;

      if (status === "ok") {
        toast.success("Diagnóstico Push OK: APP_URL e FIREBASE_SERVICE_ACCOUNT_KEY válidos.");
        return true;
      }

      const actions: Record<string, string> = {
        missing_app_url: "Configurar secret APP_URL no ambiente Production com URL pública (https://...).",
        invalid_app_url: "Corrigir APP_URL para uma URL absoluta válida em Production.",
        missing_service_account: "Configurar secret FIREBASE_SERVICE_ACCOUNT_KEY no ambiente Production.",
        invalid_service_account_json: "Atualizar FIREBASE_SERVICE_ACCOUNT_KEY com JSON válido em linha única.",
        invalid_service_account_fields: "Regerar a service account Firebase e garantir project_id, client_email e private_key.",
      };

      toast.error(`Diagnóstico Push: ${payload?.message || status || "falha desconhecida"}`);
      if (status && actions[status]) {
        toast.warning(actions[status]);
      }
      return false;
    } catch (e: any) {
      console.error("Push diagnosis error:", e);
      toast.error("Falha ao executar diagnóstico de push.");
      return false;
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleSend = async () => {
    if (!selectedUserId || !title.trim()) {
      toast.error("Selecione um usuário e preencha o título");
      return;
    }

    const healthy = await diagnosePush();
    if (!healthy) return;

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

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            variant="outline"
            onClick={diagnosePush}
            disabled={isDiagnosing}
            className="w-full gap-2"
          >
            {isDiagnosing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stethoscope className="h-4 w-4" />}
            Diagnóstico Push
          </Button>

          <Button
            onClick={handleSend}
            disabled={isSending || isDiagnosing || !selectedUserId || !title.trim()}
            className="w-full gap-2"
          >
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar Notificação
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
