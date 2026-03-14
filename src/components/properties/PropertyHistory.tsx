import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AvailabilityBadge, availabilityConfig } from "./AvailabilityBadge";
import { History, RefreshCw, ArrowRight, CalendarPlus } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScheduleVisitDialog } from "@/components/visits/ScheduleVisitDialog";
import { LeadVisitsSection } from "@/components/visits/LeadVisitsSection";

interface Props {
  propertyId: string;
  currentStatus: string;
  statusUpdatedAt: string | null;
  organizationId: string;
}

export function PropertyHistory({ propertyId, currentStatus, statusUpdatedAt, organizationId }: Props) {
  const { user } = useAuth();
  const { isAdminOrAbove } = useUserRoles();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState(currentStatus);
  const [reason, setReason] = useState("");
  const [visitDialogOpen, setVisitDialogOpen] = useState(false);

  // Fetch status history
  const { data: history = [], isLoading } = useQuery({
    queryKey: ["property_status_history", propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_status_history" as any)
        .select("*")
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!propertyId,
  });

  // Fetch profile names for changed_by
  const changerIds = [...new Set(history.map((h: any) => h.changed_by).filter(Boolean))];
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles_for_history", changerIds.join(",")],
    queryFn: async () => {
      if (changerIds.length === 0) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", changerIds);
      return data || [];
    },
    enabled: changerIds.length > 0,
  });

  const profileMap = Object.fromEntries(profiles.map((p: any) => [p.user_id, p.full_name]));

  const updateStatus = useMutation({
    mutationFn: async () => {
      if (!reason.trim()) throw new Error("Motivo é obrigatório");
      // First update the property
      const { error } = await supabase
        .from("properties")
        .update({ availability_status: newStatus })
        .eq("id", propertyId);
      if (error) throw error;
      // Insert history with reason (trigger handles the basic entry, but we want reason)
      const { error: histError } = await supabase
        .from("property_status_history" as any)
        .update({ reason: reason.trim() })
        .eq("property_id", propertyId)
        .eq("changed_by", user?.id)
        .order("created_at", { ascending: false })
        .limit(1);
      // Ignore if update fails — the trigger already recorded without reason
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["property_status_history", propertyId] });
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      toast({ title: "Status atualizado", description: "A disponibilidade foi alterada com sucesso." });
      setDialogOpen(false);
      setReason("");
    },
    onError: (error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  const getStatusLabel = (status: string) => availabilityConfig[status]?.label || status;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Disponibilidade
          </CardTitle>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setVisitDialogOpen(true)}>
              <CalendarPlus className="h-3.5 w-3.5" />
              Agendar visita
            </Button>
          {isAdminOrAbove && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Alterar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Alterar Disponibilidade</DialogTitle>
                  <DialogDescription>Selecione o novo status e informe o motivo da alteração.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Novo status</label>
                    <Select value={newStatus} onValueChange={setNewStatus}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(availabilityConfig).map(([key, config]) => (
                          <SelectItem key={key} value={key}>
                            {config.emoji} {config.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Motivo (obrigatório)</label>
                    <Textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Informe o motivo da alteração..."
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                  <Button
                    onClick={() => updateStatus.mutate()}
                    disabled={!reason.trim() || newStatus === currentStatus || updateStatus.isPending}
                  >
                    Confirmar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current status */}
        <div className="flex items-center gap-3">
          <AvailabilityBadge status={currentStatus} className="text-xs" />
          {statusUpdatedAt && (
            <span className="text-xs text-muted-foreground">
              desde {format(new Date(statusUpdatedAt), "dd/MM/yyyy", { locale: ptBR })}
            </span>
          )}
        </div>

        {/* Timeline */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma alteração registrada</p>
        ) : (
          <div className="relative space-y-0">
            {/* Vertical line */}
            <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />

            {history.map((entry: any, index: number) => (
              <div key={entry.id} className="relative pl-8 py-2">
                {/* Dot */}
                <div className="absolute left-1.5 top-3.5 w-3 h-3 rounded-full bg-primary/20 border-2 border-primary" />

                <div className="text-sm">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-muted-foreground">🔄</span>
                    {entry.old_status && (
                      <>
                        <span className="font-medium">{getStatusLabel(entry.old_status)}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      </>
                    )}
                    <span className="font-medium">{getStatusLabel(entry.new_status)}</span>
                    <span className="text-muted-foreground">por</span>
                    <span className="font-medium">{profileMap[entry.changed_by] || "Sistema"}</span>
                  </div>
                  {entry.reason && (
                    <p className="text-xs text-muted-foreground mt-0.5 italic">"{entry.reason}"</p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>

    <ScheduleVisitDialog
      open={visitDialogOpen}
      onOpenChange={setVisitDialogOpen}
      defaultPropertyId={propertyId}
    />
    </>
  );
}
