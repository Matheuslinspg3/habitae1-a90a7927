import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Home, Trash2, Pencil } from "lucide-react";
import type { OwnerWithDetails } from "@/hooks/useOwners";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileOwnerCard } from "./MobileOwnerCard";

interface OwnerTableProps {
  owners: OwnerWithDetails[];
  isLoading: boolean;
  onSelect: (owner: OwnerWithDetails) => void;
  onEdit: (owner: OwnerWithDetails) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}

export function OwnerTable({ owners, isLoading, onSelect, onEdit, onDelete, onAdd }: OwnerTableProps) {
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const filtered = owners.filter((o) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      o.primary_name.toLowerCase().includes(q) ||
      o.phone?.includes(q) ||
      o.email?.toLowerCase().includes(q) ||
      o.document?.includes(q) ||
      o.aliases.some((a) => a.name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone, documento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={onAdd} size={isMobile ? "icon" : "default"}>
          <Plus className="h-4 w-4" />
          {!isMobile && <span className="ml-2">Novo Proprietário</span>}
        </Button>
      </div>

      {isMobile ? (
        <div className="space-y-3">
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              {search ? "Nenhum proprietário encontrado." : "Nenhum proprietário cadastrado."}
            </p>
          ) : (
            filtered.map((owner) => (
              <MobileOwnerCard
                key={owner.id}
                owner={owner}
                onSelect={onSelect}
                onEdit={onEdit}
                onDelete={(id) => setDeleteId(id)}
              />
            ))
          )}
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>CPF/CNPJ</TableHead>
                <TableHead className="text-center">Imóveis</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {search ? "Nenhum proprietário encontrado." : "Nenhum proprietário cadastrado."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((owner) => (
                  <TableRow
                    key={owner.id}
                    className="cursor-pointer hover:bg-accent/5"
                    onClick={() => onSelect(owner)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">{owner.primary_name}</p>
                        {owner.aliases.length > 1 && (
                          <p className="text-xs text-muted-foreground">
                            +{owner.aliases.length - 1} apelido(s)
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{owner.phone || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{owner.email || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{owner.document || "—"}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="gap-1">
                        <Home className="h-3 w-3" />
                        {owner.property_count}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" onClick={() => onEdit(owner)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(owner.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir proprietário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá desvincular o proprietário de todos os imóveis. Os imóveis não serão excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) onDelete(deleteId);
                setDeleteId(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
