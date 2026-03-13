import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UserPlus, UserMinus, LogOut } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const EVENT_CONFIG: Record<string, { label: string; icon: typeof UserPlus; variant: "default" | "destructive" | "secondary" }> = {
  joined: { label: "Entrou", icon: UserPlus, variant: "default" },
  removed: { label: "Removido", icon: UserMinus, variant: "destructive" },
  left: { label: "Saiu", icon: LogOut, variant: "secondary" },
};

export function MemberHistory() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["member-events", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("organization_member_events")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });

  if (isLoading) {
    return <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>;
  }

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          Nenhum evento de entrada/saída registrado ainda.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {events.map((ev: any) => {
        const config = EVENT_CONFIG[ev.event_type] || EVENT_CONFIG.joined;
        const Icon = config.icon;
        const memberName = ev.metadata?.member_name || ev.user_id?.slice(0, 8);
        return (
          <div key={ev.id} className="flex items-center gap-3 p-3 border rounded-lg">
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                <span className="font-medium">{memberName}</span>{" "}
                {ev.event_type === "removed" ? "foi removido" : ev.event_type === "left" ? "saiu" : "entrou"}
              </p>
              {ev.reason && (
                <p className="text-xs text-muted-foreground truncate">Motivo: {ev.reason}</p>
              )}
            </div>
            <Badge variant={config.variant} className="text-[10px] shrink-0">
              {config.label}
            </Badge>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {format(new Date(ev.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
            </span>
          </div>
        );
      })}
    </div>
  );
}
