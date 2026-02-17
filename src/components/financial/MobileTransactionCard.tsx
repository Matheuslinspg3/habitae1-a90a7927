import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Transaction } from "@/hooks/useTransactions";

interface MobileTransactionCardProps {
  transaction: Transaction;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  formatCurrency: (value: number) => string;
}

export function MobileTransactionCard({ transaction, onEdit, onDelete, formatCurrency }: MobileTransactionCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate">{transaction.description}</p>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">
                {format(new Date(transaction.date), 'dd/MM/yyyy', { locale: ptBR })}
              </span>
              {transaction.category?.name && (
                <span className="text-xs text-muted-foreground">• {transaction.category.name}</span>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(transaction)}>
                <Pencil className="h-4 w-4 mr-2" />Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete(transaction.id)} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center justify-between mt-2">
          <Badge variant={transaction.type === 'receita' ? 'default' : 'destructive'}>
            {transaction.type === 'receita' ? '↑ Receita' : '↓ Despesa'}
          </Badge>
          <span className={`font-semibold ${transaction.type === 'receita' ? 'text-success' : 'text-destructive'}`}>
            {formatCurrency(Number(transaction.amount))}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
