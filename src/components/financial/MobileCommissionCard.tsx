import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface Commission {
  id: string;
  broker?: { full_name: string } | null;
  contract?: { code: string } | null;
  percentage: number;
  amount: number;
  paid: boolean | null;
}

interface MobileCommissionCardProps {
  commission: Commission;
  formatCurrency: (value: number) => string;
}

export function MobileCommissionCard({ commission, formatCurrency }: MobileCommissionCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate">{commission.broker?.full_name || '—'}</p>
            <p className="text-sm text-muted-foreground">Contrato: {commission.contract?.code || '—'}</p>
          </div>
          <Badge variant={commission.paid ? 'default' : 'secondary'}>
            {commission.paid ? 'Pago' : 'Pendente'}
          </Badge>
        </div>
        <div className="flex items-center justify-between mt-2 text-sm">
          <span className="text-muted-foreground">{Number(commission.percentage)}%</span>
          <span className="font-semibold">{formatCurrency(Number(commission.amount))}</span>
        </div>
      </CardContent>
    </Card>
  );
}
