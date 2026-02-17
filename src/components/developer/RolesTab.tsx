import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Shield, UserCog } from "lucide-react";

const roleBadgeVariant = (role: string) => {
  switch (role) {
    case "developer": return "destructive" as const;
    case "leader": return "default" as const;
    default: return "secondary" as const;
  }
};

export function RolesTab() {
  const queryClient = useQueryClient();
  const [newRoleUserId, setNewRoleUserId] = useState("");
  const [newRoleType, setNewRoleType] = useState<AppRole>("leader");

  const { data: allRoles = [] } = useQuery({
    queryKey: ["all-user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("id, user_id, role, created_at");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: allProfiles = [] } = useQuery({
    queryKey: ["all-profiles-dev"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, full_name, organization_id");
      if (error) throw error;
      return data || [];
    },
  });

  const getProfileName = (userId: string) => {
    return allProfiles.find((p) => p.user_id === userId)?.full_name || userId.slice(0, 8) + "...";
  };

  const addRole = useMutation({
    mutationFn: async () => {
      const profile = allProfiles.find(
        (p) => p.full_name?.toLowerCase().includes(newRoleUserId.toLowerCase()) || p.user_id === newRoleUserId
      );
      if (!profile) throw new Error("Usuário não encontrado");
      const { error } = await supabase.from("user_roles").insert({ user_id: profile.user_id, role: newRoleType });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-user-roles"] });
      toast({ title: "Role adicionado com sucesso" });
      setNewRoleUserId("");
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const removeRole = useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await supabase.from("user_roles").delete().eq("id", roleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-user-roles"] });
      toast({ title: "Role removido" });
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UserCog className="h-4 w-4" />
            Adicionar Role
          </CardTitle>
          <CardDescription>Atribua roles de developer ou leader a usuários</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-col sm:flex-row">
            <Input
              placeholder="Nome ou ID do usuário"
              value={newRoleUserId}
              onChange={(e) => setNewRoleUserId(e.target.value)}
              className="sm:max-w-xs"
            />
            <div className="flex gap-2">
              <Select value={newRoleType} onValueChange={(v) => setNewRoleType(v as AppRole)}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="developer">Developer</SelectItem>
                  <SelectItem value="leader">Leader</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => addRole.mutate()} disabled={!newRoleUserId || addRole.isPending} size="sm">
                <Plus className="h-4 w-4 mr-1" /> Adicionar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Roles Ativos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-5 sm:-mx-6 px-5 sm:px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden sm:table-cell">Desde</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allRoles.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{getProfileName(r.user_id)}</TableCell>
                    <TableCell><Badge variant={roleBadgeVariant(r.role)}>{r.role}</Badge></TableCell>
                    <TableCell className="text-muted-foreground text-sm hidden sm:table-cell">
                      {new Date(r.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeRole.mutate(r.id)} disabled={removeRole.isPending}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {allRoles.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Nenhum role especial atribuído
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
