import { useState, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileSpreadsheet, Link2, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useLeads, type CreateLeadInput } from '@/hooks/useLeads';
import { toast } from 'sonner';

interface CRMImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedLead {
  name: string;
  email?: string;
  phone?: string;
  estimated_value?: number;
  source?: string;
  notes?: string;
}

const CRM_SYSTEMS = [
  { id: 'rdstation', name: 'RD Station' },
  { id: 'pipedrive', name: 'Pipedrive' },
  { id: 'hubspot', name: 'HubSpot' },
  { id: 'salesforce', name: 'Salesforce' },
  { id: 'other', name: 'Outro' },
];

export function CRMImport({ open, onOpenChange }: CRMImportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedLeads, setParsedLeads] = useState<ParsedLead[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedSystem, setSelectedSystem] = useState<string>('');
  const [apiKey, setApiKey] = useState('');
  
  const { createLead } = useLeads();

  const parseCSV = useCallback((text: string): ParsedLead[] => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('O arquivo CSV deve ter pelo menos um cabeçalho e uma linha de dados');
    }

    const headers = lines[0].split(/[,;]/).map(h => h.trim().toLowerCase().replace(/"/g, ''));
    
    // Map common header names
    const nameIndex = headers.findIndex(h => 
      ['nome', 'name', 'lead', 'cliente', 'client'].includes(h)
    );
    const emailIndex = headers.findIndex(h => 
      ['email', 'e-mail', 'mail'].includes(h)
    );
    const phoneIndex = headers.findIndex(h => 
      ['telefone', 'phone', 'tel', 'celular', 'mobile', 'whatsapp'].includes(h)
    );
    const valueIndex = headers.findIndex(h => 
      ['valor', 'value', 'estimated_value', 'valor_estimado', 'budget', 'orcamento'].includes(h)
    );
    const sourceIndex = headers.findIndex(h => 
      ['origem', 'source', 'fonte', 'canal'].includes(h)
    );
    const notesIndex = headers.findIndex(h => 
      ['notas', 'notes', 'observacao', 'observacoes', 'obs'].includes(h)
    );

    if (nameIndex === -1) {
      throw new Error('Coluna de nome não encontrada. Use: nome, name, lead ou cliente');
    }

    return lines.slice(1).map(line => {
      const values = line.split(/[,;]/).map(v => v.trim().replace(/^"|"$/g, ''));
      
      const lead: ParsedLead = {
        name: values[nameIndex] || '',
      };

      if (emailIndex !== -1 && values[emailIndex]) {
        lead.email = values[emailIndex];
      }
      if (phoneIndex !== -1 && values[phoneIndex]) {
        lead.phone = values[phoneIndex];
      }
      if (valueIndex !== -1 && values[valueIndex]) {
        const cleanValue = values[valueIndex].replace(/[^\d.,]/g, '').replace(',', '.');
        lead.estimated_value = parseFloat(cleanValue) || undefined;
      }
      if (sourceIndex !== -1 && values[sourceIndex]) {
        lead.source = values[sourceIndex];
      }
      if (notesIndex !== -1 && values[notesIndex]) {
        lead.notes = values[notesIndex];
      }

      return lead;
    }).filter(lead => lead.name);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError(null);
    setParsedLeads([]);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const leads = parseCSV(text);
        
        if (leads.length === 0) {
          setParseError('Nenhum lead válido encontrado no arquivo');
          return;
        }
        
        setParsedLeads(leads);
      } catch (error) {
        setParseError(error instanceof Error ? error.message : 'Erro ao processar arquivo');
      }
    };
    reader.onerror = () => {
      setParseError('Erro ao ler o arquivo');
    };
    reader.readAsText(file);

    // Clear input for re-upload
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [parseCSV]);

  const handleImport = async () => {
    if (parsedLeads.length === 0) return;

    setIsImporting(true);
    let successCount = 0;
    let errorCount = 0;

    for (const lead of parsedLeads) {
      try {
        await new Promise<void>((resolve, reject) => {
          createLead(
            {
              name: lead.name,
              email: lead.email,
              phone: lead.phone,
              estimated_value: lead.estimated_value,
              source: lead.source || 'Importação CSV',
              notes: lead.notes,
              stage: 'novo',
            } as CreateLeadInput,
            { 
              onSuccess: () => resolve(), 
              onError: reject 
            }
          );
        });
        successCount++;
      } catch {
        errorCount++;
      }
    }

    setIsImporting(false);

    if (errorCount === 0) {
      toast.success(`${successCount} leads importados com sucesso!`);
      onOpenChange(false);
      setParsedLeads([]);
    } else {
      toast.warning(`${successCount} leads importados, ${errorCount} falharam`);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === 'text/csv') {
      const input = fileInputRef.current;
      if (input) {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        handleFileSelect({ target: input } as React.ChangeEvent<HTMLInputElement>);
      }
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setParsedLeads([]);
    setParseError(null);
    setSelectedSystem('');
    setApiKey('');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Leads</DialogTitle>
          <DialogDescription>
            Importe leads de um arquivo CSV ou sincronize com outro CRM
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="csv" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="csv" className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Importar CSV
            </TabsTrigger>
            <TabsTrigger value="sync" className="gap-2">
              <Link2 className="h-4 w-4" />
              Sincronizar CRM
            </TabsTrigger>
          </TabsList>

          <TabsContent value="csv" className="flex-1 overflow-hidden flex flex-col space-y-4 mt-4">
            {/* File Upload Area */}
            <div
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium">Arraste seu arquivo CSV aqui</p>
              <p className="text-xs text-muted-foreground mt-1">
                ou clique para selecionar
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            {/* Parse Error */}
            {parseError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{parseError}</AlertDescription>
              </Alert>
            )}

            {/* Preview Table */}
            {parsedLeads.length > 0 && (
              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">
                    {parsedLeads.length} leads encontrados
                  </p>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </div>
                
                <ScrollArea className="flex-1 border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedLeads.slice(0, 10).map((lead, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{lead.name}</TableCell>
                          <TableCell>{lead.email || '-'}</TableCell>
                          <TableCell>{lead.phone || '-'}</TableCell>
                          <TableCell>
                            {lead.estimated_value 
                              ? `R$ ${lead.estimated_value.toLocaleString('pt-BR')}`
                              : '-'
                            }
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>

                {parsedLeads.length > 10 && (
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Mostrando 10 de {parsedLeads.length} leads
                  </p>
                )}

                <Button 
                  className="w-full mt-4" 
                  onClick={handleImport}
                  disabled={isImporting}
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Importar {parsedLeads.length} leads
                    </>
                  )}
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="sync" className="space-y-4 mt-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                A sincronização com CRMs externos está em desenvolvimento. 
                Em breve você poderá conectar diretamente com RD Station, Pipedrive e outros.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="crm-system">Sistema de Origem</Label>
                <Select value={selectedSystem} onValueChange={setSelectedSystem}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o CRM" />
                  </SelectTrigger>
                  <SelectContent>
                    {CRM_SYSTEMS.map((system) => (
                      <SelectItem key={system.id} value={system.id}>
                        {system.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="api-key">API Key</Label>
                <Input
                  id="api-key"
                  type="password"
                  placeholder="Insira sua API Key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  disabled
                />
              </div>

              <Button disabled className="w-full">
                <Link2 className="h-4 w-4 mr-2" />
                Conectar (Em breve)
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
