import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Copy, Loader2, Megaphone, Trash2, ExternalLink } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUserRoles } from "@/hooks/useUserRole";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function PlatformInviteSection() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const { hasRole, isLoading: rolesLoading } = useUserRoles();
  const canInvite = hasRole("developer") || hasRole("leader");
  const [inviteName, setInviteName] = useState("");

  const { data: invites = [], isLoading } = useQuery({
    queryKey: ["platform-invites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_invites")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: canInvite,
  });

  const createInvite = useMutation({
    mutationFn: async () => {
      if (!profile?.organization_id || !user) throw new Error("Sem organização");
      const { data, error } = await supabase
        .from("platform_invites")
        .insert({
          created_by: user.id,
          organization_id: profile.organization_id,
          name: inviteName.trim() || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const link = `${window.location.origin}/cadastro/${data.id}`;
      navigator.clipboard.writeText(link);
      toast.success("Link de convite copiado para a área de transferência!");
      setInviteName("");
      queryClient.invalidateQueries({ queryKey: ["platform-invites"] });
    },
    onError: () => {
      toast.error("Erro ao criar convite");
    },
  });

  const cancelInvite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("platform_invites")
        .update({ status: "cancelled" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Convite cancelado");
      queryClient.invalidateQueries({ queryKey: ["platform-invites"] });
    },
  });

  const getInviteLink = (id: string) => `${window.location.origin}/cadastro/${id}`;

  const copyLink = (id: string) => {
    navigator.clipboard.writeText(getInviteLink(id));
    toast.success("Link copiado!");
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "active": return "Ativo";
      case "used": return "Utilizado";
      case "expired": return "Expirado";
      case "cancelled": return "Cancelado";
      default: return status;
    }
  };

  const statusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "active": return "outline";
      case "used": return "default";
      case "expired": return "destructive";
      case "cancelled": return "secondary";
      default: return "secondary";
    }
  };

  if (rolesLoading || !canInvite) return null;

  const activeInvites = invites.filter((i) => i.status === "active");
  const otherInvites = invites.filter((i) => i.status !== "active");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-5 w-5" />
            Convidar Novo Cliente
          </CardTitle>
          <CardDescription>
            Gere um link para um novo cliente (imobiliária ou corretor) se cadastrar na plataforma com 7 dias gratuitos.
            Após o período de teste, a conta será bloqueada até a assinatura.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-name">Nome / Identificação (opcional)</Label>
            <Input
              id="invite-name"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              placeholder="Ex: Imobiliária XYZ"
            />
          </div>

          <Button onClick={() => createInvite.mutate()} disabled={createInvite.isPending}>
            {createInvite.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <ExternalLink className="h-4 w-4 mr-1" />
                Gerar Link de Cadastro
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {activeInvites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Convites Ativos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeInvites.map((invite) => (
              <div key={invite.id} className="flex items-center justify-between gap-3 p-3 border rounded-lg">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{invite.name || "Sem identificação"}</p>
                  <p className="text-xs text-muted-foreground">
                    Expira em {format(new Date(invite.expires_at), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
                <Badge variant={statusVariant(invite.status)}>{statusLabel(invite.status)}</Badge>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => copyLink(invite.id)} title="Copiar link">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => cancelInvite.mutate(invite.id)} title="Cancelar convite">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {otherInvites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histórico</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {otherInvites.map((invite) => (
              <div key={invite.id} className="flex items-center justify-between gap-3 p-3 border rounded-lg opacity-70">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{invite.name || "Sem identificação"}</p>
                  <p className="text-xs text-muted-foreground">
                    {invite.used_at
                      ? `Utilizado em ${format(new Date(invite.used_at), "dd/MM/yyyy", { locale: ptBR })}`
                      : `Criado em ${format(new Date(invite.created_at), "dd/MM/yyyy", { locale: ptBR })}`}
                  </p>
                </div>
                <Badge variant={statusVariant(invite.status)}>{statusLabel(invite.status)}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!isLoading && invites.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhum convite de cliente enviado ainda
        </p>
      )}
    </div>
  );
}
