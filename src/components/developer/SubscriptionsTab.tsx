import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, Building2, Clock, Infinity, Plus, Minus, Loader2, User, ChevronDown, ChevronRight } from "lucide-react";
import { format, addMonths, addDays, addYears } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface OrgUser {
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
}

interface OrgRow {
  id: string;
  name: string;
  is_active: boolean;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  users: OrgUser[];
}

export function SubscriptionsTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [customDays, setCustomDays] = useState("");
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());

  const { data: orgs, isLoading } = useQuery({
    queryKey: ["dev-org-subscriptions"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("admin-subscriptions", {
        method: "GET",
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.error) throw new Error(res.error.message || "Erro ao buscar dados");
      return res.data as OrgRow[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ orgId, trialEndsAt, trialStartedAt }: { orgId: string; trialEndsAt: string; trialStartedAt?: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("admin-subscriptions", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: { org_id: orgId, trial_ends_at: trialEndsAt, trial_started_at: trialStartedAt },
      });
      if (res.error) throw new Error(res.error.message || "Erro ao atualizar");
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
    const base = current < new Date() ? new Date() : current;
    let newEnd: Date;

    switch (action) {
      case "+1m": newEnd = addMonths(base, 1); break;
      case "+3m": newEnd = addMonths(base, 3); break;
      case "+6m": newEnd = addMonths(base, 6); break;
      case "+1y": newEnd = addYears(base, 1); break;
      case "unlimited": newEnd = new Date("2099-12-31T23:59:59Z"); break;
      case "-1m": newEnd = addMonths(current, -1); break;
      case "expire": newEnd = new Date(); break;
      case "custom": {
        const days = parseInt(customDays);
        if (isNaN(days)) { toast.error("Informe um número válido de dias"); return; }
        newEnd = addDays(base, days);
        break;
      }
      default: return;
    }

    updateMutation.mutate({
      orgId: org.id,
      trialEndsAt: newEnd!.toISOString(),
      trialStartedAt: org.trial_started_at || new Date().toISOString(),
    });
  };

  const toggleExpand = (orgId: string) => {
    setExpandedOrgs(prev => {
      const next = new Set(prev);
      if (next.has(orgId)) next.delete(orgId); else next.add(orgId);
      return next;
    });
  };

  const filtered = orgs?.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      o.name.toLowerCase().includes(q) ||
      STATUS_LABELS[getStatus(o)]?.toLowerCase().includes(q) ||
      o.users.some(u => u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar organização ou usuário..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Badge variant="outline" className="shrink-0">{filtered?.length ?? 0} organizações</Badge>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered?.map((org) => {
            const status = getStatus(org);
            const isExpanded = expandedOrgs.has(org.id);
            return (
              <Card key={org.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      {org.name}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={STATUS_COLORS[status] || ""}>{STATUS_LABELS[status]}</Badge>
                      {!org.is_active && <Badge variant="destructive">Inativa</Badge>}
                      <Badge variant="secondary">{org.users.length} usuário{org.users.length !== 1 ? "s" : ""}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Início trial</p>
                      <p className="font-medium">
                        {org.trial_started_at ? format(new Date(org.trial_started_at), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Expira em</p>
                      <p className="font-medium">
                        {!org.trial_ends_at ? "—" : new Date(org.trial_ends_at).getFullYear() >= 2099 ? "♾️ Ilimitado" : format(new Date(org.trial_ends_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Status</p>
                      <p className="font-medium">{org.is_active ? "Ativa" : "Inativa"}</p>
                    </div>
                  </div>

                  {/* Users collapsible */}
                  <Collapsible open={isExpanded} onOpenChange={() => toggleExpand(org.id)}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <User className="h-3.5 w-3.5" />
                        Ver usuários ({org.users.length})
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2 space-y-1.5 pl-2 border-l-2 border-border ml-2">
                        {org.users.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2">Nenhum usuário vinculado</p>
                        ) : (
                          org.users.map((u) => (
                            <div key={u.user_id} className="flex items-center gap-3 py-1.5 px-2 rounded-md text-sm hover:bg-muted/50">
                              <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <div className="min-w-0">
                                <p className="font-medium truncate">{u.full_name || "Sem nome"}</p>
                                <p className="text-xs text-muted-foreground truncate">{u.email}{u.phone ? ` • ${u.phone}` : ""}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  {editingId === org.id ? (
                    <div className="space-y-3 pt-2 border-t">
                      <p className="text-sm font-medium flex items-center gap-1.5"><Clock className="h-4 w-4" /> Gerenciar tempo</p>
                      <div className="flex flex-wrap gap-2">
                        {[{ label: "1 mês", action: "+1m" }, { label: "3 meses", action: "+3m" }, { label: "6 meses", action: "+6m" }, { label: "1 ano", action: "+1y" }].map(({ label, action }) => (
                          <Button key={action} size="sm" variant="outline" onClick={() => adjustTime(org, action)} disabled={updateMutation.isPending}>
                            <Plus className="h-3 w-3 mr-1" /> {label}
                          </Button>
                        ))}
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
                        <Input type="number" placeholder="Dias (+/-)" value={customDays} onChange={(e) => setCustomDays(e.target.value)} className="w-28" />
                        <Button size="sm" variant="secondary" onClick={() => adjustTime(org, "custom")} disabled={updateMutation.isPending}>Aplicar</Button>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Fechar</Button>
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
          {filtered?.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhuma organização encontrada.</p>}
        </div>
      )}
    </div>
  );
}
