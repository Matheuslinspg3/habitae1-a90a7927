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
import { getPushErrorDetails, getPushErrorMessage, type PushErrorDetails } from "@/lib/pushErrors";

export function SendPushCard() {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [title, setTitle] = useState("🔔 Teste OneSignal");
  const [message, setMessage] = useState("Esta é uma notificação de teste.");
  const [isSending, setIsSending] = useState(false);
  const [lastErrorDetails, setLastErrorDetails] = useState<PushErrorDetails | null>(null);

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
        { headers: { Authorization: `Bearer ${session?.access_token}` } },
      );
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json() as Promise<{ id: string; email: string }[]>;
    },
  });

  const getEmail = (userId: string) => authUsers.find((u) => u.id === userId)?.email || "";

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error("Preencha título e mensagem");
      return;
    }

    setIsSending(true);
    setLastErrorDetails(null);

    try {
      const { data, error } = await supabase.functions.invoke("notifications-test", {
        body: {
          title: title.trim(),
          message: message.trim(),
          userId: selectedUserId || undefined,
        },
      });

      if (error) throw error;

      if (data?.ok && (data?.recipientsCount || 0) > 0) {
        toast.success(`Enviado via OneSignal (ID: ${data.notificationId || "n/a"})`);
      } else if (data?.ok) {
        toast.warning("Usuário sem dispositivos inscritos no OneSignal.");
      } else {
        setLastErrorDetails(data?.errorDetails || data);
        toast.error(data?.errorMessage || "Falha ao enviar notificação");
      }
    } catch (e: unknown) {
      setLastErrorDetails(getPushErrorDetails(e));
      toast.error(getPushErrorMessage(e));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Send className="h-4 w-4" />
          Enviar Notificação Teste (OneSignal)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="push-user">Destinatário (opcional)</Label>
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger id="push-user">
              <SelectValue placeholder="Admin logado (padrão)" />
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
          <Input id="push-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="push-message">Mensagem</Label>
          <Textarea id="push-message" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} rows={3} />
        </div>

        <Button onClick={handleSend} disabled={isSending || !title.trim() || !message.trim()} className="w-full gap-2">
          {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Enviar Notificação de Teste
        </Button>

        {lastErrorDetails && (
          <details className="text-xs rounded bg-muted p-3">
            <summary className="cursor-pointer">Ver detalhes técnicos</summary>
            <div className="mt-2 space-y-1">
              <p><strong>Tipo:</strong> {lastErrorDetails.errorType || "unknown"}</p>
              <p><strong>Resumo:</strong> {lastErrorDetails.message}</p>
              {lastErrorDetails.hint && <p><strong>Dica:</strong> {lastErrorDetails.hint}</p>}
              {lastErrorDetails.technicalMessage && (
                <p className="font-mono text-[11px] break-all">
                  <strong>Detalhe técnico:</strong> {lastErrorDetails.technicalMessage}
                </p>
              )}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
