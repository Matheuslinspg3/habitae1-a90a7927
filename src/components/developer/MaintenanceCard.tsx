import { useState } from "react";
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
import { Construction, Power, PowerOff, Loader2, AlertTriangle, Clock, User } from "lucide-react";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

    // Require confirmation text only for activation
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {isMaintenanceMode ? "Desativar Manutenção" : "Ativar Manutenção"}
            </DialogTitle>
            <DialogDescription>
              {isMaintenanceMode
                ? "A plataforma será liberada para todos os usuários."
                : "Isso impedirá login e uso da plataforma para usuários comuns. Apenas admins autorizados poderão acessar."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
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
