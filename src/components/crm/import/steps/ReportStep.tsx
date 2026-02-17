import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, Download, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ImportReport {
  total_processed: number;
  total_imported: number;
  total_duplicates: number;
  total_updated: number;
  total_errors: number;
  report?: {
    imported: string[];
    duplicates: string[];
    updated: string[];
    errors: { name: string; error: string }[];
  };
}

interface ReportStepProps {
  report: ImportReport;
  onClose: () => void;
  onNewImport: () => void;
}

export function ReportStep({ report, onClose, onNewImport }: ReportStepProps) {
  const navigate = useNavigate();

  const downloadReport = () => {
    const lines = ['Status;Nome;Detalhes'];
    report.report?.imported.forEach(n => lines.push(`Importado;${n};`));
    report.report?.duplicates.forEach(n => lines.push(`Duplicado;${n};`));
    report.report?.updated.forEach(n => lines.push(`Atualizado;${n};`));
    report.report?.errors.forEach(e => lines.push(`Erro;${e.name};${e.error}`));

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_importacao_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
        <h3 className="text-lg font-semibold">Importação concluída!</h3>
        <p className="text-sm text-muted-foreground">
          {report.total_processed} leads processados
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
          <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
          <div>
            <span className="text-xl font-bold">{report.total_imported}</span>
            <p className="text-xs text-muted-foreground">Importados</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
          <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />
          <div>
            <span className="text-xl font-bold">{report.total_duplicates}</span>
            <p className="text-xs text-muted-foreground">Duplicados</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
          <RefreshCw className="h-5 w-5 text-blue-500 shrink-0" />
          <div>
            <span className="text-xl font-bold">{report.total_updated}</span>
            <p className="text-xs text-muted-foreground">Atualizados</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
          <XCircle className="h-5 w-5 text-destructive shrink-0" />
          <div>
            <span className="text-xl font-bold">{report.total_errors}</span>
            <p className="text-xs text-muted-foreground">Erros</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Button variant="outline" onClick={downloadReport} className="w-full">
          <Download className="h-4 w-4 mr-2" />
          Baixar relatório CSV
        </Button>
        <Button onClick={onClose} className="w-full">
          <ArrowRight className="h-4 w-4 mr-2" />
          Ir para CRM
        </Button>
      </div>
    </div>
  );
}
