import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, Building2, Clock, Infinity, Plus, Minus, Loader2 } from "lucide-react";
import { format, addMonths, addDays, addYears } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OrgRow {
  id: string;
  name: string;
  is_active: boolean;
  trial_started_at: string | null;
  trial_ends_at: string | null;
}

export function SubscriptionsTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [customDays, setCustomDays] = useState("");

  const { data: orgs, isLoading } = useQuery({
    queryKey: ["dev-org-subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, is_active, trial_started_at, trial_ends_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as OrgRow[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, trialEndsAt }: { id: string; trialEndsAt: string | null }) => {
      const { error } = await supabase
        .from("organizations")
        .update({ trial_ends_at: trialEndsAt })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dev-org-subscriptions"] });
      toast.success("Assinatura atualizada");
      setEditingId(null);
    },
    onError: (e: Error) => toast.error("Erro: " + e.message),
  });

  const getStatus = (org: OrgRow) => {
    if (!org.trial_ends_at) return "sem_plano";
    const end = new Date(org.trial_ends_at);
    if (end.getFullYear() >= 2099) return "ilimitado";
    if (end > new Date()) return "ativo";
    return "expirado";
  };

  const STATUS_LABELS: Record<string, string> = {
    sem_plano: "Sem plano",
    ilimitado: "Ilimitado",
    ativo: "Ativo",
    expirado: "Expirado",
  };

  const STATUS_COLORS: Record<string, string> = {
    sem_plano: "bg-muted text-muted-foreground",
    ilimitado: "bg-purple-500/10 text-purple-700 border-purple-200",
    ativo: "bg-green-500/10 text-green-700 border-green-200",
    expirado: "bg-red-500/10 text-red-700 border-red-200",
  };

  const adjustTime = (org: OrgRow, action: string) => {
    const current = org.trial_ends_at ? new Date(org.trial_ends_at) : new Date();
    let newEnd: Date;

    switch (action) {
      case "+1m":
        newEnd = addMonths(current < new Date() ? new Date() : current, 1);
        break;
      case "+3m":
        newEnd = addMonths(current < new Date() ? new Date() : current, 3);
        break;
      case "+6m":
        newEnd = addMonths(current < new Date() ? new Date() : current, 6);
        break;
      case "+1y":
        newEnd = addYears(current < new Date() ? new Date() : current, 1);
        break;
      case "unlimited":
        newEnd = new Date("2099-12-31T23:59:59Z");
        break;
      case "-1m":
        newEnd = addMonths(current, -1);
        break;
      case "expire":
        newEnd = new Date();
        break;
      case "custom": {
        const days = parseInt(customDays);
        if (isNaN(days)) {
          toast.error("Informe um número válido de dias");
          return;
        }
        newEnd = addDays(current < new Date() ? new Date() : current, days);
        break;
      }
      default:
        return;
    }

    const trialStarted = org.trial_started_at || new Date().toISOString();

    // Also set trial_started_at if not set
    if (!org.trial_started_at) {
      supabase
        .from("organizations")
        .update({ trial_started_at: trialStarted })
        .eq("id", org.id)
        .then(() => {});
    }

    updateMutation.mutate({ id: org.id, trialEndsAt: newEnd!.toISOString() });
  };

  const filtered = orgs?.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      o.name.toLowerCase().includes(q) ||
      getStatus(o).includes(q) ||
      STATUS_LABELS[getStatus(o)]?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar organização..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Badge variant="outline" className="shrink-0">
          {filtered?.length ?? 0} organizações
        </Badge>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered?.map((org) => {
            const status = getStatus(org);
            return (
              <Card key={org.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      {org.name}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={STATUS_COLORS[status] || ""}>
                        {STATUS_LABELS[status]}
                      </Badge>
                      {!org.is_active && (
                        <Badge variant="destructive">Inativa</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Início trial</p>
                      <p className="font-medium">
                        {org.trial_started_at
                          ? format(new Date(org.trial_started_at), "dd/MM/yyyy", { locale: ptBR })
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Expira em</p>
                      <p className="font-medium">
                        {!org.trial_ends_at
                          ? "—"
                          : new Date(org.trial_ends_at).getFullYear() >= 2099
                          ? "♾️ Ilimitado"
                          : format(new Date(org.trial_ends_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Status org</p>
                      <p className="font-medium">{org.is_active ? "Ativa" : "Inativa"}</p>
                    </div>
                  </div>

                  {editingId === org.id ? (
                    <div className="space-y-3 pt-2 border-t">
                      <p className="text-sm font-medium flex items-center gap-1.5">
                        <Clock className="h-4 w-4" /> Gerenciar tempo
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => adjustTime(org, "+1m")} disabled={updateMutation.isPending}>
                          <Plus className="h-3 w-3 mr-1" /> 1 mês
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => adjustTime(org, "+3m")} disabled={updateMutation.isPending}>
                          <Plus className="h-3 w-3 mr-1" /> 3 meses
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => adjustTime(org, "+6m")} disabled={updateMutation.isPending}>
                          <Plus className="h-3 w-3 mr-1" /> 6 meses
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => adjustTime(org, "+1y")} disabled={updateMutation.isPending}>
                          <Plus className="h-3 w-3 mr-1" /> 1 ano
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => adjustTime(org, "unlimited")} disabled={updateMutation.isPending}>
                          <Infinity className="h-3 w-3 mr-1" /> Ilimitado
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => adjustTime(org, "-1m")} disabled={updateMutation.isPending}>
                          <Minus className="h-3 w-3 mr-1" /> 1 mês
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => adjustTime(org, "expire")} disabled={updateMutation.isPending}>
                          Expirar agora
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 max-w-xs">
                        <Input
                          type="number"
                          placeholder="Dias (+/-)"
                          value={customDays}
                          onChange={(e) => setCustomDays(e.target.value)}
                          className="w-28"
                        />
                        <Button size="sm" variant="secondary" onClick={() => adjustTime(org, "custom")} disabled={updateMutation.isPending}>
                          Aplicar
                        </Button>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        Fechar
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => { setEditingId(org.id); setCustomDays(""); }}>
                      <Clock className="h-3.5 w-3.5 mr-1.5" /> Gerenciar tempo
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {filtered?.length === 0 && (
            <p className="text-center text-muted-foreground py-8">Nenhuma organização encontrada.</p>
          )}
        </div>
      )}
    </div>
  );
}
