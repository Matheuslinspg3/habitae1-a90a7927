import { Button } from "@/components/ui/button";
import { Trash2, X, CheckSquare } from "lucide-react";

interface OwnerBulkToolbarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClear: () => void;
  onDelete: () => void;
  allSelected: boolean;
}

export function OwnerBulkToolbar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClear,
  onDelete,
  allSelected,
}: OwnerBulkToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 animate-in fade-in slide-in-from-top-2">
      <span className="text-sm font-medium">
        {selectedCount} de {totalCount} selecionado(s)
      </span>
      <div className="flex-1" />
      {!allSelected && (
        <Button variant="outline" size="sm" onClick={onSelectAll}>
          <CheckSquare className="h-4 w-4 mr-1" />
          Selecionar todos
        </Button>
      )}
      <Button variant="destructive" size="sm" onClick={onDelete}>
        <Trash2 className="h-4 w-4 mr-1" />
        Excluir
      </Button>
      <Button variant="ghost" size="sm" onClick={onClear}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
