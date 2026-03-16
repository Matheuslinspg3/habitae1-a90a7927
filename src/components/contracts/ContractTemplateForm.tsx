import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Eye, Pencil } from "lucide-react";
import { RichTextEditor, AVAILABLE_VARIABLES } from "./RichTextEditor";
import type { ContractTemplate, ContractTemplateFormData } from "@/hooks/useContractTemplates";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  ResizablePanelGroup, ResizablePanel, ResizableHandle,
} from "@/components/ui/resizable";

interface ContractTemplateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: ContractTemplate | null;
  onSubmit: (data: ContractTemplateFormData) => void;
  isSubmitting: boolean;
}

const typeLabels: Record<string, string> = {
  venda: "Venda",
  locacao: "Locação",
  ambos: "Ambos",
};

const sampleData: Record<string, string> = {
  "{{nome_cliente}}": "João da Silva",
  "{{cpf_cliente}}": "123.456.789-00",
  "{{email_cliente}}": "joao@email.com",
  "{{telefone_cliente}}": "(11) 99999-0000",
  "{{endereco_imovel}}": "Rua das Flores, 123 - São Paulo/SP",
  "{{codigo_imovel}}": "IMV-00042",
  "{{titulo_imovel}}": "Apartamento 3 quartos - Centro",
  "{{valor_contrato}}": "R$ 350.000,00",
  "{{tipo_contrato}}": "Venda",
  "{{data_inicio}}": "16/03/2026",
  "{{data_fim}}": "16/03/2027",
  "{{corretor_nome}}": "Maria Souza",
  "{{comissao}}": "5%",
  "{{dia_pagamento}}": "10",
  "{{indice_reajuste}}": "IGPM",
  "{{data_atual}}": new Date().toLocaleDateString("pt-BR"),
};

function renderPreviewHtml(html: string): string {
  if (!html || html === "<p></p>") {
    return `<p style="color: #9ca3af; text-align: center; padding: 4rem 0;">O conteúdo do contrato aparecerá aqui conforme você edita...</p>`;
  }
  let rendered = html;
  for (const [key, value] of Object.entries(sampleData)) {
    rendered = rendered.split(key).join(
      `<span style="background: hsl(var(--primary) / 0.15); color: hsl(var(--primary)); padding: 1px 4px; border-radius: 4px; font-weight: 500;">${value}</span>`
    );
  }
  return rendered;
}

export function ContractTemplateForm({ open, onOpenChange, template, onSubmit, isSubmitting }: ContractTemplateFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [contractType, setContractType] = useState("venda");
  const [bodyHtml, setBodyHtml] = useState("");
  const [mobileTab, setMobileTab] = useState<"editor" | "preview">("editor");
  const isMobile = useIsMobile();

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
    setMobileTab("editor");
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

  const detectedVars = extractVariables(bodyHtml);

  const metaFields = (
    <div className="space-y-3 px-1">
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
          className="mt-1.5 min-h-[50px] resize-none"
        />
      </div>
    </div>
  );

  const editorPanel = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-1 pb-2">
        <Label className="text-sm font-semibold flex items-center gap-1.5">
          <Pencil className="h-3.5 w-3.5" />
          Editor
        </Label>
        {detectedVars.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            {detectedVars.length} variáve{detectedVars.length > 1 ? "is" : "l"}
          </Badge>
        )}
      </div>
      <div className="flex-1 min-h-0">
        <RichTextEditor
          content={bodyHtml}
          onChange={setBodyHtml}
          placeholder="Escreva o modelo do contrato aqui. Use o botão 'Inserir Variável' para adicionar campos dinâmicos..."
          className="h-full [&_.ProseMirror]:min-h-[400px]"
        />
      </div>
    </div>
  );

  const previewPanel = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-1 pb-2">
        <Label className="text-sm font-semibold flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5" />
          Pré-visualização
        </Label>
        <Badge variant="outline" className="text-xs">
          {typeLabels[contractType] || contractType}
        </Badge>
      </div>
      <div className="flex-1 min-h-0 border rounded-md bg-card overflow-y-auto">
        {/* Simulated paper */}
        <div className="mx-auto max-w-[720px] bg-background shadow-sm border border-border/50 rounded my-4 mx-4">
          {/* Header bar */}
          <div className="border-b px-6 py-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-base text-foreground">{name || "Título do Contrato"}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{typeLabels[contractType] || contractType}</p>
            </div>
            <span className="text-xs text-muted-foreground">
              {new Date().toLocaleDateString("pt-BR")}
            </span>
          </div>
          {/* Body */}
          <div
            className="prose prose-sm max-w-none p-6 text-foreground [&_p]:leading-relaxed"
            dangerouslySetInnerHTML={{ __html: renderPreviewHtml(bodyHtml) }}
          />
          {/* Signature area */}
          <div className="border-t px-6 py-6">
            <div className="grid grid-cols-2 gap-8">
              <div className="text-center">
                <div className="border-b border-dashed border-muted-foreground/40 mb-1 h-12" />
                <p className="text-xs text-muted-foreground">Contratante</p>
              </div>
              <div className="text-center">
                <div className="border-b border-dashed border-muted-foreground/40 mb-1 h-12" />
                <p className="text-xs text-muted-foreground">Contratado</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1400px] h-[90dvh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
          <DialogTitle>{template ? "Editar Template" : "Novo Template de Contrato"}</DialogTitle>
          <DialogDescription>
            Use variáveis como {"{{nome_cliente}}"} para campos que serão preenchidos automaticamente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="px-6 pt-4 pb-3 shrink-0">
            {metaFields}
          </div>

          {/* Mobile toggle */}
          {isMobile && (
            <div className="flex gap-1 px-6 pb-2 shrink-0">
              <Button
                type="button" variant={mobileTab === "editor" ? "default" : "outline"}
                size="sm" className="flex-1 gap-1.5"
                onClick={() => setMobileTab("editor")}
              >
                <Pencil className="h-3.5 w-3.5" /> Editor
              </Button>
              <Button
                type="button" variant={mobileTab === "preview" ? "default" : "outline"}
                size="sm" className="flex-1 gap-1.5"
                onClick={() => setMobileTab("preview")}
              >
                <Eye className="h-3.5 w-3.5" /> Preview
              </Button>
            </div>
          )}

          {/* Split canvas */}
          <div className="flex-1 min-h-0 px-4 pb-2">
            {isMobile ? (
              <div className="h-full">
                {mobileTab === "editor" ? editorPanel : previewPanel}
              </div>
            ) : (
              <ResizablePanelGroup direction="horizontal" className="h-full rounded-lg border">
                <ResizablePanel defaultSize={55} minSize={35}>
                  <div className="h-full p-3">
                    {editorPanel}
                  </div>
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={45} minSize={30}>
                  <div className="h-full p-3">
                    {previewPanel}
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            )}
          </div>

          {/* Detected variables */}
          {detectedVars.length > 0 && (
            <div className="px-6 pb-2 shrink-0">
              <div className="rounded-lg bg-muted p-2.5 flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-muted-foreground">Variáveis:</span>
                {detectedVars.map((v) => {
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

          {/* Footer */}
          <div className="px-6 py-3 border-t flex items-center justify-end gap-2 shrink-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="min-h-[44px]">
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()} className="min-h-[44px]">
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {template ? "Salvar" : "Criar Template"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
