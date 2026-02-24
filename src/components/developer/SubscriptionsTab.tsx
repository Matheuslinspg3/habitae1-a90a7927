import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Search, CreditCard, Clock, Infinity, Plus, Minus, Loader2 } from "lucide-react";
import { format, addMonths, addDays, addYears } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SubscriptionRow {
  id: string;
  status: string;
  billing_cycle: string;
  current_period_start: string;
  current_period_end: string;
  trial_end: string | null;
  plan_id: string;
  organization_id: string;
  organization: { id: string; name: string } | null;
  plan: { id: string; name: string; slug: string } | null;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500/10 text-green-700 border-green-200",
  trial: "bg-blue-500/10 text-blue-700 border-blue-200",
  cancelled: "bg-red-500/10 text-red-700 border-red-200",
  suspended: "bg-yellow-500/10 text-yellow-700 border-yellow-200",
  expired: "bg-muted text-muted-foreground",
  overdue: "bg-orange-500/10 text-orange-700 border-orange-200",
};

export function SubscriptionsTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [customDays, setCustomDays] = useState("");

  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ["dev-subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*, organization:organizations(id, name), plan:subscription_plans(id, name, slug)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as SubscriptionRow[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, newEnd, status }: { id: string; newEnd: string; status?: string }) => {
      const updateData: Record<string, string> = { current_period_end: newEnd };
      if (status) updateData.status = status;
      const { error } = await supabase.from("subscriptions").update(updateData).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dev-subscriptions"] });
      toast.success("Assinatura atualizada");
      setEditingId(null);
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const adjustTime = (sub: SubscriptionRow, action: string) => {
    const current = new Date(sub.current_period_end);
    let newEnd: Date;
    let status: string | undefined;

    switch (action) {
      case "+1m":
        newEnd = addMonths(current, 1);
        status = "active";
        break;
      case "+3m":
        newEnd = addMonths(current, 3);
        status = "active";
        break;
      case "+6m":
        newEnd = addMonths(current, 6);
        status = "active";
        break;
      case "+1y":
        newEnd = addYears(current, 1);
        status = "active";
        break;
      case "unlimited":
        newEnd = new Date("2099-12-31T23:59:59Z");
        status = "active";
        break;
      case "-1m":
        newEnd = addMonths(current, -1);
        break;
      case "expire":
        newEnd = new Date();
        status = "expired";
        break;
      case "custom":
        const days = parseInt(customDays);
        if (isNaN(days)) {
          toast.error("Informe um número válido de dias");
          return;
        }
        newEnd = addDays(current, days);
        if (newEnd > new Date()) status = "active";
        break;
      default:
        return;
    }

    updateMutation.mutate({ id: sub.id, newEnd: newEnd!.toISOString(), status });
  };

  const filtered = subscriptions?.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.organization?.name?.toLowerCase().includes(q) ||
      s.plan?.name?.toLowerCase().includes(q) ||
      s.status.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar organização ou plano..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Badge variant="outline" className="shrink-0">
          {filtered?.length ?? 0} assinaturas
        </Badge>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered?.map((sub) => (
            <Card key={sub.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-primary" />
                    {sub.organization?.name || "Org desconhecida"}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={STATUS_COLORS[sub.status] || ""}>
                      {sub.status}
                    </Badge>
                    <Badge variant="secondary">{sub.plan?.name || "—"}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Início</p>
                    <p className="font-medium">
                      {format(new Date(sub.current_period_start), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Expira</p>
                    <p className="font-medium">
                      {new Date(sub.current_period_end).getFullYear() >= 2099
                        ? "♾️ Ilimitado"
                        : format(new Date(sub.current_period_end), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Ciclo</p>
                    <p className="font-medium">{sub.billing_cycle}</p>
                  </div>
                  {sub.trial_end && (
                    <div>
                      <p className="text-muted-foreground text-xs">Fim trial</p>
                      <p className="font-medium">
                        {format(new Date(sub.trial_end), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  )}
                </div>

                {editingId === sub.id ? (
                  <div className="space-y-3 pt-2 border-t">
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <Clock className="h-4 w-4" /> Gerenciar tempo
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => adjustTime(sub, "+1m")} disabled={updateMutation.isPending}>
                        <Plus className="h-3 w-3 mr-1" /> 1 mês
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => adjustTime(sub, "+3m")} disabled={updateMutation.isPending}>
                        <Plus className="h-3 w-3 mr-1" /> 3 meses
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => adjustTime(sub, "+6m")} disabled={updateMutation.isPending}>
                        <Plus className="h-3 w-3 mr-1" /> 6 meses
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => adjustTime(sub, "+1y")} disabled={updateMutation.isPending}>
                        <Plus className="h-3 w-3 mr-1" /> 1 ano
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => adjustTime(sub, "unlimited")} disabled={updateMutation.isPending}>
                        <Infinity className="h-3 w-3 mr-1" /> Ilimitado
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => adjustTime(sub, "-1m")} disabled={updateMutation.isPending}>
                        <Minus className="h-3 w-3 mr-1" /> 1 mês
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => adjustTime(sub, "expire")} disabled={updateMutation.isPending}>
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
                      <Button size="sm" variant="secondary" onClick={() => adjustTime(sub, "custom")} disabled={updateMutation.isPending}>
                        Aplicar
                      </Button>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      Fechar
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => { setEditingId(sub.id); setCustomDays(""); }}>
                    <Clock className="h-3.5 w-3.5 mr-1.5" /> Gerenciar tempo
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}

          {filtered?.length === 0 && (
            <p className="text-center text-muted-foreground py-8">Nenhuma assinatura encontrada.</p>
          )}
        </div>
      )}
    </div>
  );
}
