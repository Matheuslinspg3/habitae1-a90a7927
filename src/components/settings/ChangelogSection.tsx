import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Home, FileText, Calendar, CheckCircle, Users, History, Loader2, Eye, MousePointer, Activity, MessageCircle } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

const PAGE_SIZE = 20;

const entityIcons: Record<string, React.ElementType> = {
  lead: Users, property: Home, task: CheckCircle, contract: FileText, appointment: Calendar,
};

const entityLabels: Record<string, string> = {
  lead: "Lead", property: "Imóvel", task: "Tarefa", contract: "Contrato", appointment: "Agendamento",
};

const actionLabels: Record<string, string> = {
  created: "criado", completed: "concluído", updated: "atualizado", deleted: "removido",
  viewed: "visualizado", assigned: "atribuído", stage_changed: "etapa alterada",
  interaction: "interação registrada",
};

const actionColors: Record<string, string> = {
  created: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  completed: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  updated: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  deleted: "bg-destructive/10 text-destructive",
  viewed: "bg-muted text-muted-foreground",
  assigned: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  stage_changed: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  interaction: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
};

export function ChangelogSection() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [brokerFilter, setBrokerFilter] = useState<string>("all");

  // Fetch team members for broker filter
  const { data: teamMembers = [] } = useQuery({
    queryKey: ["team-members-changelog", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .eq("organization_id", orgId);
      return profiles || [];
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });

  // Activity log with filters
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ["changelog", orgId, entityFilter, brokerFilter],
    queryFn: async ({ pageParam = 0 }) => {
      if (!orgId) return { items: [], nextOffset: null };
      let query = supabase
        .from("activity_log")
        .select("id, action_type, entity_type, entity_name, created_at, user_id, metadata")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);

      if (entityFilter !== "all") query = query.eq("entity_type", entityFilter);
      if (brokerFilter !== "all") query = query.eq("user_id", brokerFilter);

      const { data: items, error } = await query;
      if (error) throw error;

      const userIds = [...new Set((items || []).map(a => a.user_id))];
      const { data: profiles } = userIds.length > 0
        ? await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds)
        : { data: [] };
      const nameMap = new Map((profiles || []).map(p => [p.user_id, p.full_name] as const));

      return {
        items: (items || []).map(a => ({ ...a, author: nameMap.get(a.user_id) || "Usuário" })),
        nextOffset: items && items.length === PAGE_SIZE ? pageParam + PAGE_SIZE : null,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    enabled: !!orgId,
  });

  // Broker summary stats
  const { data: brokerStats = [] } = useQuery({
    queryKey: ["broker-activity-stats", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .eq("organization_id", orgId);
      if (!profiles) return [];

      const userIds = profiles.map(p => p.user_id);

      // Count activities per user (last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: activities } = await supabase
        .from("activity_log")
        .select("user_id, action_type, entity_type")
        .eq("organization_id", orgId)
        .gte("created_at", sevenDaysAgo)
        .in("user_id", userIds);

      // Count active leads per broker
      const { data: leads } = await supabase
        .from("leads")
        .select("broker_id")
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .in("broker_id", userIds);

      // Get roles
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      return profiles.map(p => {
        const userActivities = (activities || []).filter(a => a.user_id === p.user_id);
        const role = roles?.find(r => r.user_id === p.user_id)?.role || "corretor";
        const activeLeads = (leads || []).filter(l => l.broker_id === p.user_id).length;
        const totalActions = userActivities.length;
        const leadActions = userActivities.filter(a => a.entity_type === "lead").length;
        const propertyActions = userActivities.filter(a => a.entity_type === "property").length;

        return {
          user_id: p.user_id,
          full_name: p.full_name,
          role,
          activeLeads,
          totalActions,
          leadActions,
          propertyActions,
        };
      }).sort((a, b) => b.totalActions - a.totalActions);
    },
    enabled: !!orgId,
    staleTime: 2 * 60 * 1000,
  });

  const allItems = data?.pages.flatMap(p => p.items) || [];

  const roleLabel = (role: string) => {
    switch (role) {
      case "admin": return "Dono";
      case "sub_admin": return "Sub-Dono";
      case "developer": return "Developer";
      case "leader": return "Leader";
      case "assistente": return "Assistente";
      default: return "Corretor";
    }
  };

  return (
    <div className="grid gap-6 max-w-4xl">
      <Tabs defaultValue="timeline" className="space-y-4">
        <TabsList>
          <TabsTrigger value="timeline" className="gap-2">
            <History className="h-4 w-4" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="brokers" className="gap-2">
            <Users className="h-4 w-4" />
            Por Corretor
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="h-5 w-5" />
                    Histórico de Atividades
                  </CardTitle>
                  <CardDescription>Todas as ações e interações na plataforma</CardDescription>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Select value={brokerFilter} onValueChange={setBrokerFilter}>
                    <SelectTrigger className="w-44">
                      <SelectValue placeholder="Todos os membros" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os membros</SelectItem>
                      {teamMembers.map(m => (
                        <SelectItem key={m.user_id} value={m.user_id}>{m.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={entityFilter} onValueChange={setEntityFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Filtrar por tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os tipos</SelectItem>
                      <SelectItem value="lead">Leads</SelectItem>
                      <SelectItem value="property">Imóveis</SelectItem>
                      <SelectItem value="task">Tarefas</SelectItem>
                      <SelectItem value="contract">Contratos</SelectItem>
                      <SelectItem value="appointment">Agendamentos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : allItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma atividade registrada ainda.</p>
              ) : (
                <div className="space-y-1">
                  {allItems.map((item) => {
                    const Icon = item.action_type === "interaction" ? MessageCircle : (entityIcons[item.entity_type] || CheckCircle);
                    const colorClass = actionColors[item.action_type] || "bg-muted text-muted-foreground";
                    return (
                      <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className={`mt-0.5 p-1.5 rounded-md ${colorClass}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">
                            <span className="font-medium">{entityLabels[item.entity_type] || item.entity_type}</span>
                            {" "}
                            <span className="text-muted-foreground">{actionLabels[item.action_type] || item.action_type}</span>
                            {item.action_type === "interaction" && (item.metadata as any)?.interaction_label && (
                              <span className="text-muted-foreground"> ({(item.metadata as any).interaction_label})</span>
                            )}
                            {item.entity_name && (
                              <span className="font-medium">: {item.entity_name}</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            por <span className="font-medium">{String(item.author)}</span> · {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ptBR })}
                          </p>
                        </div>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {format(new Date(item.created_at), "dd/MM HH:mm")}
                        </span>
                      </div>
                    );
                  })}
                  {hasNextPage && (
                    <Button
                      variant="ghost"
                      className="w-full mt-2"
                      onClick={() => fetchNextPage()}
                      disabled={isFetchingNextPage}
                    >
                      {isFetchingNextPage && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Carregar mais
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="brokers">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Eye className="h-5 w-5" />
                Atividade por Membro
              </CardTitle>
              <CardDescription>Resumo de ações dos últimos 7 dias por membro da equipe</CardDescription>
            </CardHeader>
            <CardContent>
              {brokerStats.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum membro encontrado.</p>
              ) : (
                <div className="space-y-3">
                  {brokerStats.map((broker) => (
                    <div
                      key={broker.user_id}
                      className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => {
                        setBrokerFilter(broker.user_id);
                        // Switch to timeline tab
                        const timelineTab = document.querySelector('[data-state][value="timeline"]') as HTMLButtonElement;
                        timelineTab?.click();
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{broker.full_name}</p>
                          <Badge variant="secondary" className="text-[10px]">
                            {roleLabel(broker.role)}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {broker.activeLeads} leads ativos
                        </p>
                      </div>
                      <div className="flex gap-3 text-center shrink-0">
                        <div className="px-3 py-1.5 rounded-md bg-muted/50">
                          <p className="text-lg font-bold">{broker.totalActions}</p>
                          <p className="text-[10px] text-muted-foreground">Ações</p>
                        </div>
                        <div className="px-3 py-1.5 rounded-md bg-muted/50">
                          <p className="text-lg font-bold">{broker.leadActions}</p>
                          <p className="text-[10px] text-muted-foreground">Leads</p>
                        </div>
                        <div className="px-3 py-1.5 rounded-md bg-muted/50">
                          <p className="text-lg font-bold">{broker.propertyActions}</p>
                          <p className="text-[10px] text-muted-foreground">Imóveis</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
