import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { RichTextEditor, AVAILABLE_VARIABLES } from "./RichTextEditor";
import type { ContractTemplate, ContractTemplateFormData } from "@/hooks/useContractTemplates";

interface ContractTemplateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: ContractTemplate | null;
  onSubmit: (data: ContractTemplateFormData) => void;
  isSubmitting: boolean;
}

export function ContractTemplateForm({ open, onOpenChange, template, onSubmit, isSubmitting }: ContractTemplateFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [contractType, setContractType] = useState("venda");
  const [bodyHtml, setBodyHtml] = useState("");

  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || "");
      setContractType(template.contract_type);
      setBodyHtml(template.body_html);
    } else {
      setName("");
      setDescription("");
      setContractType("venda");
      setBodyHtml("");
    }
  }, [template, open]);

  const extractVariables = (html: string): string[] => {
    const matches = html.match(/\{\{[a-z_]+\}\}/g) || [];
    return [...new Set(matches)];
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSubmit({
      name: name.trim(),
      description: description.trim() || null,
      contract_type: contractType,
      body_html: bodyHtml,
      variables: extractVariables(bodyHtml),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? "Editar Template" : "Novo Template de Contrato"}</DialogTitle>
          <DialogDescription>
            Use variáveis como {"{{nome_cliente}}"} para campos que serão preenchidos automaticamente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Label htmlFor="tpl-name">Nome do Template *</Label>
              <Input
                id="tpl-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Contrato de Locação Residencial"
                className="mt-1.5 min-h-[44px]"
                required
              />
            </div>
            <div>
              <Label>Tipo de Contrato</Label>
              <Select value={contractType} onValueChange={setContractType}>
                <SelectTrigger className="mt-1.5 min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="venda">Venda</SelectItem>
                  <SelectItem value="locacao">Locação</SelectItem>
                  <SelectItem value="ambos">Ambos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="tpl-desc">Descrição (opcional)</Label>
            <Textarea
              id="tpl-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve descrição do template..."
              className="mt-1.5 min-h-[60px] resize-none"
            />
          </div>

          <div>
            <Label>Corpo do Contrato</Label>
            <div className="mt-1.5">
              <RichTextEditor
                content={bodyHtml}
                onChange={setBodyHtml}
                placeholder="Escreva o modelo do contrato aqui. Use o botão 'Inserir Variável' para adicionar campos dinâmicos..."
              />
            </div>
          </div>

          {extractVariables(bodyHtml).length > 0 && (
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Variáveis detectadas:</p>
              <div className="flex flex-wrap gap-1.5">
                {extractVariables(bodyHtml).map((v) => {
                  const info = AVAILABLE_VARIABLES.find((av) => av.key === v);
                  return (
                    <span key={v} className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-mono">
                      {v}
                      {info && <span className="ml-1 text-muted-foreground font-sans">({info.label})</span>}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="min-h-[44px]">
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()} className="min-h-[44px]">
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {template ? "Salvar" : "Criar Template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
