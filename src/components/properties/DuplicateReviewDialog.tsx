import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, Building2, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import { DuplicatePropertyMatch } from '@/lib/duplicatePropertyDetector';

export interface DuplicateCandidate {
  index: number;
  label: string;
  address: string;
  complement: string;
  matches: DuplicatePropertyMatch[];
}

interface DuplicateReviewDialogProps {
  open: boolean;
  candidates: DuplicateCandidate[];
  importedCount: number;
  onConfirm: (selectedIndices: number[]) => void;
  onCancel: () => void;
}

export function DuplicateReviewDialog({
  open,
  candidates,
  importedCount,
  onConfirm,
  onCancel,
}: DuplicateReviewDialogProps) {
  const [importAnyway, setImportAnyway] = useState<Set<number>>(new Set());

  const toggleItem = (index: number) => {
    setImportAnyway(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleAll = () => {
    if (importAnyway.size === candidates.length) {
      setImportAnyway(new Set());
    } else {
      setImportAnyway(new Set(candidates.map(c => c.index)));
    }
  };

  const handleConfirm = () => {
    onConfirm(Array.from(importAnyway));
  };

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-2xl [display:flex] flex-col max-h-[85vh]">
        <AlertDialogHeader className="shrink-0">
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            Revisão de importação
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-1">
              {importedCount > 0 && (
                <p className="flex items-center gap-1.5 text-sm text-primary">
                  <CheckCircle2 className="w-4 h-4" />
                  {importedCount} {importedCount === 1 ? 'imóvel importado' : 'imóveis importados'} com sucesso
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                {candidates.length} {candidates.length === 1 ? 'imóvel possui' : 'imóveis possuem'} endereço similar a imóveis já cadastrados.
                Revise abaixo e marque os que deseja importar mesmo assim.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Tabs defaultValue="list" className="flex-1 overflow-hidden flex flex-col min-h-0">
          <TabsList className="shrink-0 w-full grid grid-cols-2">
            <TabsTrigger value="list">
              <XCircle className="w-4 h-4 mr-1.5" />
              Ignorados ({candidates.length})
            </TabsTrigger>
            <TabsTrigger value="details">
              <Building2 className="w-4 h-4 mr-1.5" />
              Detalhes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="flex-1 overflow-y-auto min-h-0 mt-3">
            <div className="space-y-3">
              {candidates.map((candidate) => (
                <div
                  key={candidate.index}
                  className={`rounded-lg border p-3 cursor-pointer transition-colors ${
                    importAnyway.has(candidate.index)
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/50'
                  }`}
                  onClick={() => toggleItem(candidate.index)}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={importAnyway.has(candidate.index)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{candidate.label}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {candidate.address}
                        {candidate.complement && ` - ${candidate.complement}`}
                      </p>

                      <div className="mt-2 space-y-1">
                        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <ArrowRight className="w-3 h-3" />
                          Similar a:
                        </p>
                        {candidate.matches.slice(0, 2).map((match) => (
                          <div key={match.id} className="flex items-center gap-2 text-xs text-muted-foreground pl-4">
                            <Building2 className="w-3 h-3 shrink-0" />
                            <span className="truncate">
                              {match.title || match.property_code || 'Sem título'}
                            </span>
                            <Badge variant="outline" className="text-[10px] shrink-0">
                              {match.status}
                            </Badge>
                          </div>
                        ))}
                        {candidate.matches.length > 2 && (
                          <p className="text-[10px] text-muted-foreground pl-4">
                            +{candidate.matches.length - 2} outro(s)
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="details" className="flex-1 overflow-y-auto min-h-0 mt-3">
            <div className="space-y-4">
              {candidates.map((candidate) => (
                <div key={candidate.index} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">Novo</Badge>
                    <span className="font-medium text-sm">{candidate.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {candidate.address}
                    {candidate.complement && ` - ${candidate.complement}`}
                  </p>

                  <div className="border-t pt-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Imóve{candidate.matches.length === 1 ? 'l' : 'is'} existente{candidate.matches.length === 1 ? '' : 's'} com endereço similar:
                    </p>
                    {candidate.matches.map((match) => (
                      <div key={match.id} className="rounded-md bg-muted/50 p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">
                            {match.title || 'Sem título'}
                          </span>
                          <Badge variant="outline" className="text-[10px]">
                            {match.status}
                          </Badge>
                        </div>
                        {match.property_code && (
                          <p className="text-xs text-muted-foreground">
                            Código: {match.property_code}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {[match.address_street, match.address_number].filter(Boolean).join(', ')}
                          {match.address_neighborhood && ` - ${match.address_neighborhood}`}
                          {match.address_city && `, ${match.address_city}`}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <AlertDialogFooter className="shrink-0 flex-col sm:flex-row gap-2 pt-4 border-t">
          <Button variant="ghost" size="sm" onClick={toggleAll} className="mr-auto">
            {importAnyway.size === candidates.length ? 'Desmarcar' : 'Selecionar'} todos
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Pular duplicatas
          </Button>
          <Button onClick={handleConfirm} disabled={importAnyway.size === 0}>
            Importar {importAnyway.size > 0 ? `${importAnyway.size} selecionado${importAnyway.size > 1 ? 's' : ''}` : ''}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
