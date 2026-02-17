import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Wallet } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileCommissionCard } from "./MobileCommissionCard";

interface Commission {
  id: string;
  broker?: { full_name: string } | null;
  contract?: { code: string } | null;
  percentage: number;
  amount: number;
  paid: boolean | null;
}

interface CommissionsTabProps {
  commissions: Commission[];
  formatCurrency: (value: number) => string;
}

export function CommissionsTab({ commissions, formatCurrency }: CommissionsTabProps) {
  const isMobile = useIsMobile();

  if (commissions.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col items-center justify-center text-center h-32 p-6">
            <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Nenhuma comissão registrada</h3>
            <p className="text-muted-foreground mt-1">As comissões aparecerão quando houver contratos fechados</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isMobile) {
    return (
      <div className="space-y-3">
        {commissions.map((commission) => (
          <MobileCommissionCard
            key={commission.id}
            commission={commission}
            formatCurrency={formatCurrency}
          />
        ))}
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Corretor</TableHead>
                <TableHead>Contrato</TableHead>
                <TableHead>Percentual</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {commissions.map((commission) => (
                <TableRow key={commission.id}>
                  <TableCell>{commission.broker?.full_name || '-'}</TableCell>
                  <TableCell>{commission.contract?.code || '-'}</TableCell>
                  <TableCell>{Number(commission.percentage)}%</TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(Number(commission.amount))}
                  </TableCell>
                  <TableCell>
                    <Badge variant={commission.paid ? 'default' : 'secondary'}>
                      {commission.paid ? 'Pago' : 'Pendente'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
