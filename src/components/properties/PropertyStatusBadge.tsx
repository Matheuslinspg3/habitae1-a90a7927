import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const statusConfig: Record<string, { label: string; className: string }> = {
  disponivel: {
    label: "Disponível",
    className: "bg-success/15 text-success border-success/30",
  },
  reservado: {
    label: "Reservado",
    className: "bg-warning/15 text-warning border-warning/30",
  },
  vendido: {
    label: "Vendido",
    className: "bg-info/15 text-info border-info/30",
  },
  alugado: {
    label: "Alugado",
    className: "bg-primary/15 text-primary border-primary/30",
  },
  inativo: {
    label: "Inativo",
    className: "bg-muted text-muted-foreground border-border",
  },
  com_proposta: {
    label: "Com Proposta",
    className: "bg-accent/15 text-accent border-accent/30",
  },
  suspenso: {
    label: "Suspenso",
    className: "bg-destructive/15 text-destructive border-destructive/30",
  },
};

export const transactionLabels: Record<string, string> = {
  venda: "Venda",
  aluguel: "Aluguel",
  ambos: "Venda/Aluguel",
};

interface PropertyStatusBadgeProps {
  status: string;
  className?: string;
}

export function PropertyStatusBadge({ status, className }: PropertyStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.disponivel;
  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}
