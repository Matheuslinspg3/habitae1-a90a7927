import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Plus, Home, Trash2, Pencil } from "lucide-react";
import type { OwnerWithDetails } from "@/hooks/useOwners";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileOwnerCard } from "./MobileOwnerCard";
import { OwnerBulkToolbar } from "./OwnerBulkToolbar";

interface OwnerTableProps {
  owners: OwnerWithDetails[];
  isLoading: boolean;
  onSelect: (owner: OwnerWithDetails) => void;
  onEdit: (owner: OwnerWithDetails) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  onBulkDelete?: (ids: string[]) => void;
}

export function OwnerTable({ owners, isLoading, onSelect, onEdit, onDelete, onAdd, onBulkDelete }: OwnerTableProps) {
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
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

  const allSelected = filtered.length > 0 && filtered.every((o) => selectedIds.has(o.id));
  const someSelected = filtered.some((o) => selectedIds.has(o.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((o) => o.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = () => {
    if (onBulkDelete) {
      onBulkDelete(Array.from(selectedIds));
    } else {
      selectedIds.forEach((id) => onDelete(id));
    }
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
  };

  const clearSelection = () => setSelectedIds(new Set());

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

      <OwnerBulkToolbar
        selectedCount={selectedIds.size}
        totalCount={filtered.length}
        onSelectAll={toggleAll}
        onClear={clearSelection}
        onDelete={() => setBulkDeleteOpen(true)}
        allSelected={allSelected}
      />

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
                selected={selectedIds.has(owner.id)}
                onToggleSelect={() => toggleOne(owner.id)}
              />
            ))
          )}
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Selecionar todos"
                    className={someSelected && !allSelected ? "data-[state=unchecked]:bg-primary/20" : ""}
                  />
                </TableHead>
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
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {search ? "Nenhum proprietário encontrado." : "Nenhum proprietário cadastrado."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((owner) => (
                  <TableRow
                    key={owner.id}
                    className={`cursor-pointer hover:bg-accent/5 ${selectedIds.has(owner.id) ? "bg-primary/5" : ""}`}
                    onClick={() => onSelect(owner)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(owner.id)}
                        onCheckedChange={() => toggleOne(owner.id)}
                        aria-label={`Selecionar ${owner.primary_name}`}
                      />
                    </TableCell>
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

      {/* Single delete dialog */}
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

      {/* Bulk delete dialog */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedIds.size} proprietário(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá desvincular os proprietários selecionados de todos os imóveis. Os imóveis não serão excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir {selectedIds.size} selecionado(s)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
