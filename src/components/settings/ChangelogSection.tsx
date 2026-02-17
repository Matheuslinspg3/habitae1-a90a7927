import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { User, Home, FileText, Calendar, CheckCircle, Users, History, Loader2 } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useInfiniteQuery } from "@tanstack/react-query";
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
};

export function ChangelogSection() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;
  const [entityFilter, setEntityFilter] = useState<string>("all");

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ["changelog", orgId, entityFilter],
    queryFn: async ({ pageParam = 0 }) => {
      if (!orgId) return { items: [], nextOffset: null };
      let query = supabase
        .from("activity_log")
        .select("id, action_type, entity_type, entity_name, created_at, user_id")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);

      if (entityFilter !== "all") {
        query = query.eq("entity_type", entityFilter);
      }

      const { data: items, error } = await query;
      if (error) throw error;

      // Fetch names
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

  const allItems = data?.pages.flatMap(p => p.items) || [];

  return (
    <div className="grid gap-6 max-w-2xl">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Histórico de Atividades
              </CardTitle>
              <CardDescription>Todas as ações realizadas na plataforma</CardDescription>
            </div>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="lead">Leads</SelectItem>
                <SelectItem value="property">Imóveis</SelectItem>
                <SelectItem value="task">Tarefas</SelectItem>
                <SelectItem value="contract">Contratos</SelectItem>
                <SelectItem value="appointment">Agendamentos</SelectItem>
              </SelectContent>
            </Select>
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
                const Icon = entityIcons[item.entity_type] || CheckCircle;
                return (
                  <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="mt-0.5 text-muted-foreground">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-medium">{entityLabels[item.entity_type] || item.entity_type}</span>
                        {" "}
                        <span className="text-muted-foreground">{actionLabels[item.action_type] || item.action_type}</span>
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
    </div>
  );
}
