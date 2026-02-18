import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, Search, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { type Lead } from '@/hooks/useLeads';
import { useLeadStages } from '@/hooks/useLeadStages';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface InactiveLeadsListProps {
  leads: Lead[];
  isLoading: boolean;
  onReactivate: (id: string) => void;
  isReactivating: boolean;
}

function formatCurrency(value: number | null | undefined) {
  if (!value) return '-';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function InactiveLeadsList({
  leads,
  isLoading,
  onReactivate,
  isReactivating,
}: InactiveLeadsListProps) {
  const [search, setSearch] = useState('');
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);
  const { leadStages } = useLeadStages();

  const getStageInfo = (stageId: string | null | undefined) => {
    if (!stageId) return null;
    return leadStages.find((s) => s.id === stageId);
  };

  const filteredLeads = leads.filter((lead) => {
    const searchLower = search.toLowerCase();
    return (
      lead.name.toLowerCase().includes(searchLower) ||
      lead.email?.toLowerCase().includes(searchLower) ||
      lead.phone?.includes(search)
    );
  });

  const handleReactivate = (id: string) => {
    setReactivatingId(id);
    onReactivate(id);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <RefreshCw className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">Nenhum lead inativo</h3>
        <p className="text-muted-foreground mt-1">
          Leads inativados aparecerão aqui
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar leads inativos..."
          className="pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="hidden sm:table-cell">Contato</TableHead>
              <TableHead className="hidden md:table-cell">Estágio</TableHead>
              <TableHead className="hidden lg:table-cell">Valor</TableHead>
              <TableHead className="hidden sm:table-cell">Último Tipo</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLeads.map((lead) => {
              const stage = getStageInfo(lead.lead_stage_id);
              return (
                <TableRow key={lead.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{lead.name}</div>
                      <div className="text-sm text-muted-foreground sm:hidden">
                        {lead.phone || lead.email || 'Sem contato'}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <div className="text-sm">
                      {lead.phone && <div>{lead.phone}</div>}
                      {lead.email && <div className="text-muted-foreground">{lead.email}</div>}
                      {!lead.phone && !lead.email && <span className="text-muted-foreground">-</span>}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {lead.lead_type ? (
                      <Badge
                        variant="secondary"
                        style={{ backgroundColor: lead.lead_type.color || undefined }}
                      >
                        {lead.lead_type.name}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {formatCurrency(lead.estimated_value)}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {stage && (
                      <Badge variant="outline" className="flex items-center gap-1 w-fit">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                        {stage.name}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          disabled={isReactivating && reactivatingId === lead.id}
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          <span className="hidden sm:inline">Reativar</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Reativar lead?</AlertDialogTitle>
                          <AlertDialogDescription>
                            O lead "{lead.name}" voltará para o Kanban no tipo "{stage?.name}".
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleReactivate(lead.id)}>
                            Reativar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {filteredLeads.length === 0 && leads.length > 0 && (
        <div className="text-center py-8 text-muted-foreground">
          Nenhum lead encontrado para "{search}"
        </div>
      )}
    </div>
  );
}
