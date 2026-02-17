import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface DuplicateReviewStepProps {
  newCount: number;
  duplicateCount: number;
  errorCount: number;
  isLoading: boolean;
  duplicateAction: 'skip' | 'update' | 'create';
  onDuplicateActionChange: (action: 'skip' | 'update' | 'create') => void;
}

export function DuplicateReviewStep({
  newCount,
  duplicateCount,
  errorCount,
  isLoading,
  duplicateAction,
  onDuplicateActionChange,
}: DuplicateReviewStepProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col items-center p-4 rounded-lg border bg-card">
          <CheckCircle2 className="h-6 w-6 text-green-500 mb-2" />
          <span className="text-2xl font-bold">{newCount}</span>
          <span className="text-xs text-muted-foreground">Novos</span>
        </div>
        <div className="flex flex-col items-center p-4 rounded-lg border bg-card">
          <AlertTriangle className="h-6 w-6 text-yellow-500 mb-2" />
          <span className="text-2xl font-bold">{duplicateCount}</span>
          <span className="text-xs text-muted-foreground">Duplicados</span>
        </div>
        <div className="flex flex-col items-center p-4 rounded-lg border bg-card">
          <XCircle className="h-6 w-6 text-destructive mb-2" />
          <span className="text-2xl font-bold">{errorCount}</span>
          <span className="text-xs text-muted-foreground">Com erro</span>
        </div>
      </div>

      {duplicateCount > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">O que fazer com os duplicados?</p>
          <RadioGroup
            value={duplicateAction}
            onValueChange={(v) => onDuplicateActionChange(v as any)}
            className="space-y-2"
          >
            <div className="flex items-center space-x-3 p-3 rounded-lg border">
              <RadioGroupItem value="skip" id="skip" />
              <Label htmlFor="skip" className="flex-1 cursor-pointer">
                <span className="font-medium">Ignorar duplicados</span>
                <p className="text-xs text-muted-foreground">Não importar leads já existentes</p>
              </Label>
            </div>
            <div className="flex items-center space-x-3 p-3 rounded-lg border">
              <RadioGroupItem value="update" id="update" />
              <Label htmlFor="update" className="flex-1 cursor-pointer">
                <span className="font-medium">Atualizar existentes</span>
                <p className="text-xs text-muted-foreground">Atualizar dados dos leads já cadastrados</p>
              </Label>
            </div>
            <div className="flex items-center space-x-3 p-3 rounded-lg border">
              <RadioGroupItem value="create" id="create" />
              <Label htmlFor="create" className="flex-1 cursor-pointer">
                <span className="font-medium">Criar novos mesmo assim</span>
                <p className="text-xs text-muted-foreground">Importar todos, mesmo os duplicados</p>
              </Label>
            </div>
          </RadioGroup>
        </div>
      )}
    </div>
  );
}
