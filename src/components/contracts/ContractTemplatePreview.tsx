import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { ContractTemplate } from "@/hooks/useContractTemplates";

interface ContractTemplatePreviewProps {
  template: ContractTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const typeLabels: Record<string, string> = {
  venda: "Venda",
  locacao: "Locação",
  ambos: "Ambos",
};

export function ContractTemplatePreview({ template, open, onOpenChange }: ContractTemplatePreviewProps) {
  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {template.name}
            <Badge variant="outline" className="text-xs">
              {typeLabels[template.contract_type] || template.contract_type}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div
          className="prose prose-sm max-w-none border rounded-md p-6 bg-card"
          dangerouslySetInnerHTML={{ __html: template.body_html || "<p class='text-muted-foreground'>Template vazio</p>" }}
        />

        {template.variables.length > 0 && (
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Variáveis utilizadas:</p>
            <div className="flex flex-wrap gap-1.5">
              {template.variables.map((v) => (
                <span key={v} className="inline-flex px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-mono">
                  {v}
                </span>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
