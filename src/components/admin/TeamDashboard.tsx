import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Users, Search, UserMinus, Activity, Home, FileText, Clock,
  TrendingUp, CircleDot, Shield,
} from "lucide-react";
import { useTeamMembers, useRemoveMember, TeamMember } from "@/hooks/useTeamMembers";
import { useCustomRoles } from "@/hooks/useCustomRoles";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles, AppRole } from "@/hooks/useUserRole";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const ROLE_LABELS: Record<string, string> = {
  admin: "Dono",
  sub_admin: "Sub-Dono",
  corretor: "Corretor",
  assistente: "Assistente",
  leader: "Leader",
  developer: "Developer",
};

// Hierarchy: higher index = higher privilege
const ROLE_HIERARCHY: Record<string, number> = {
  assistente: 1,
  corretor: 2,
  leader: 3,
  sub_admin: 4,
  admin: 5,
  developer: 6,
};

function getManageableRoles(currentUserRoles: AppRole[]): AppRole[] {
  const isDev = currentUserRoles.includes("developer");
  const isAdmin = currentUserRoles.includes("admin");
  const isSubAdmin = currentUserRoles.includes("sub_admin");
  const isLeader = currentUserRoles.includes("leader");

  if (isDev) return ["assistente", "corretor", "leader", "sub_admin", "admin"];
  if (isAdmin) return ["assistente", "corretor", "leader", "sub_admin"];
  if (isSubAdmin) return ["assistente", "corretor", "leader"];
  if (isLeader) return ["assistente", "corretor"];
  return [];
}

function canManageMember(currentUserRoles: AppRole[], memberRoles: string[]): boolean {
  const currentMax = Math.max(...currentUserRoles.map(r => ROLE_HIERARCHY[r] || 0));
  const memberMax = Math.max(...memberRoles.map(r => ROLE_HIERARCHY[r] || 0));
  return currentMax > memberMax;
}

export function TeamDashboard() {
  const [search, setSearch] = useState("");
  const { user } = useAuth();
  const { isDeveloper, roles: currentUserRoles } = useUserRoles();
  const { data: members = [], isLoading } = useTeamMembers();
  const { data: customRoles = [] } = useCustomRoles();
  const removeMember = useRemoveMember();
  const queryClient = useQueryClient();
  const [removeReason, setRemoveReason] = useState("");
  const [roleDialogMember, setRoleDialogMember] = useState<TeamMember | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("");

  const filtered = members.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return m.full_name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q);
  });

  const totalActions = members.reduce((s, m) => s + m.total_actions_30d, 0);
  const totalLeads = members.reduce((s, m) => s + m.active_leads, 0);
  const totalContracts = members.reduce((s, m) => s + m.total_contracts, 0);

  const getInitials = (name: string) =>
    name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";

  const canRemove = (member: TeamMember) => {
    if (member.user_id === user?.id) return false;
    return canManageMember(currentUserRoles, member.roles);
  };

  const canChangeRole = (member: TeamMember) => {
    if (member.user_id === user?.id) return false;
    return canManageMember(currentUserRoles, member.roles);
  };

  const manageableRoles = getManageableRoles(currentUserRoles);

  const changeRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: string }) => {
      // Delete existing roles then insert new one
      const { error: deleteError } = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (deleteError) throw deleteError;
      const { error: insertError } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole as any });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members-stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin-team"] });
      toast.success("Cargo alterado com sucesso");
      setRoleDialogMember(null);
      setSelectedRole("");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao alterar cargo");
    },
  });

  const getCustomRoleName = (id: string | null) => {
    if (!id) return null;
    return customRoles.find((r) => r.id === id)?.name || null;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <Users className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{members.length}</p>
            <p className="text-[10px] text-muted-foreground">Membros</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <Activity className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{totalActions}</p>
            <p className="text-[10px] text-muted-foreground">Ações (30d)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <TrendingUp className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{totalLeads}</p>
            <p className="text-[10px] text-muted-foreground">Leads ativos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <FileText className="h-5 w-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{totalContracts}</p>
            <p className="text-[10px] text-muted-foreground">Contratos</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar membro..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {/* Member Cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        {filtered.map((m) => {
          const customRoleName = getCustomRoleName(m.custom_role_id);
          return (
            <Card key={m.user_id}>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <Avatar>
                      <AvatarFallback>{getInitials(m.full_name)}</AvatarFallback>
                    </Avatar>
                    <CircleDot
                      className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 ${
                        m.last_sign_in_at &&
                        Date.now() - new Date(m.last_sign_in_at).getTime() < 15 * 60 * 1000
                          ? "text-green-500"
                          : "text-muted-foreground/40"
                      }`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{m.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                    <div className="flex gap-1 flex-wrap mt-1">
                      {m.roles.map((r) => (
                        <Badge key={r} variant="secondary" className="text-[10px]">
                          {ROLE_LABELS[r] || r}
                        </Badge>
                      ))}
                      {customRoleName && (
                        <Badge variant="outline" className="text-[10px]">
                          {customRoleName}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {/* Change Role */}
                    {canChangeRole(m) && manageableRoles.length > 0 && (
                      <Dialog open={roleDialogMember?.user_id === m.user_id} onOpenChange={(open) => {
                        if (open) {
                          setRoleDialogMember(m);
                          setSelectedRole(m.roles[0] || "corretor");
                        } else {
                          setRoleDialogMember(null);
                          setSelectedRole("");
                        }
                      }}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Alterar cargo">
                            <Shield className="h-4 w-4 text-primary" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-sm">
                          <DialogHeader>
                            <DialogTitle>Alterar cargo</DialogTitle>
                            <DialogDescription>
                              Alterar o cargo de <strong>{m.full_name}</strong>
                            </DialogDescription>
                          </DialogHeader>
                          <div className="py-4">
                            <Select value={selectedRole} onValueChange={setSelectedRole}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o cargo" />
                              </SelectTrigger>
                              <SelectContent>
                                {manageableRoles.map((role) => (
                                  <SelectItem key={role} value={role}>
                                    {ROLE_LABELS[role] || role}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {selectedRole && selectedRole !== m.roles[0] && (
                              <p className="text-xs text-muted-foreground mt-2">
                                {ROLE_LABELS[m.roles[0]] || m.roles[0]} → {ROLE_LABELS[selectedRole] || selectedRole}
                              </p>
                            )}
                          </div>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => setRoleDialogMember(null)}
                            >
                              Cancelar
                            </Button>
                            <Button
                              disabled={!selectedRole || selectedRole === m.roles[0] || changeRole.isPending}
                              onClick={() => changeRole.mutate({ userId: m.user_id, newRole: selectedRole })}
                            >
                              {changeRole.isPending ? "Salvando..." : "Confirmar"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}

                    {/* Remove Member */}
                    {canRemove(m) && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <UserMinus className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover {m.full_name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              O membro será removido da organização. Leads e tarefas serão desatribuídos. Esta ação é irreversível.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <Input
                            placeholder="Motivo (opcional)"
                            value={removeReason}
                            onChange={(e) => setRemoveReason(e.target.value)}
                          />
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setRemoveReason("")}>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => {
                                removeMember.mutate({ userId: m.user_id, reason: removeReason || undefined });
                                setRemoveReason("");
                              }}
                            >
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-4 gap-1.5 mt-3">
                  <div className="text-center p-1.5 rounded bg-muted/50">
                    <p className="text-sm font-bold">{m.active_leads}</p>
                    <p className="text-[9px] text-muted-foreground">Leads</p>
                  </div>
                  <div className="text-center p-1.5 rounded bg-muted/50">
                    <p className="text-sm font-bold">{m.total_properties}</p>
                    <p className="text-[9px] text-muted-foreground">Imóveis</p>
                  </div>
                  <div className="text-center p-1.5 rounded bg-muted/50">
                    <p className="text-sm font-bold">{m.total_contracts}</p>
                    <p className="text-[9px] text-muted-foreground">Contratos</p>
                  </div>
                  <div className="text-center p-1.5 rounded bg-muted/50">
                    <p className="text-sm font-bold">{m.total_actions_30d}</p>
                    <p className="text-[9px] text-muted-foreground">Ações 30d</p>
                  </div>
                </div>

                {/* Last seen */}
                <div className="flex items-center gap-1.5 mt-2 text-[10px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {m.last_sign_in_at ? (
                    <span>
                      Último acesso{" "}
                      {formatDistanceToNow(new Date(m.last_sign_in_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                  ) : (
                    <span>Nunca acessou</span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && !isLoading && (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum membro encontrado</p>
      )}
    </div>
  );
}
