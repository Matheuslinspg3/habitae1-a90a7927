import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { format } from 'date-fns';
import type { Lead } from '@/hooks/useLeads';
import type { LeadStage } from '@/hooks/useLeadStages';

interface ExportButtonProps {
  leads: Lead[];
  leadStages: LeadStage[];
}

function formatCurrency(value: number | null | undefined) {
  if (!value) return '';
  return value.toString();
}

export function ExportButton({ leads, leadStages }: ExportButtonProps) {
  const getStageLabel = (stageId: string | null | undefined) => {
    if (!stageId) return '';
    const stage = leadStages.find((s) => s.id === stageId);
    return stage?.name || stageId;
  };

  const handleExport = () => {
    const headers = [
      'Nome',
      'Telefone',
      'E-mail',
      'Tipo',
      'Origem',
      'Estágio',
      'Valor Estimado',
      'Corretor',
      'Data Criação',
    ];

    const rows = leads.map((lead) => [
      lead.name,
      lead.phone || '',
      lead.email || '',
      lead.lead_type?.name || '',
      lead.source || '',
      getStageLabel(lead.lead_stage_id),
      formatCurrency(lead.estimated_value),
      lead.broker?.full_name || '',
      format(new Date(lead.created_at), 'dd/MM/yyyy'),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `leads_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Button variant="outline" onClick={handleExport} disabled={leads.length === 0}>
      <Download className="h-4 w-4 mr-2" />
      Exportar
    </Button>
  );
}
