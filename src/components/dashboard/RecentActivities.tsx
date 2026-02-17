import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Inbox, User, FileText, Calendar, DollarSign, Home, CheckCircle, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDemo } from "@/contexts/DemoContext";
import { demoActivities, type DemoActivity } from "@/data/demoData";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRole";
import { Skeleton } from "@/components/ui/skeleton";

type ActivityItem = {
  id: string;
  title: string;
  description: string;
  type: 'lead_created' | 'contract_signed' | 'appointment_scheduled' | 'commission_received' | 'property_created' | 'task_completed';
  icon: 'user' | 'file' | 'calendar' | 'dollar' | 'home' | 'check';
  timestamp: string;
  author?: string;
};

const iconMap: Record<ActivityItem['icon'], React.ElementType> = {
  user: User, file: FileText, calendar: Calendar, dollar: DollarSign, home: Home, check: CheckCircle,
};

const colorMap: Record<ActivityItem['type'], string> = {
  lead_created: 'text-green-500', contract_signed: 'text-blue-500',
  appointment_scheduled: 'text-amber-500', commission_received: 'text-emerald-500',
  property_created: 'text-purple-500', task_completed: 'text-sky-500',
};

const actionTypeMap: Record<string, { type: ActivityItem['type']; icon: ActivityItem['icon']; label: string }> = {
  'lead:created': { type: 'lead_created', icon: 'user', label: 'Novo lead' },
  'property:created': { type: 'property_created', icon: 'home', label: 'Imóvel cadastrado' },
  'task:created': { type: 'task_completed', icon: 'check', label: 'Nova tarefa' },
  'task:completed': { type: 'task_completed', icon: 'check', label: 'Tarefa concluída' },
  'contract:created': { type: 'contract_signed', icon: 'file', label: 'Novo contrato' },
  'appointment:created': { type: 'appointment_scheduled', icon: 'calendar', label: 'Agendamento criado' },
};

function useRecentActivities() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  return useQuery({
    queryKey: ['dashboard-activities', orgId],
    queryFn: async () => {
      if (!orgId) return [];

      const { data, error } = await supabase
        .from('activity_log')
        .select('id, action_type, entity_type, entity_name, created_at, user_id')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Fetch author names
      const userIds = [...new Set(data.map(a => a.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);

      const nameMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

      return data.map(a => {
        const key = `${a.entity_type}:${a.action_type}`;
        const mapping = actionTypeMap[key] || { type: 'task_completed' as const, icon: 'check' as const, label: a.action_type };
        return {
          id: a.id,
          title: `${mapping.label}: ${a.entity_name || ''}`.trim(),
          description: a.entity_name || '',
          type: mapping.type,
          icon: mapping.icon,
          timestamp: a.created_at,
          author: nameMap.get(a.user_id) || undefined,
        };
      });
    },
    enabled: !!orgId,
  });
}

export function RecentActivities() {
  const navigate = useNavigate();
  const { isDemoMode } = useDemo();
  const { isAdminOrAbove } = useUserRoles();

  const { data: realActivities = [], isLoading } = useRecentActivities();

  const displayActivities: ActivityItem[] = isDemoMode
    ? (demoActivities.slice(0, 5) as ActivityItem[])
    : realActivities;

  if (!isDemoMode && isLoading) {
    return (
      <Card className="group">
        <CardHeader>
          <CardTitle className="text-xl font-display">Atividades Recentes</CardTitle>
          <CardDescription>Últimas atualizações do sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-start gap-3 p-2">
              <Skeleton className="h-4 w-4 mt-0.5 rounded" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (displayActivities.length === 0) {
    return (
      <Card className="group">
        <CardHeader>
          <CardTitle className="text-xl font-display">Atividades Recentes</CardTitle>
          <CardDescription>Últimas atualizações do sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <Inbox className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="font-medium text-muted-foreground">Aqui você verá tudo o que acontece</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Cadastre imóveis, leads e acompanhe suas negociações em tempo real
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="group">
      <CardHeader>
        <CardTitle className="text-xl font-display">Atividades Recentes</CardTitle>
        <CardDescription>Acompanhe tudo que acontece no seu negócio</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {displayActivities.map((activity) => {
          const Icon = iconMap[activity.icon];
          const colorClass = colorMap[activity.type];
          const timeAgo = formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true, locale: ptBR });

          return (
            <div key={activity.id} className="flex items-start gap-3 p-2 rounded-lg transition-colors hover:bg-muted/50">
              <div className={`mt-0.5 ${colorClass}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight">{activity.title}</p>
                {isAdminOrAbove && activity.author && (
                  <p className="text-xs text-primary/80">por {activity.author}</p>
                )}
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo}</span>
            </div>
          );
        })}

        <Button
          variant="ghost"
          className="w-full justify-between text-muted-foreground hover:text-foreground"
          onClick={() => navigate('/configuracoes?tab=changelog')}
        >
          Ver todas as atividades
          <ArrowRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
