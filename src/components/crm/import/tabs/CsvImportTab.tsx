import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { UploadStep } from '../steps/UploadStep';
import { FieldMappingStep } from '../steps/FieldMappingStep';
import { DuplicateReviewStep } from '../steps/DuplicateReviewStep';
import { ImportSettingsStep, type ImportSettingsData } from '../steps/ImportSettingsStep';
import { ProcessingStep } from '../steps/ProcessingStep';
import { ReportStep } from '../steps/ReportStep';
import { autoMapFields, validateMapping, type FieldMapping } from '../utils/fieldMatcher';
import { detectDuplicates, type DuplicateResult } from '../utils/duplicateDetector';
import { type CSVParseResult, type ParsedRow } from '../utils/csvParser';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

const STEPS = ['Upload', 'Mapeamento', 'Duplicidade', 'Configurações', 'Processando', 'Relatório'];

export function CsvImportTab({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [csvResult, setCsvResult] = useState<CSVParseResult | null>(null);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [duplicateResult, setDuplicateResult] = useState<DuplicateResult | null>(null);
  const [isDuplicateLoading, setIsDuplicateLoading] = useState(false);
  const [duplicateAction, setDuplicateAction] = useState<'skip' | 'update' | 'create'>('skip');
  const [settings, setSettings] = useState<ImportSettingsData>({
    targetStage: 'novo',
    brokerId: null,
    autoTemperature: true,
  });
  const [report, setReport] = useState<any>(null);
  const [processing, setProcessing] = useState({ processed: 0, total: 0, active: false });

  const handleCSVParsed = useCallback((result: CSVParseResult) => {
    setCsvResult(result);
    const autoMapped = autoMapFields(result.headers);
    setMappings(autoMapped);
  }, []);

  const handleNext = async () => {
    if (step === 0 && !csvResult) return;

    if (step === 1) {
      const validation = validateMapping(mappings);
      if (!validation.valid) {
        toast.error(validation.error);
        return;
      }
      // Run duplicate detection
      setIsDuplicateLoading(true);
      setStep(2);
      try {
        const fieldMap: Record<string, string | null> = {};
        mappings.forEach(m => { fieldMap[m.csvField] = m.habitaeField; });
        const result = await detectDuplicates(csvResult!.rows, fieldMap);
        setDuplicateResult(result);
      } catch (e) {
        toast.error('Erro ao verificar duplicidades');
      } finally {
        setIsDuplicateLoading(false);
      }
      return;
    }

    if (step === 3) {
      // Start processing
      setStep(4);
      await processImport();
      return;
    }

    setStep(s => s + 1);
  };

  const processImport = async () => {
    if (!csvResult) return;

    const fieldMap: Record<string, string | null> = {};
    mappings.forEach(m => { fieldMap[m.csvField] = m.habitaeField; });

    // Transform rows to lead objects
    const leads = csvResult.rows.map(row => {
      const lead: any = {};
      for (const [csvField, habitaeField] of Object.entries(fieldMap)) {
        if (!habitaeField || !row[csvField]) continue;
        if (habitaeField === 'estimated_value') {
          const cleanVal = row[csvField].replace(/[^\d.,]/g, '').replace(',', '.');
          lead[habitaeField] = parseFloat(cleanVal) || null;
        } else {
          lead[habitaeField] = row[csvField];
        }
      }
      // Ensure name exists
      if (!lead.name && lead.email) lead.name = lead.email;
      if (!lead.name && lead.phone) lead.name = lead.phone;
      if (!lead.name) lead.name = 'Lead sem nome';
      return lead;
    });

    setProcessing({ processed: 0, total: leads.length, active: true });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Sessão expirada. Faça login novamente.');
        return;
      }

      const response = await supabase.functions.invoke('crm-import-leads', {
        body: {
          action: 'process-csv',
          leads,
          settings: {
            target_stage: settings.targetStage,
            broker_id: settings.brokerId,
            auto_temperature: settings.autoTemperature,
            duplicate_action: duplicateAction,
          },
          file_name: 'csv_upload',
        },
      });

      if (response.error) throw new Error(response.error.message);

      setReport(response.data);
      setProcessing({ processed: leads.length, total: leads.length, active: false });
      setStep(5);
    } catch (error: any) {
      toast.error(error.message || 'Erro durante a importação');
      setStep(3); // Go back to settings
      setProcessing({ processed: 0, total: 0, active: false });
    }
  };

  const canGoNext = () => {
    if (step === 0) return !!csvResult;
    if (step === 1) return validateMapping(mappings).valid;
    if (step === 2) return !isDuplicateLoading;
    if (step === 3) return true;
    return false;
  };

  const handleNewImport = () => {
    setStep(0);
    setCsvResult(null);
    setMappings([]);
    setDuplicateResult(null);
    setReport(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Stepper */}
      {step < 5 && (
        <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
          {STEPS.slice(0, 5).map((label, i) => (
            <div key={i} className="flex items-center gap-1">
              <div
                className={`flex items-center justify-center h-6 w-6 rounded-full text-xs font-medium shrink-0 ${
                  i === step
                    ? 'bg-primary text-primary-foreground'
                    : i < step
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {i + 1}
              </div>
              <span className={`text-xs whitespace-nowrap hidden sm:inline ${
                i === step ? 'text-foreground font-medium' : 'text-muted-foreground'
              }`}>
                {label}
              </span>
              {i < 4 && <div className="w-4 h-px bg-border shrink-0" />}
            </div>
          ))}
        </div>
      )}

      {/* Step content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {step === 0 && <UploadStep onParsed={handleCSVParsed} />}
        {step === 1 && <FieldMappingStep mappings={mappings} onMappingsChange={setMappings} />}
        {step === 2 && (
          <DuplicateReviewStep
            newCount={duplicateResult?.newLeads.length || 0}
            duplicateCount={duplicateResult?.duplicates.length || 0}
            errorCount={duplicateResult?.errors.length || 0}
            isLoading={isDuplicateLoading}
            duplicateAction={duplicateAction}
            onDuplicateActionChange={setDuplicateAction}
          />
        )}
        {step === 3 && <ImportSettingsStep settings={settings} onSettingsChange={setSettings} />}
        {step === 4 && (
          <ProcessingStep
            processed={processing.processed}
            total={processing.total}
            isProcessing={processing.active}
          />
        )}
        {step === 5 && report && (
          <ReportStep report={report} onClose={onClose} onNewImport={handleNewImport} />
        )}
      </div>

      {/* Navigation */}
      {step < 4 && (
        <div className="flex justify-between mt-4 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <Button onClick={handleNext} disabled={!canGoNext()}>
            {step === 3 ? 'Importar' : 'Próximo'}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
  );
}
