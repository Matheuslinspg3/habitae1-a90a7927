import { Progress } from '@/components/ui/progress';
import { Loader2 } from 'lucide-react';

interface ProcessingStepProps {
  processed: number;
  total: number;
  isProcessing: boolean;
}

export function ProcessingStep({ processed, total, isProcessing }: ProcessingStepProps) {
  const percent = total > 0 ? Math.round((processed / total) * 100) : 0;

  return (
    <div className="flex flex-col items-center justify-center py-8 space-y-6">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      
      <div className="text-center space-y-1">
        <p className="text-lg font-semibold">Importando leads...</p>
        <p className="text-sm text-muted-foreground">
          {processed} de {total} processados
        </p>
      </div>

      <div className="w-full max-w-sm space-y-2">
        <Progress value={percent} className="h-2" />
        <p className="text-xs text-center text-muted-foreground">{percent}%</p>
      </div>

      <p className="text-xs text-muted-foreground">
        Não feche esta janela durante o processamento
      </p>
    </div>
  );
}
