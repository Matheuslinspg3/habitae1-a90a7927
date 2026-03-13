import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, UserPlus, Shield, History, LayoutDashboard } from "lucide-react";
import { useUserRoles } from "@/hooks/useUserRole";
import { TeamDashboard } from "@/components/admin/TeamDashboard";
import { CustomRolesManager } from "@/components/admin/CustomRolesManager";
import { MemberHistory } from "@/components/admin/MemberHistory";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
      {leads.map((lead) => (
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
              {brokers.map((b) => (
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
    <div className="flex flex-col min-h-screen" data-clarity-mask="true">
      <PageHeader title="Administração" description="Coordene sua equipe, gerencie cargos e permissões" />
      <div className="flex-1 p-4 sm:p-6">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="flex-wrap">
            <TabsTrigger value="dashboard" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="leads" className="gap-2">
              <UserPlus className="h-4 w-4" />
              Leads
            </TabsTrigger>
            <TabsTrigger value="roles" className="gap-2">
              <Shield className="h-4 w-4" />
              Cargos
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <TeamDashboard />
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

          <TabsContent value="roles">
            <CustomRolesManager />
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Histórico de Membros
                </CardTitle>
                <CardDescription>Registro de entradas e saídas da organização</CardDescription>
              </CardHeader>
              <CardContent>
                <MemberHistory />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
