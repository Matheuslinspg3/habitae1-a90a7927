import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRole";
import { useBrokers } from "@/hooks/useBrokers";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  User, FileText, Calendar, Home, CheckCircle, Filter, X, Search,
  Shield, AlertTriangle, Eye, Edit, Trash2, ArrowRightLeft, Lock,
  Activity, ChevronRight,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type AuditRow = {
  id: string;
  action: string;
  action_category: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  description: string | null;
  user_id: string | null;
  acting_role: string | null;
  target_user_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  changed_fields: string[] | null;
  module: string | null;
  source: string | null;
  status: string | null;
  risk_level: string | null;
  route: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const ACTION_ICONS: Record<string, React.ElementType> = {
  create: CheckCircle,
  read: Eye,
  update: Edit,
  delete: Trash2,
  move: ArrowRightLeft,
  security: Shield,
  admin: Lock,
};

const ENTITY_ICONS: Record<string, React.ElementType> = {
  lead: User,
  property: Home,
  contract: FileText,
  task: CheckCircle,
  appointment: Calendar,
  commission: Activity,
  user: User,
  system: Shield,
};

const MODULE_LABELS: Record<string, string> = {
  crm: "CRM",
  imoveis: "Imóveis",
  contratos: "Contratos",
  financeiro: "Financeiro",
  marketing: "Marketing",
  agenda: "Agenda",
  admin: "Admin",
  suporte: "Suporte",
};

const RISK_COLORS: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  high: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  critical: "bg-destructive/10 text-destructive border-destructive/20",
};

const STATUS_COLORS: Record<string, string> = {
  success: "",
  denied: "text-destructive",
  failed: "text-orange-600",
  error: "text-destructive",
};

function useAuditEvents() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  return useQuery({
    queryKey: ["audit-events", orgId],
    queryFn: async () => {
      if (!orgId) return { events: [] as AuditRow[], nameMap: new Map<string, string>() };

      const { data, error } = await supabase
        .from("audit_events" as any)
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      if (!data?.length) return { events: [] as AuditRow[], nameMap: new Map<string, string>() };

      const typedData = data as unknown as AuditRow[];
      const userIds = [...new Set(
        typedData
          .map((a) => a.user_id)
          .filter(Boolean) as string[]
      )];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      const nameMap = new Map(profiles?.map((p) => [p.user_id, p.full_name]) || []);
      return { events: typedData, nameMap };
    },
    enabled: !!orgId,
  });
}

function DiffViewer({ oldVal, newVal, fields }: {
  oldVal?: Record<string, unknown> | null;
  newVal?: Record<string, unknown> | null;
  fields?: string[] | null;
}) {
  const keys = fields || Object.keys({ ...oldVal, ...newVal });
  if (!keys.length) return <p className="text-xs text-muted-foreground">Sem alterações detalhadas</p>;

  return (
    <div className="space-y-1.5">
      {keys.map((key) => (
        <div key={key} className="text-xs font-mono">
          <span className="text-muted-foreground">{key}:</span>{" "}
          {oldVal?.[key] !== undefined && (
            <span className="text-destructive line-through mr-2">{String(oldVal[key] ?? "null")}</span>
          )}
          {newVal?.[key] !== undefined && (
            <span className="text-green-600">{String(newVal[key] ?? "null")}</span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function Activities({ embedded }: { embedded?: boolean } = {}) {
  const { data, isLoading } = useAuditEvents();
  const { isAdminOrAbove } = useUserRoles();
  const { brokers } = useBrokers();

  const [search, setSearch] = useState("");
  const [filterBroker, setFilterBroker] = useState("all");
  const [filterEntity, setFilterEntity] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterModule, setFilterModule] = useState("all");
  const [filterRisk, setFilterRisk] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<AuditRow | null>(null);

  const events = data?.events || [];
  const nameMap = data?.nameMap || new Map<string, string>();

  const hasFilters = search || filterBroker !== "all" || filterEntity !== "all" || filterCategory !== "all" || filterModule !== "all" || filterRisk !== "all" || dateFrom || dateTo;

  const filtered = useMemo(() => {
    return events.filter((a) => {
      if (filterBroker !== "all" && a.user_id !== filterBroker) return false;
      if (filterEntity !== "all" && a.entity_type !== filterEntity) return false;
      if (filterCategory !== "all" && a.action_category !== filterCategory) return false;
      if (filterModule !== "all" && a.module !== filterModule) return false;
      if (filterRisk !== "all" && a.risk_level !== filterRisk) return false;
      if (search) {
        const q = search.toLowerCase();
        const name = (a.entity_name || "").toLowerCase();
        const desc = (a.description || "").toLowerCase();
        const author = (nameMap.get(a.user_id || "") || "").toLowerCase();
        if (!name.includes(q) && !author.includes(q) && !desc.includes(q) && !a.action.includes(q)) return false;
      }
      if (dateFrom && a.created_at < dateFrom) return false;
      if (dateTo && a.created_at.slice(0, 10) > dateTo) return false;
      return true;
    });
  }, [events, filterBroker, filterEntity, filterCategory, filterModule, filterRisk, search, dateFrom, dateTo, nameMap]);

  const clearFilters = () => {
    setSearch(""); setFilterBroker("all"); setFilterEntity("all");
    setFilterCategory("all"); setFilterModule("all"); setFilterRisk("all");
    setDateFrom(""); setDateTo("");
  };

  const categories = useMemo(() => [...new Set(events.map((a) => a.action_category))], [events]);
  const modules = useMemo(() => [...new Set(events.map((a) => a.module).filter(Boolean))], [events]);
  const entityTypes = useMemo(() => [...new Set(events.map((a) => a.entity_type))], [events]);

  // KPI cards
  const todayCount = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return events.filter((e) => e.created_at.slice(0, 10) === today).length;
  }, [events]);
  const securityCount = useMemo(() =>
    events.filter((e) => e.status === "denied" || e.risk_level === "high" || e.risk_level === "critical").length,
    [events]);

  return (
    <div className="space-y-6">
      {!embedded && (
        <PageHeader
          title="Auditoria"
          description="Rastreie todas as ações da equipe com detalhes completos"
        />
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-bold">{events.length}</p>
            <p className="text-xs text-muted-foreground">Total de eventos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-bold">{todayCount}</p>
            <p className="text-xs text-muted-foreground">Eventos hoje</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-bold">{new Set(events.map((e) => e.user_id)).size}</p>
            <p className="text-xs text-muted-foreground">Usuários ativos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-bold text-destructive">{securityCount}</p>
            <p className="text-xs text-muted-foreground">Alertas de segurança</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[180px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nome, ação, descrição..." className="pl-9 h-9 text-sm" />
              </div>
            </div>

            {isAdminOrAbove && (
              <div className="min-w-[150px]">
                <Label className="text-xs text-muted-foreground mb-1 block">Usuário</Label>
                <Select value={filterBroker} onValueChange={setFilterBroker}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {brokers.map((b) => (
                      <SelectItem key={b.user_id} value={b.user_id}>{b.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="min-w-[120px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Módulo</Label>
              <Select value={filterModule} onValueChange={setFilterModule}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {modules.map((m) => (
                    <SelectItem key={m!} value={m!}>{MODULE_LABELS[m!] || m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-[120px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Entidade</Label>
              <Select value={filterEntity} onValueChange={setFilterEntity}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {entityTypes.map((et) => (
                    <SelectItem key={et} value={et}>{et}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-[120px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Categoria</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-[120px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Risco</Label>
              <Select value={filterRisk} onValueChange={setFilterRisk}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="low">Baixo</SelectItem>
                  <SelectItem value="medium">Médio</SelectItem>
                  <SelectItem value="high">Alto</SelectItem>
                  <SelectItem value="critical">Crítico</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-[120px]">
              <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="min-w-[120px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 text-sm" />
            </div>

            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
                <X className="h-4 w-4 mr-1" /> Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
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
                {hasFilters ? "Nenhum evento encontrado com os filtros." : "Nenhum evento de auditoria registrado ainda."}
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-3">
                {filtered.length} evento{filtered.length !== 1 ? "s" : ""}
              </p>
              <div className="space-y-0">
                {filtered.map((event) => {
                  const Icon = ACTION_ICONS[event.action_category] || ENTITY_ICONS[event.entity_type] || FileText;
                  const authorName = nameMap.get(event.user_id || "");
                  const statusClass = STATUS_COLORS[event.status || "success"] || "";
                  const riskClass = RISK_COLORS[event.risk_level || "low"] || "";

                  return (
                    <button
                      key={event.id}
                      onClick={() => setSelectedEvent(event)}
                      className="flex gap-3 py-2.5 border-b last:border-b-0 w-full text-left hover:bg-muted/50 rounded px-1 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <Icon className={`h-4 w-4 ${statusClass || "text-muted-foreground"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-medium truncate ${statusClass}`}>
                            {event.description || event.action}
                          </span>
                          {event.risk_level && event.risk_level !== "low" && (
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${riskClass}`}>
                              {event.risk_level === "critical" && <AlertTriangle className="h-3 w-3 mr-0.5" />}
                              {event.risk_level}
                            </Badge>
                          )}
                          {event.module && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              {MODULE_LABELS[event.module] || event.module}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                          {isAdminOrAbove && authorName && (
                            <span className="text-primary/80">{authorName}</span>
                          )}
                          {event.acting_role && (
                            <span className="text-muted-foreground/60">({event.acting_role})</span>
                          )}
                          <span>
                            {format(new Date(event.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 self-center shrink-0" />
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-primary" />
              Detalhes do Evento
            </DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Ação</p>
                  <p className="font-mono text-xs">{selectedEvent.action}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Categoria</p>
                  <p>{selectedEvent.action_category}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Entidade</p>
                  <p>{selectedEvent.entity_type} {selectedEvent.entity_id && <span className="font-mono text-xs text-muted-foreground">({selectedEvent.entity_id.slice(0, 8)}…)</span>}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Módulo</p>
                  <p>{MODULE_LABELS[selectedEvent.module || ""] || selectedEvent.module || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Usuário</p>
                  <p>{nameMap.get(selectedEvent.user_id || "") || selectedEvent.user_id?.slice(0, 8) || "sistema"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Role</p>
                  <p>{selectedEvent.acting_role || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant="outline" className={STATUS_COLORS[selectedEvent.status || "success"]}>
                    {selectedEvent.status || "success"}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Risco</p>
                  <Badge variant="outline" className={RISK_COLORS[selectedEvent.risk_level || "low"]}>
                    {selectedEvent.risk_level || "low"}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Source</p>
                  <p>{selectedEvent.source || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Rota</p>
                  <p className="font-mono text-xs">{selectedEvent.route || "—"}</p>
                </div>
              </div>

              {selectedEvent.description && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Descrição</p>
                  <p className="bg-muted rounded p-2 text-xs">{selectedEvent.description}</p>
                </div>
              )}

              {(selectedEvent.old_values || selectedEvent.new_values) && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Alterações</p>
                  <div className="bg-muted rounded p-2">
                    <DiffViewer
                      oldVal={selectedEvent.old_values}
                      newVal={selectedEvent.new_values}
                      fields={selectedEvent.changed_fields}
                    />
                  </div>
                </div>
              )}

              {selectedEvent.metadata && Object.keys(selectedEvent.metadata).length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Metadata</p>
                  <pre className="bg-muted rounded p-2 text-xs overflow-x-auto">
                    {JSON.stringify(selectedEvent.metadata, null, 2)}
                  </pre>
                </div>
              )}

              <p className="text-xs text-muted-foreground text-right">
                {format(new Date(selectedEvent.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
