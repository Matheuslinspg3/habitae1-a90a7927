import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Trash2, AlertTriangle, Users, Search, KeyRound, Loader2 } from "lucide-react";
import { useState } from "react";
import { Loader2 } from "lucide-react";

const roleBadgeVariant = (role: string) => {
  switch (role) {
    case "developer": return "destructive" as const;
    case "leader": return "default" as const;
    default: return "secondary" as const;
  }
};

export function UsersTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [passwordTarget, setPasswordTarget] = useState<{ userId: string; name: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
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

  const { data: authUsers = [] } = useQuery({
    queryKey: ["admin-users-emails"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`,
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      );
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json() as Promise<{ id: string; email: string; created_at: string }[]>;
    },
  });

  const getEmail = (userId: string) => authUsers.find((u) => u.id === userId)?.email || "—";

  const filtered = allProfiles.filter(p => {
    if (!search) return true;
    const email = getEmail(p.user_id);
    return p.full_name?.toLowerCase().includes(search.toLowerCase()) || email.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Usuários do Sistema
            </CardTitle>
            <CardDescription>Gerencie cargos e contas de todos os usuários</CardDescription>
          </div>
          <div className="relative sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto -mx-5 sm:-mx-6 px-5 sm:px-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome / ID / Email</TableHead>
                
                <TableHead>Cargo</TableHead>
                <TableHead className="w-[160px] hidden md:table-cell">Alterar</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const userRoles = allRoles.filter((r) => r.user_id === p.user_id);
                const primaryRole = userRoles.length > 0 ? userRoles[0].role : "corretor";
                const email = getEmail(p.user_id);
                return (
                  <TableRow key={p.user_id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{p.full_name}</p>
                        <button
                          type="button"
                          className="text-[10px] text-muted-foreground font-mono hover:text-foreground transition-colors cursor-pointer"
                          title="Copiar ID"
                          onClick={() => {
                            navigator.clipboard.writeText(p.user_id);
                            toast({ title: "ID copiado!" });
                          }}
                        >
                          {p.user_id.slice(0, 8)}…
                        </button>
                        <p className="text-xs text-muted-foreground">{email}</p>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {userRoles.map((r) => (
                          <Badge key={r.id} variant={roleBadgeVariant(r.role)} className="text-[10px]">{r.role}</Badge>
                        ))}
                        {userRoles.length === 0 && <Badge variant="outline" className="text-[10px]">corretor</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Select
                        value={primaryRole}
                        onValueChange={async (newRole) => {
                          for (const r of userRoles) {
                            await supabase.from("user_roles").delete().eq("id", r.id);
                          }
                          if (newRole !== "corretor") {
                            const { error } = await supabase.from("user_roles").insert({ user_id: p.user_id, role: newRole as any });
                            if (error) { toast({ title: "Erro ao atualizar cargo", variant: "destructive" }); return; }
                          }
                          queryClient.invalidateQueries({ queryKey: ["all-user-roles"] });
                          toast({ title: `Cargo de ${p.full_name} atualizado para ${newRole}` });
                        }}
                      >
                        <SelectTrigger className="w-[140px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="corretor">Corretor</SelectItem>
                          <SelectItem value="assistente">Assistente</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="leader">Leader</SelectItem>
                          <SelectItem value="developer">Developer</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <AlertDialog open={passwordTarget?.userId === p.user_id} onOpenChange={(open) => { if (!open) { setPasswordTarget(null); setNewPassword(""); } }}>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPasswordTarget({ userId: p.user_id, name: p.full_name || "" })}>
                              <KeyRound className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Redefinir senha</AlertDialogTitle>
                              <AlertDialogDescription>
                                Definir nova senha para <strong>{p.full_name}</strong> ({email})
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <Input
                              type="password"
                              placeholder="Nova senha (mín. 6 caracteres)"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                            />
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                disabled={newPassword.length < 6}
                                onClick={async () => {
                                  try {
                                    const { data: { session } } = await supabase.auth.getSession();
                                    const res = await fetch(
                                      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`,
                                      { method: "PATCH", headers: { Authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ user_id: p.user_id, new_password: newPassword }) }
                                    );
                                    if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Erro"); }
                                    toast({ title: `Senha de ${p.full_name} redefinida com sucesso` });
                                  } catch (e) {
                                    toast({ title: "Erro", description: (e as Error).message, variant: "destructive" });
                                  } finally {
                                    setPasswordTarget(null);
                                    setNewPassword("");
                                  }
                                }}
                              >
                                Redefinir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-destructive" />
                                Excluir usuário
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Excluir <strong>{p.full_name}</strong> ({email})? Esta ação é irreversível.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={async () => {
                                  try {
                                    const { data: { session } } = await supabase.auth.getSession();
                                    const res = await fetch(
                                      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`,
                                      { method: "DELETE", headers: { Authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ user_id: p.user_id }) }
                                    );
                                    if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Erro ao excluir"); }
                                    queryClient.invalidateQueries({ queryKey: ["all-profiles-dev"] });
                                    queryClient.invalidateQueries({ queryKey: ["admin-users-emails"] });
                                    queryClient.invalidateQueries({ queryKey: ["all-user-roles"] });
                                    toast({ title: `${p.full_name} excluído com sucesso` });
                                  } catch (e) {
                                    toast({ title: "Erro", description: (e as Error).message, variant: "destructive" });
                                  }
                                }}
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
