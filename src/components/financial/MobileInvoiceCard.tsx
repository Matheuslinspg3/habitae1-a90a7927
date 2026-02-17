import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Pencil } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Invoice } from "@/hooks/useInvoices";

const statusConfig = {
  pendente: { label: 'Pendente', variant: 'secondary' as const },
  pago: { label: 'Pago', variant: 'default' as const },
  atrasado: { label: 'Atrasado', variant: 'destructive' as const },
  cancelado: { label: 'Cancelado', variant: 'outline' as const },
};

interface MobileInvoiceCardProps {
  invoice: Invoice;
  onEdit: (invoice: Invoice) => void;
  formatCurrency: (value: number) => string;
}

export function MobileInvoiceCard({ invoice, onEdit, formatCurrency }: MobileInvoiceCardProps) {
  const statusInfo = statusConfig[invoice.status as keyof typeof statusConfig] || statusConfig.pendente;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate">{invoice.description}</p>
            <p className="text-sm text-muted-foreground truncate">{invoice.lead?.name || '—'}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => onEdit(invoice)}>
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            <span className="text-xs text-muted-foreground">
              {format(new Date(invoice.due_date), 'dd/MM/yyyy', { locale: ptBR })}
            </span>
          </div>
          <span className="font-semibold">{formatCurrency(Number(invoice.amount))}</span>
        </div>
      </CardContent>
    </Card>
  );
}
