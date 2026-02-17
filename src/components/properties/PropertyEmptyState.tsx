import { Building2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PropertyEmptyStateProps {
  onCreateClick: () => void;
  filtered?: boolean;
}

export function PropertyEmptyState({ onCreateClick, filtered = false }: PropertyEmptyStateProps) {
  if (filtered) {
    return (
      <div className="text-center py-16 page-enter">
        <div className="w-16 h-16 rounded-full bg-muted/60 flex items-center justify-center mx-auto mb-4">
          <Search className="h-7 w-7 text-muted-foreground/50" />
        </div>
        <h3 className="text-base font-semibold mb-1">Nenhum imóvel encontrado</h3>
        <p className="text-sm text-muted-foreground">Vamos ajustar seus filtros?</p>
      </div>
    );
  }

  return (
    <div className="text-center py-20 px-4 page-enter">
      <div className="w-16 h-16 rounded-2xl bg-primary/8 flex items-center justify-center mx-auto mb-6">
        <Building2 className="h-8 w-8 text-primary" />
      </div>
      <h3 className="text-lg font-semibold mb-2">Nenhum imóvel cadastrado</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto leading-relaxed">
        Comece cadastrando seu primeiro imóvel para gerenciar seu portfólio.
      </p>
      <Button onClick={onCreateClick} size="lg" className="gap-2">
        <Plus className="h-4 w-4" />
        Cadastrar primeiro imóvel
      </Button>
    </div>
  );
}
