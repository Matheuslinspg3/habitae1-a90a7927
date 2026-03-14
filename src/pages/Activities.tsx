import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRole";
import { useBrokers } from "@/hooks/useBrokers";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  User,
  FileText,
  Calendar,
  DollarSign,
  Home,
  CheckCircle,
  Filter,
  X,
  Search,
  Users,
  Phone,
  Mail,
  MapPin,
  MessageCircle,
  Zap,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type ActivityRow = {
  id: string;
  action_type: string;
  entity_type: string;
  entity_name: string | null;
  created_at: string;
  user_id: string;
  metadata: Record<string, unknown> | null;
};

const ACTION_LABELS: Record<string, string> = {
  created: "Criado",
  updated: "Atualizado",
  deleted: "Removido",
  viewed: "Visualizado",
  assigned: "Atribuído",
  stage_changed: "Etapa alterada",
  interaction: "Interação",
  completed: "Concluído",
};

const ENTITY_LABELS: Record<string, string> = {
  lead: "Lead",
  property: "Imóvel",
  task: "Tarefa",
  contract: "Contrato",
  appointment: "Agendamento",
};

const ICON_MAP: Record<string, React.ElementType> = {
  lead: User,
  property: Home,
  task: CheckCircle,
  contract: FileText,
  appointment: Calendar,
};

const COLOR_MAP: Record<string, string> = {
  lead: "text-green-500",
  property: "text-purple-500",
  task: "text-sky-500",
  contract: "text-blue-500",
  appointment: "text-amber-500",
};

function useActivities() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  return useQuery({
    queryKey: ["activities-page", orgId],
    queryFn: async () => {
      if (!orgId) return { activities: [] as ActivityRow[], nameMap: new Map<string, string>() };

      const { data, error } = await supabase
        .from("activity_log")
        .select("id, action_type, entity_type, entity_name, created_at, user_id, metadata")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      if (!data || data.length === 0) return { activities: [] as ActivityRow[], nameMap: new Map<string, string>() };

      const userIds = [...new Set(data.map((a) => a.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      const nameMap = new Map(profiles?.map((p) => [p.user_id, p.full_name]) || []);

      return { activities: data as ActivityRow[], nameMap };
    },
    enabled: !!orgId,
  });
}

export default function Activities({ embedded }: { embedded?: boolean } = {}) {
  const { data, isLoading } = useActivities();
  const { isAdminOrAbove } = useUserRoles();
  const { brokers } = useBrokers();

  const [search, setSearch] = useState("");
  const [filterBroker, setFilterBroker] = useState("all");
  const [filterEntity, setFilterEntity] = useState("all");
  const [filterAction, setFilterAction] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const activities = data?.activities || [];
  const nameMap = data?.nameMap || new Map<string, string>();

  const hasFilters = search || filterBroker !== "all" || filterEntity !== "all" || filterAction !== "all" || dateFrom || dateTo;

  const filtered = useMemo(() => {
    return activities.filter((a) => {
      if (filterBroker !== "all" && a.user_id !== filterBroker) return false;
      if (filterEntity !== "all" && a.entity_type !== filterEntity) return false;
      if (filterAction !== "all" && a.action_type !== filterAction) return false;
      if (search) {
        const q = search.toLowerCase();
        const name = (a.entity_name || "").toLowerCase();
        const author = (nameMap.get(a.user_id) || "").toLowerCase();
        if (!name.includes(q) && !author.includes(q)) return false;
      }
      if (dateFrom && a.created_at < dateFrom) return false;
      if (dateTo && a.created_at < dateTo === false && a.created_at.slice(0, 10) > dateTo) return false;
      return true;
    });
  }, [activities, filterBroker, filterEntity, filterAction, search, dateFrom, dateTo, nameMap]);

  const clearFilters = () => {
    setSearch("");
    setFilterBroker("all");
    setFilterEntity("all");
    setFilterAction("all");
    setDateFrom("");
    setDateTo("");
  };

  // Unique action types from data
  const actionTypes = useMemo(() => [...new Set(activities.map((a) => a.action_type))], [activities]);
  const entityTypes = useMemo(() => [...new Set(activities.map((a) => a.entity_type))], [activities]);

  return (
    <div className="space-y-6">
      {!embedded && (
        <PageHeader
          title="Atividades"
          description="Acompanhe todas as atividades da equipe"
        />
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[180px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nome, entidade..."
                  className="pl-9 h-9 text-sm"
                />
              </div>
            </div>

            {isAdminOrAbove && (
              <div className="min-w-[160px]">
                <Label className="text-xs text-muted-foreground mb-1 block">Corretor</Label>
                <Select value={filterBroker} onValueChange={setFilterBroker}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {brokers.map((b) => (
                      <SelectItem key={b.user_id} value={b.user_id}>
                        {b.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="min-w-[140px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Tipo</Label>
              <Select value={filterEntity} onValueChange={setFilterEntity}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {entityTypes.map((et) => (
                    <SelectItem key={et} value={et}>
                      {ENTITY_LABELS[et] || et}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-[140px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Ação</Label>
              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {actionTypes.map((at) => (
                    <SelectItem key={at} value={at}>
                      {ACTION_LABELS[at] || at}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-[130px]">
              <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            <div className="min-w-[130px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
                <X className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-start gap-3 p-2">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Filter className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                {hasFilters ? "Nenhuma atividade encontrada com os filtros selecionados." : "Nenhuma atividade registrada ainda."}
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-3">
                {filtered.length} atividade{filtered.length !== 1 ? "s" : ""}
              </p>
              <div className="space-y-0">
                {filtered.map((activity, index) => {
                  const Icon = ICON_MAP[activity.entity_type] || FileText;
                  const colorClass = COLOR_MAP[activity.entity_type] || "text-muted-foreground";
                  const authorName = nameMap.get(activity.user_id);
                  const actionLabel = ACTION_LABELS[activity.action_type] || activity.action_type;
                  const entityLabel = ENTITY_LABELS[activity.entity_type] || activity.entity_type;

                  // Interaction metadata
                  const meta = activity.metadata as Record<string, unknown> | null;
                  const interactionLabel = meta?.interaction_label as string | undefined;

                  return (
                    <div
                      key={activity.id}
                      className="flex gap-3 py-2.5 border-b last:border-b-0"
                    >
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 ${colorClass}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">
                            {interactionLabel
                              ? `${interactionLabel} – ${activity.entity_name || ""}`
                              : `${actionLabel}: ${activity.entity_name || entityLabel}`}
                          </span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {entityLabel}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                          {isAdminOrAbove && authorName && (
                            <span className="text-primary/80">por {authorName}</span>
                          )}
                          <span>
                            {format(new Date(activity.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                          </span>
                          <span className="hidden sm:inline">
                            ({formatDistanceToNow(new Date(activity.created_at), { addSuffix: true, locale: ptBR })})
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
