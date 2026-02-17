import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreditCard, MoreVertical, Pencil, Plus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Invoice } from "@/hooks/useInvoices";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileInvoiceCard } from "./MobileInvoiceCard";

const statusConfig = {
  pendente: { label: 'Pendente', variant: 'secondary' as const },
  pago: { label: 'Pago', variant: 'default' as const },
  atrasado: { label: 'Atrasado', variant: 'destructive' as const },
  cancelado: { label: 'Cancelado', variant: 'outline' as const },
};

interface InvoicesTabProps {
  invoices: Invoice[];
  onEdit: (invoice: Invoice) => void;
  onNew: () => void;
  formatCurrency: (value: number) => string;
}

export function InvoicesTab({ invoices, onEdit, onNew, formatCurrency }: InvoicesTabProps) {
  const isMobile = useIsMobile();

  const header = (
    <div className="flex items-center justify-between p-4">
      <h3 className="text-lg font-semibold">Cobranças</h3>
      <Button size="sm" onClick={onNew}>
        <Plus className="h-4 w-4 mr-2" />
        Nova Cobrança
      </Button>
    </div>
  );

  if (invoices.length === 0) {
    return (
      <Card>
        {header}
        <CardContent className="p-0">
          <div className="flex flex-col items-center justify-center text-center h-32 p-6">
            <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Nenhuma cobrança cadastrada</h3>
            <p className="text-muted-foreground mt-1">As cobranças aparecerão aqui</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isMobile) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Cobranças</h3>
          <Button size="sm" onClick={onNew}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Cobrança
          </Button>
        </div>
        {invoices.map((invoice) => (
          <MobileInvoiceCard
            key={invoice.id}
            invoice={invoice}
            onEdit={onEdit}
            formatCurrency={formatCurrency}
          />
        ))}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Cobranças</CardTitle>
        <Button size="sm" onClick={onNew}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Cobrança
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => {
                const statusInfo = statusConfig[invoice.status as keyof typeof statusConfig];
                return (
                  <TableRow key={invoice.id}>
                    <TableCell>{invoice.lead?.name || '-'}</TableCell>
                    <TableCell className="font-medium">{invoice.description}</TableCell>
                    <TableCell>{formatCurrency(Number(invoice.amount))}</TableCell>
                    <TableCell>
                      {format(new Date(invoice.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEdit(invoice)}>
                            <Pencil className="h-4 w-4 mr-2" />Editar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
