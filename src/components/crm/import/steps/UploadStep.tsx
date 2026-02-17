import { useRef, useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download } from 'lucide-react';
import { parseCSV, generateTemplateCSV, type CSVParseResult } from '../utils/csvParser';

interface UploadStepProps {
  onParsed: (result: CSVParseResult) => void;
}

export function UploadStep({ onParsed }: UploadStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<CSVParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileName, setFileName] = useState<string>('');

  const processFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Formato inválido. Selecione um arquivo .csv');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Arquivo muito grande. O limite é 5MB');
      return;
    }

    setError(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = parseCSV(text);
        if (parsed.rows.length === 0) {
          setError('Nenhum dado encontrado no arquivo');
          return;
        }
        setResult(parsed);
        onParsed(parsed);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao processar arquivo');
      }
    };
    reader.readAsText(file);
  }, [onParsed]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [processFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const downloadTemplate = () => {
    const csv = generateTemplateCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo_leads_habitae.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragOver ? 'border-primary bg-primary/5' : 'hover:border-primary'
        }`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm font-medium">Arraste seu arquivo CSV aqui</p>
        <p className="text-xs text-muted-foreground mt-1">ou clique para selecionar • Máx. 5MB</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      <div className="flex justify-center">
        <Button variant="ghost" size="sm" onClick={downloadTemplate}>
          <Download className="h-4 w-4 mr-2" />
          Baixar modelo CSV padrão
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{fileName}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              {result.totalRows} leads • Delimitador: {result.delimiter === ';' ? 'ponto-e-vírgula' : 'vírgula'}
            </div>
          </div>

          <ScrollArea className="h-48 border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  {result.headers.slice(0, 6).map((h, i) => (
                    <TableHead key={i} className="text-xs">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.slice(0, 10).map((row, i) => (
                  <TableRow key={i}>
                    {result.headers.slice(0, 6).map((h, j) => (
                      <TableCell key={j} className="text-xs py-1.5">{row[h] || '-'}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>

          {result.totalRows > 10 && (
            <p className="text-xs text-muted-foreground text-center">
              Mostrando 10 de {result.totalRows} linhas
            </p>
          )}
        </div>
      )}
    </div>
  );
}
