import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Construction, Power, PowerOff, Loader2, AlertTriangle,
  Clock, User, Plus, Trash2, ShieldCheck, Mail,
} from "lucide-react";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function AllowlistSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newEmail, setNewEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const { data: allowlist = [], isLoading } = useQuery({
    queryKey: ["admin-allowlist"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_allowlist")
        .select("id, email, created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const handleAdd = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      toast({ variant: "destructive", title: "E-mail inválido" });
      return;
    }
    setAdding(true);
    try {
      const { error } = await supabase.from("admin_allowlist").insert({ email });
      if (error) {
        if (error.code === "23505") {
          toast({ variant: "destructive", title: "E-mail já existe na lista" });
        } else {
          throw error;
        }
      } else {
        toast({ title: "E-mail adicionado à lista de acesso" });
        setNewEmail("");
        queryClient.invalidateQueries({ queryKey: ["admin-allowlist"] });
      }
    } catch (err: unknown) {
      toast({ variant: "destructive", title: "Erro ao adicionar", description: String(err) });
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id: string) => {
    setRemovingId(id);
    try {
      const { error } = await supabase.from("admin_allowlist").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "E-mail removido da lista" });
      queryClient.invalidateQueries({ queryKey: ["admin-allowlist"] });
    } catch (err: unknown) {
      toast({ variant: "destructive", title: "Erro ao remover", description: String(err) });
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Acesso durante manutenção</span>
      </div>
      <p className="text-xs text-muted-foreground">
        E-mails que podem acessar a plataforma durante a manutenção.
      </p>

      {/* Add email */}
      <div className="flex gap-2">
        <Input
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder="email@exemplo.com"
          className="text-sm h-8"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <Button size="sm" onClick={handleAdd} disabled={adding} className="h-8 gap-1 shrink-0">
          {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          Adicionar
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : allowlist.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">Nenhum e-mail na lista.</p>
      ) : (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {allowlist.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-2.5 py-1.5 group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-xs truncate">{item.email}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                onClick={() => handleRemove(item.id)}
                disabled={removingId === item.id}
              >
                {removingId === item.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function MaintenanceCard() {
  const { isMaintenanceMode, maintenanceMessage, maintenanceStartedAt, maintenanceStartedBy, isLoading, error } = useMaintenanceMode();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showDialog, setShowDialog] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [toggling, setToggling] = useState(false);

  const openDialog = () => {
    setConfirmation("");
    setMessage(maintenanceMessage);
    setShowDialog(true);
  };

  const handleToggle = async () => {
    const action = isMaintenanceMode ? "deactivate" : "activate";

    if (action === "activate" && confirmation !== "MIGRACAO") {
      toast({ variant: "destructive", title: "Confirmação inválida", description: "Digite MIGRACAO para confirmar." });
      return;
    }

    setToggling(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada");

      const { data, error } = await supabase.functions.invoke("toggle-maintenance-mode", {
        body: { action, message: message || undefined },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: action === "activate" ? "Manutenção ativada" : "Manutenção desativada",
        description: action === "activate"
          ? "Usuários comuns foram bloqueados."
          : "A plataforma está liberada para todos os usuários.",
      });

      queryClient.invalidateQueries({ queryKey: ["maintenance-mode"] });
      setShowDialog(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast({ variant: "destructive", title: "Erro", description: msg });
    } finally {
      setToggling(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={isMaintenanceMode ? "border-amber-500/50 bg-amber-500/5" : ""}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Construction className="h-4 w-4" />
              Manutenção
            </div>
            <Badge variant={isMaintenanceMode ? "destructive" : "secondary"} className="text-[10px]">
              {isMaintenanceMode ? "ATIVO" : "Inativo"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isMaintenanceMode && (
            <div className="space-y-1.5 text-xs text-muted-foreground">
              {maintenanceStartedAt && (
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  Desde {format(new Date(maintenanceStartedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </div>
              )}
              {maintenanceStartedBy && (
                <div className="flex items-center gap-1.5">
                  <User className="h-3 w-3" />
                  <span className="truncate max-w-[140px]">{maintenanceStartedBy}</span>
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="text-xs text-destructive">Erro ao carregar status</p>
          )}

          <Button
            onClick={openDialog}
            variant={isMaintenanceMode ? "outline" : "destructive"}
            size="sm"
            className="w-full gap-2"
          >
            {isMaintenanceMode ? (
              <>
                <Power className="h-3.5 w-3.5" />
                Desativar Manutenção
              </>
            ) : (
              <>
                <PowerOff className="h-3.5 w-3.5" />
                Ativar Manutenção
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {isMaintenanceMode ? "Desativar Manutenção" : "Ativar Manutenção"}
            </DialogTitle>
            <DialogDescription>
              {isMaintenanceMode
                ? "A plataforma será liberada para todos os usuários."
                : "Isso impedirá login e uso da plataforma para usuários comuns. Apenas e-mails autorizados poderão acessar."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Message editing */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Mensagem de manutenção</label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className="text-sm"
              />
            </div>

            {/* Allowlist management */}
            <AllowlistSection />

            {/* Confirmation input (only for activation) */}
            {!isMaintenanceMode && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Digite <span className="font-mono font-bold text-destructive">MIGRACAO</span> para confirmar
                </label>
                <Input
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value.toUpperCase())}
                  placeholder="MIGRACAO"
                  className="font-mono"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDialog(false)} disabled={toggling}>
              Cancelar
            </Button>
            <Button
              variant={isMaintenanceMode ? "default" : "destructive"}
              onClick={handleToggle}
              disabled={toggling || (!isMaintenanceMode && confirmation !== "MIGRACAO")}
              className="gap-2"
            >
              {toggling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isMaintenanceMode ? (
                <>
                  <Power className="h-4 w-4" />
                  Desativar
                </>
              ) : (
                <>
                  <PowerOff className="h-4 w-4" />
                  Ativar Manutenção
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
