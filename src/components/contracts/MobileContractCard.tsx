import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MobileContractCardProps {
  contract: any;
  statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }>;
  typeLabels: Record<string, string>;
  formatCurrency: (value: number | null | undefined) => string;
  formatDate: (date: string | null | undefined) => string;
  onView: (contract: any) => void;
  onEdit: (contract: any) => void;
  onDelete: (id: string) => void;
}

export function MobileContractCard({
  contract, statusConfig, typeLabels, formatCurrency, formatDate,
  onView, onEdit, onDelete,
}: MobileContractCardProps) {
  const status = statusConfig[contract.status] || statusConfig.rascunho;

  return (
    <Card className="cursor-pointer active:scale-[0.98] transition-transform" onClick={() => onView(contract)}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold truncate">{contract.code}</p>
            <p className="text-sm text-muted-foreground truncate">
              {contract.property?.title || "Sem imóvel"}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant={status.variant}>{status.label}</Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(contract); }}>Ver detalhes</DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(contract); }}>Editar</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(contract.id); }}>Excluir</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Cliente</p>
            <p className="truncate">{contract.lead?.name || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Tipo</p>
            <p>{typeLabels[contract.type]}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Valor</p>
            <p className="font-medium">{formatCurrency(Number(contract.value))}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Início</p>
            <p>{formatDate(contract.start_date)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
