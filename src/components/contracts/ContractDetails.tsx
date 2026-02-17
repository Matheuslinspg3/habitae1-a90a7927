import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  FileText, 
  Home, 
  User, 
  Briefcase, 
  Calendar, 
  DollarSign,
  Pencil,
  Trash2,
  Building2,
  Phone,
  Mail
} from "lucide-react";
import type { ContractWithDetails } from "@/hooks/useContracts";

interface ContractDetailsProps {
  contract: ContractWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (contract: ContractWithDetails) => void;
  onDelete: (id: string) => void;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  rascunho: { label: "Rascunho", variant: "secondary" },
  ativo: { label: "Ativo", variant: "default" },
  encerrado: { label: "Encerrado", variant: "outline" },
  cancelado: { label: "Cancelado", variant: "destructive" },
};

const typeLabels: Record<string, string> = {
  venda: "Venda",
  locacao: "Locação",
};

export function ContractDetails({ contract, open, onOpenChange, onEdit, onDelete }: ContractDetailsProps) {
  if (!contract) return null;

  const status = statusConfig[contract.status] || statusConfig.rascunho;

  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return "R$ 0";
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return "-";
    return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
  };

  const commissionValue = contract.commission_percentage 
    ? Number(contract.value) * (Number(contract.commission_percentage) / 100)
    : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <SheetTitle className="text-xl">{contract.code}</SheetTitle>
              <SheetDescription>
                Contrato de {typeLabels[contract.type]}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Status e Tipo */}
          <div className="flex items-center gap-2">
            <Badge variant={status.variant}>{status.label}</Badge>
            <Badge variant="outline">{typeLabels[contract.type]}</Badge>
          </div>

          {/* Valor */}
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" />
              <span>Valor do Contrato</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(Number(contract.value))}</p>
            {contract.commission_percentage && (
              <p className="text-sm text-muted-foreground mt-1">
                Comissão: {contract.commission_percentage}% ({formatCurrency(commissionValue)})
              </p>
            )}
          </div>

          <Separator />

          {/* Imóvel */}
          {contract.property && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Home className="h-4 w-4 text-muted-foreground" />
                <span>Imóvel</span>
              </div>
              <div className="pl-6">
                <p className="font-medium">{contract.property.title}</p>
                {contract.property.address_city && (
                  <p className="text-sm text-muted-foreground">{contract.property.address_city}</p>
                )}
              </div>
            </div>
          )}

          {/* Cliente */}
          {contract.lead && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>Cliente</span>
              </div>
              <div className="pl-6 space-y-1">
                <p className="font-medium">{contract.lead.name}</p>
                {contract.lead.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    <span>{contract.lead.phone}</span>
                  </div>
                )}
                {contract.lead.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    <span>{contract.lead.email}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Corretor */}
          {contract.broker && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <span>Corretor Responsável</span>
              </div>
              <div className="pl-6">
                <p className="font-medium">{contract.broker.full_name}</p>
              </div>
            </div>
          )}

          <Separator />

          {/* Datas */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>Período</span>
            </div>
            <div className="pl-6 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Início</p>
                <p className="font-medium">{formatDate(contract.start_date)}</p>
              </div>
              {contract.type === "locacao" && contract.end_date && (
                <div>
                  <p className="text-xs text-muted-foreground">Fim</p>
                  <p className="font-medium">{formatDate(contract.end_date)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Detalhes de Locação */}
          {contract.type === "locacao" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span>Detalhes da Locação</span>
              </div>
              <div className="pl-6 grid grid-cols-2 gap-4">
                {contract.payment_day && (
                  <div>
                    <p className="text-xs text-muted-foreground">Dia de Pagamento</p>
                    <p className="font-medium">Dia {contract.payment_day}</p>
                  </div>
                )}
                {contract.readjustment_index && (
                  <div>
                    <p className="text-xs text-muted-foreground">Índice de Reajuste</p>
                    <p className="font-medium">{contract.readjustment_index}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Observações */}
          {contract.notes && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium">Observações</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{contract.notes}</p>
              </div>
            </>
          )}

          <Separator />

          {/* Ações */}
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => {
                onOpenChange(false);
                onEdit(contract);
              }}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </Button>
            <Button 
              variant="destructive" 
              size="icon"
              onClick={() => {
                if (confirm('Tem certeza que deseja excluir este contrato?')) {
                  onDelete(contract.id);
                  onOpenChange(false);
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Timestamps */}
          <div className="pt-4 border-t text-xs text-muted-foreground">
            <p>Criado em: {formatDate(contract.created_at)}</p>
            <p>Atualizado em: {formatDate(contract.updated_at)}</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
