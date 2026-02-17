import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, ClipboardList, Home, BarChart3, UserPlus, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRole";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function TeamOverview() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["admin-team", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .eq("organization_id", orgId);

      if (!profiles) return [];
      const userIds = profiles.map(p => p.user_id);

      const [rolesRes, leadsRes, tasksRes] = await Promise.all([
        supabase.from("user_roles").select("user_id, role").in("user_id", userIds),
        supabase.from("leads").select("broker_id").eq("organization_id", orgId).eq("is_active", true),
        supabase.from("tasks").select("assigned_to, completed").eq("organization_id", orgId).eq("completed", false),
      ]);

      return profiles.map(p => {
        const role = rolesRes.data?.find(r => r.user_id === p.user_id)?.role || "corretor";
        const activeLeads = leadsRes.data?.filter(l => l.broker_id === p.user_id).length || 0;
        const pendingTasks = tasksRes.data?.filter(t => t.assigned_to === p.user_id).length || 0;
        return { ...p, role, activeLeads, pendingTasks };
      });
    },
    enabled: !!orgId,
  });

  if (isLoading) return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>;

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {members.map(m => (
        <Card key={m.user_id}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback>{getInitials(m.full_name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{m.full_name}</p>
                <Badge variant="secondary" className="text-[10px]">{m.role}</Badge>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <p className="text-lg font-bold">{m.activeLeads}</p>
                <p className="text-[10px] text-muted-foreground">Leads ativos</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/50">
                <p className="text-lg font-bold">{m.pendingTasks}</p>
                <p className="text-[10px] text-muted-foreground">Tarefas pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function UnassignedLeads() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;
  const queryClient = useQueryClient();

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["unassigned-leads", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase
        .from("leads")
        .select("id, name, stage, created_at")
        .eq("organization_id", orgId)
        .is("broker_id", null)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!orgId,
  });

  const { data: brokers = [] } = useQuery({
    queryKey: ["org-brokers", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .eq("organization_id", orgId);
      return data || [];
    },
    enabled: !!orgId,
  });

  const assign = useMutation({
    mutationFn: async ({ leadId, brokerId }: { leadId: string; brokerId: string }) => {
      const { error } = await supabase.from("leads").update({ broker_id: brokerId }).eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unassigned-leads"] });
      toast.success("Lead atribuído com sucesso");
    },
  });

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  if (leads.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Todos os leads estão atribuídos 🎉</p>;
  }

  return (
    <div className="space-y-3">
      {leads.map(lead => (
        <div key={lead.id} className="flex items-center gap-3 p-3 border rounded-lg">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{lead.name}</p>
            <Badge variant="outline" className="text-[10px]">{lead.stage}</Badge>
          </div>
          <Select onValueChange={(brokerId) => assign.mutate({ leadId: lead.id, brokerId })}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Atribuir a..." />
            </SelectTrigger>
            <SelectContent>
              {brokers.map(b => (
                <SelectItem key={b.user_id} value={b.user_id}>{b.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  );
}

export default function Administration() {
  const { isAdminOrAbove } = useUserRoles();

  if (!isAdminOrAbove) {
    return (
      <div className="flex flex-col min-h-screen">
        <PageHeader title="Administração" description="Acesso restrito" />
        <div className="flex-1 p-6 flex items-center justify-center">
          <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader title="Administração" description="Coordene sua equipe e distribua tarefas" />
      <div className="flex-1 p-4 sm:p-6">
        <Tabs defaultValue="team" className="space-y-6">
          <TabsList className="flex-wrap">
            <TabsTrigger value="team" className="gap-2"><Users className="h-4 w-4" />Equipe</TabsTrigger>
            <TabsTrigger value="leads" className="gap-2"><UserPlus className="h-4 w-4" />Leads</TabsTrigger>
          </TabsList>

          <TabsContent value="team">
            <TeamOverview />
          </TabsContent>

          <TabsContent value="leads">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Leads não atribuídos</CardTitle>
                <CardDescription>Distribua leads para os corretores da equipe</CardDescription>
              </CardHeader>
              <CardContent>
                <UnassignedLeads />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
