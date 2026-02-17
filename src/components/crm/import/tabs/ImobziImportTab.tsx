import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { ImportSettingsStep, type ImportSettingsData } from '../steps/ImportSettingsStep';
import { ProcessingStep } from '../steps/ProcessingStep';
import { ReportStep } from '../steps/ReportStep';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, Download, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface ImobziLead {
  external_id: string;
  name: string;
  email?: string;
  phone?: string;
  source?: string;
  notes?: string;
  contact_type?: string;
  created_at?: string;
  external_source: string;
}

export function ImobziImportTab({ onClose }: { onClose: () => void }) {
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState<string>('');
  const [leads, setLeads] = useState<ImobziLead[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<'select' | 'preview' | 'settings' | 'processing' | 'report'>('select');
  const [settings, setSettings] = useState<ImportSettingsData>({
    targetStage: 'novo',
    brokerId: null,
    autoTemperature: true,
  });
  const [report, setReport] = useState<any>(null);

  useEffect(() => {
    const fetchKeys = async () => {
      const { data } = await supabase.from('imobzi_api_keys').select('id, name');
      setApiKeys(data || []);
      if (data && data.length === 1) setSelectedKeyId(data[0].id);
    };
    fetchKeys();
  }, []);

  const fetchLeads = async () => {
    if (!selectedKeyId) return;
    setIsFetching(true);
    setError(null);

    try {
      const response = await supabase.functions.invoke('crm-import-leads', {
        body: { action: 'fetch-leads', api_key_id: selectedKeyId },
      });
      if (response.error) throw new Error(response.error.message);
      const fetched = response.data?.leads || [];
      setLeads(fetched);
      setSelectedIds(new Set(fetched.map((l: ImobziLead) => l.external_id)));
      setPhase('preview');
    } catch (e: any) {
      setError(e.message || 'Erro ao buscar leads do Imobzi');
    } finally {
      setIsFetching(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === leads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(leads.map(l => l.external_id)));
    }
  };

  const handleImport = async () => {
    setPhase('processing');
    const selected = leads.filter(l => selectedIds.has(l.external_id));

    try {
      const response = await supabase.functions.invoke('crm-import-leads', {
        body: {
          action: 'import-leads',
          leads: selected,
          settings: {
            target_stage: settings.targetStage,
            broker_id: settings.brokerId,
            auto_temperature: settings.autoTemperature,
            duplicate_action: 'skip',
          },
        },
      });
      if (response.error) throw new Error(response.error.message);
      setReport(response.data);
      setPhase('report');
    } catch (e: any) {
      toast.error(e.message || 'Erro na importação');
      setPhase('settings');
    }
  };

  if (phase === 'processing') {
    return <ProcessingStep processed={0} total={selectedIds.size} isProcessing />;
  }

  if (phase === 'report' && report) {
    return (
      <ReportStep
        report={report}
        onClose={onClose}
        onNewImport={() => { setPhase('select'); setLeads([]); }}
      />
    );
  }

  if (phase === 'settings') {
    return (
      <div className="space-y-4">
        <ImportSettingsStep settings={settings} onSettingsChange={setSettings} />
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPhase('preview')} className="flex-1">
            Voltar
          </Button>
          <Button onClick={handleImport} className="flex-1">
            Importar {selectedIds.size} leads
          </Button>
        </div>
      </div>
    );
  }

  if (phase === 'preview') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {selectedIds.size} de {leads.length} selecionados
          </p>
          <Button variant="ghost" size="sm" onClick={toggleAll}>
            {selectedIds.size === leads.length ? 'Desmarcar todos' : 'Selecionar todos'}
          </Button>
        </div>

        <ScrollArea className="h-64 border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Tags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map(lead => (
                <TableRow key={lead.external_id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(lead.external_id)}
                      onCheckedChange={() => toggleSelect(lead.external_id)}
                    />
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{lead.name}</div>
                    {lead.email && <div className="text-xs text-muted-foreground">{lead.email}</div>}
                  </TableCell>
                  <TableCell className="text-sm">{lead.phone || '-'}</TableCell>
                  <TableCell className="text-sm">{lead.source || '-'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{lead.notes || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPhase('select')} className="flex-1">
            Voltar
          </Button>
          <Button onClick={() => setPhase('settings')} disabled={selectedIds.size === 0} className="flex-1">
            Configurar importação
          </Button>
        </div>
      </div>
    );
  }

  // Select phase
  return (
    <div className="space-y-4">
      {apiKeys.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Nenhuma chave API do Imobzi configurada. Adicione uma chave em Integrações → Imobzi.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="space-y-2">
            <Label>Chave API do Imobzi</Label>
            <Select value={selectedKeyId} onValueChange={setSelectedKeyId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma chave" />
              </SelectTrigger>
              <SelectContent>
                {apiKeys.map(k => (
                  <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={fetchLeads}
            disabled={!selectedKeyId || isFetching}
            className="w-full"
          >
            {isFetching ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Buscando leads...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Buscar leads do Imobzi
              </>
            )}
          </Button>
        </>
      )}
    </div>
  );
}
