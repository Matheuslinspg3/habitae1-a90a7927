import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';
import type { DuplicatePropertyMatch } from '@/lib/duplicatePropertyDetector';

interface DuplicatePropertyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicates: DuplicatePropertyMatch[];
  onConfirm: () => void;
  onCancel: () => void;
}

export function DuplicatePropertyDialog({
  open,
  onOpenChange,
  duplicates,
  onConfirm,
  onCancel,
}: DuplicatePropertyDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Possível imóvel duplicado
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Foi encontrado {duplicates.length === 1 ? 'um imóvel' : `${duplicates.length} imóveis`} com
                endereço semelhante ao que você está cadastrando:
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {duplicates.map(dup => (
                  <div key={dup.id} className="p-3 rounded-lg border bg-muted/50 text-sm">
                    <p className="font-medium text-foreground">
                      {dup.title || 'Sem título'}
                      {dup.property_code && (
                        <span className="ml-2 text-muted-foreground">#{dup.property_code}</span>
                      )}
                    </p>
                    <p className="text-muted-foreground">
                      {[dup.address_street, dup.address_number].filter(Boolean).join(', ')}
                      {dup.address_neighborhood && ` — ${dup.address_neighborhood}`}
                      {dup.address_city && `, ${dup.address_city}`}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-muted-foreground">
                Deseja continuar com o cadastro mesmo assim?
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Cadastrar mesmo assim
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
