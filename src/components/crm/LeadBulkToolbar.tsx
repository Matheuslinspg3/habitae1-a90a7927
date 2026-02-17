import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, EyeOff, X, CheckSquare, ArrowRight } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import type { LeadStage } from "@/hooks/useLeadStages";

interface LeadBulkToolbarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBulkDelete: () => void;
  onBulkInactivate: () => void;
  onBulkMoveStage: (stageId: string) => void;
  leadStages: LeadStage[];
  isDeleting?: boolean;
  isInactivating?: boolean;
  allSelected?: boolean;
}

export function LeadBulkToolbar({
  selectedCount, totalCount, onSelectAll, onClearSelection,
  onBulkDelete, onBulkInactivate, onBulkMoveStage,
  leadStages, isDeleting = false, isInactivating = false,
  allSelected = false,
}: LeadBulkToolbarProps) {
  const isMobile = useIsMobile();

  if (selectedCount === 0) return null;

  const stageMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={isMobile ? "h-9 text-xs shrink-0 gap-1.5" : ""}>
          <ArrowRight className="h-3.5 w-3.5" />
          {isMobile ? "Mover" : "Mover para etapa"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-60 overflow-y-auto">
        {leadStages.map((stage) => (
          <DropdownMenuItem key={stage.id} onClick={() => onBulkMoveStage(stage.id)}>
            <div className="w-2.5 h-2.5 rounded-full mr-2 shrink-0" style={{ backgroundColor: stage.color }} />
            {stage.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (isMobile) {
    return (
      <div className="fixed bottom-16 left-0 right-0 z-40 safe-area-bottom animate-fade-in">
        <div className="mx-2 rounded-xl bg-background/95 backdrop-blur border shadow-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">
              {selectedCount} lead{selectedCount > 1 ? "s" : ""}
            </span>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-8 text-xs px-2" onClick={allSelected ? onClearSelection : onSelectAll}>
                <CheckSquare className="h-3.5 w-3.5 mr-1" />
                {allSelected ? "Desmarcar" : "Todos"}
              </Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs px-2" onClick={onClearSelection}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-1 px-1">
            {stageMenu}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 text-xs shrink-0 gap-1.5" disabled={isInactivating}>
                  <EyeOff className="h-3.5 w-3.5" />
                  Inativar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Inativar {selectedCount} lead(s)?</AlertDialogTitle>
                  <AlertDialogDescription>Os leads serão movidos para a lista de inativos.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={onBulkInactivate}>Inativar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="h-9 text-xs shrink-0 gap-1.5" disabled={isDeleting}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Excluir
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir {selectedCount} lead(s)?</AlertDialogTitle>
                  <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={onBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-primary/10 border border-primary/20 rounded-lg">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium">
          {selectedCount} de {totalCount} selecionado(s)
        </span>
        <Button variant="ghost" size="sm" onClick={allSelected ? onClearSelection : onSelectAll}>
          <CheckSquare className="h-4 w-4 mr-2" />
          {allSelected ? "Desmarcar todos" : "Selecionar todos"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onClearSelection}>
          <X className="h-4 w-4 mr-2" />
          Limpar
        </Button>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {stageMenu}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={isInactivating}>
              <EyeOff className="h-4 w-4 mr-2" />
              {isInactivating ? "Inativando..." : "Inativar"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Inativar {selectedCount} lead(s)?</AlertDialogTitle>
              <AlertDialogDescription>Os leads serão movidos para a lista de inativos.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onBulkInactivate}>Inativar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" disabled={isDeleting}>
              <Trash2 className="h-4 w-4 mr-2" />
              {isDeleting ? "Excluindo..." : "Excluir"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir {selectedCount} lead(s)?</AlertDialogTitle>
              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir permanentemente</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
