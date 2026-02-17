import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Home, Users, Building2, CreditCard, FileText, Calendar,
  CheckSquare, TrendingUp, Activity, Zap
} from "lucide-react";

interface MetricItem {
  label: string;
  value: number | string;
  icon: React.ElementType;
  trend?: string;
}

export function SystemHealthCard() {
  const { data: metrics } = useQuery({
    queryKey: ["dev-metrics"],
    queryFn: async () => {
      const [props, profiles, orgs, leads, contracts, tasks, appointments] = await Promise.all([
        supabase.from("properties").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("organizations").select("id", { count: "exact", head: true }),
        supabase.from("leads").select("id", { count: "exact", head: true }),
        supabase.from("contracts").select("id", { count: "exact", head: true }),
        supabase.from("tasks").select("id", { count: "exact", head: true }),
        supabase.from("appointments").select("id", { count: "exact", head: true }),
      ]);
      return {
        properties: props.count || 0,
        users: profiles.count || 0,
        organizations: orgs.count || 0,
        leads: leads.count || 0,
        contracts: contracts.count || 0,
        tasks: tasks.count || 0,
        appointments: appointments.count || 0,
      };
    },
  });

  const items: MetricItem[] = [
    { label: "Imóveis", value: metrics?.properties ?? "—", icon: Home },
    { label: "Usuários", value: metrics?.users ?? "—", icon: Users },
    { label: "Organizações", value: metrics?.organizations ?? "—", icon: Building2 },
    { label: "Leads", value: metrics?.leads ?? "—", icon: CreditCard },
    { label: "Contratos", value: metrics?.contracts ?? "—", icon: FileText },
    { label: "Tarefas", value: metrics?.tasks ?? "—", icon: CheckSquare },
    { label: "Agendamentos", value: metrics?.appointments ?? "—", icon: Calendar },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Visão Geral do Sistema
        </h2>
        <Badge variant="outline" className="gap-1 text-xs">
          <Zap className="h-3 w-3" />
          Live
        </Badge>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {items.map((item) => (
          <Card key={item.label} className="group hover:shadow-md transition-shadow">
            <CardContent className="p-3 text-center">
              <item.icon className="h-4 w-4 mx-auto mb-1.5 text-muted-foreground group-hover:text-primary transition-colors" />
              <p className="text-xl font-bold tabular-nums">
                {typeof item.value === 'number' ? item.value.toLocaleString("pt-BR") : item.value}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{item.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
