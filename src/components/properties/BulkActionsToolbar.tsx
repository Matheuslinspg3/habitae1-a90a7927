import { Button } from "@/components/ui/button";
import { Trash2, EyeOff, X, CheckSquare, Store, EyeOffIcon } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface BulkActionsToolbarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBulkDelete: () => void;
  onBulkInactivate: () => void;
  onBulkPublishMarketplace?: () => void;
  onBulkHideMarketplace?: () => void;
  isDeleting?: boolean;
  isInactivating?: boolean;
  isPublishing?: boolean;
  isHiding?: boolean;
  allSelected?: boolean;
}

export function BulkActionsToolbar({
  selectedCount, totalCount, onSelectAll, onClearSelection,
  onBulkDelete, onBulkInactivate, onBulkPublishMarketplace, onBulkHideMarketplace,
  isDeleting = false, isInactivating = false, isPublishing = false, isHiding = false,
  allSelected = false,
}: BulkActionsToolbarProps) {
  const isMobile = useIsMobile();

  if (selectedCount === 0) return null;

  // ── Mobile: sticky bottom bar ──
  if (isMobile) {
    return (
      <div className="fixed bottom-16 left-0 right-0 z-40 safe-area-bottom animate-fade-in">
        <div className="mx-2 rounded-xl bg-background/95 backdrop-blur border shadow-lg p-3 space-y-2">
          {/* Top: count + select/clear */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">
              {selectedCount} selecionado{selectedCount > 1 ? "s" : ""}
            </span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs px-2"
                onClick={allSelected ? onClearSelection : onSelectAll}
              >
                <CheckSquare className="h-3.5 w-3.5 mr-1" />
                {allSelected ? "Desmarcar" : "Todos"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs px-2"
                onClick={onClearSelection}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Action buttons - horizontal scroll */}
          <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-1 px-1">
            {onBulkPublishMarketplace && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 text-xs shrink-0 gap-1.5" disabled={isPublishing}>
                    <Store className="h-3.5 w-3.5" />
                    Marketplace
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Publicar {selectedCount} imóvel(is)?</AlertDialogTitle>
                    <AlertDialogDescription>Os imóveis serão disponibilizados no Marketplace.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={onBulkPublishMarketplace}>Publicar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {onBulkHideMarketplace && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 text-xs shrink-0 gap-1.5" disabled={isHiding}>
                    <EyeOffIcon className="h-3.5 w-3.5" />
                    Ocultar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Ocultar {selectedCount} imóvel(is)?</AlertDialogTitle>
                    <AlertDialogDescription>Os imóveis serão removidos do Marketplace.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={onBulkHideMarketplace}>Ocultar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 text-xs shrink-0 gap-1.5" disabled={isInactivating}>
                  <EyeOff className="h-3.5 w-3.5" />
                  Inativar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Inativar {selectedCount} imóvel(is)?</AlertDialogTitle>
                  <AlertDialogDescription>Os imóveis serão marcados como inativos.</AlertDialogDescription>
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
                  <AlertDialogTitle>Excluir {selectedCount} imóvel(is)?</AlertDialogTitle>
                  <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={onBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    );
  }

  // ── Desktop: inline bar ──
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
        {onBulkPublishMarketplace && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={isPublishing}>
                <Store className="h-4 w-4 mr-2" />
                {isPublishing ? "Publicando..." : "Publicar no Marketplace"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Publicar {selectedCount} imóvel(is) no Marketplace?</AlertDialogTitle>
                <AlertDialogDescription>Os imóveis selecionados serão disponibilizados na rede Marketplace para parceiros.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={onBulkPublishMarketplace}>Publicar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {onBulkHideMarketplace && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={isHiding}>
                <EyeOffIcon className="h-4 w-4 mr-2" />
                {isHiding ? "Ocultando..." : "Ocultar do Marketplace"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Ocultar {selectedCount} imóvel(is) do Marketplace?</AlertDialogTitle>
                <AlertDialogDescription>Os imóveis selecionados serão removidos do Marketplace.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={onBulkHideMarketplace}>Ocultar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={isInactivating}>
              <EyeOff className="h-4 w-4 mr-2" />
              {isInactivating ? "Inativando..." : "Inativar"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Inativar {selectedCount} imóvel(is)?</AlertDialogTitle>
              <AlertDialogDescription>Os imóveis selecionados serão marcados como inativos.</AlertDialogDescription>
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
              <AlertDialogTitle>Excluir {selectedCount} imóvel(is)?</AlertDialogTitle>
              <AlertDialogDescription>Esta ação não pode ser desfeita. Todos os dados serão permanentemente removidos.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir permanentemente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
