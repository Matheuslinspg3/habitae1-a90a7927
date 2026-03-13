import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, Shield, Palette } from "lucide-react";
import {
  useCustomRoles, useUpsertCustomRole, useDeleteCustomRole,
  MODULE_LIST, CustomRole, ModuleKey,
} from "@/hooks/useCustomRoles";

const COLORS = ["#6b7280", "#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4"];

const DEFAULT_PERMISSIONS: Record<ModuleKey, boolean> = {
  properties: true,
  owners: false,
  crm: true,
  contracts: false,
  financial: false,
  schedule: true,
  marketplace: true,
  ads: false,
  integrations: false,
  activities: false,
};

function RoleForm({
  initial,
  onSave,
  onClose,
  isPending,
}: {
  initial?: CustomRole;
  onSave: (data: any) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [color, setColor] = useState(initial?.color || "#6b7280");
  const [permissions, setPermissions] = useState<Record<ModuleKey, boolean>>(
    initial?.module_permissions || { ...DEFAULT_PERMISSIONS }
  );

  const toggle = (key: ModuleKey) =>
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Nome do cargo</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Gerente de Vendas" />
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <Palette className="h-3.5 w-3.5" />
          Cor
        </Label>
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`h-7 w-7 rounded-full border-2 transition-all ${
                color === c ? "border-foreground scale-110" : "border-transparent"
              }`}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5" />
          Permissões por módulo
        </Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {MODULE_LIST.map((mod) => (
            <div
              key={mod.key}
              className="flex items-center justify-between p-2.5 border rounded-lg"
            >
              <span className="text-sm">{mod.label}</span>
              <Switch
                checked={permissions[mod.key] ?? false}
                onCheckedChange={() => toggle(mod.key)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          disabled={!name.trim() || isPending}
          onClick={() =>
            onSave({
              ...(initial?.id ? { id: initial.id } : {}),
              name: name.trim(),
              color,
              module_permissions: permissions,
            })
          }
        >
          {initial?.id ? "Atualizar" : "Criar"} Cargo
        </Button>
      </div>
    </div>
  );
}

export function CustomRolesManager() {
  const { data: roles = [], isLoading } = useCustomRoles();
  const upsert = useUpsertCustomRole();
  const remove = useDeleteCustomRole();
  const [editRole, setEditRole] = useState<CustomRole | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => <Skeleton key={i} className="h-20" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Cargos Personalizados</h3>
          <p className="text-xs text-muted-foreground">
            Crie cargos específicos com permissões por módulo
          </p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Novo Cargo
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Criar Cargo</DialogTitle>
              <DialogDescription>
                Defina um cargo personalizado e configure as permissões de acesso
              </DialogDescription>
            </DialogHeader>
            <RoleForm
              onSave={(data) => {
                upsert.mutate(data, { onSuccess: () => setShowCreate(false) });
              }}
              onClose={() => setShowCreate(false)}
              isPending={upsert.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {roles.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            Nenhum cargo personalizado criado ainda.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {roles.map((role) => {
          const enabledModules = MODULE_LIST.filter(
            (m) => role.module_permissions?.[m.key]
          );
          return (
            <Card key={role.id}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: role.color }}
                    />
                    <p className="font-medium text-sm">{role.name}</p>
                  </div>
                  <div className="flex gap-1">
                    <Dialog
                      open={editRole?.id === role.id}
                      onOpenChange={(o) => !o && setEditRole(null)}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setEditRole(role)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Editar Cargo</DialogTitle>
                        </DialogHeader>
                        <RoleForm
                          initial={role}
                          onSave={(data) => {
                            upsert.mutate(data, {
                              onSuccess: () => setEditRole(null),
                            });
                          }}
                          onClose={() => setEditRole(null)}
                          isPending={upsert.isPending}
                        />
                      </DialogContent>
                    </Dialog>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir cargo "{role.name}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Membros com este cargo terão o cargo removido.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground"
                            onClick={() => remove.mutate(role.id)}
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <div className="flex gap-1 flex-wrap mt-2">
                  {enabledModules.map((m) => (
                    <Badge
                      key={m.key}
                      variant="outline"
                      className="text-[10px]"
                    >
                      {m.label}
                    </Badge>
                  ))}
                  {enabledModules.length === 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      Sem permissões
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
