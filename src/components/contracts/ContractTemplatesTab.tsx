import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, FileText, MoreHorizontal, Pencil, Trash2, Eye } from "lucide-react";
import { useContractTemplates, type ContractTemplate, type ContractTemplateFormData } from "@/hooks/useContractTemplates";
import { ContractTemplateForm } from "./ContractTemplateForm";
import { ContractTemplatePreview } from "./ContractTemplatePreview";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const typeLabels: Record<string, string> = {
  venda: "Venda",
  locacao: "Locação",
  ambos: "Ambos",
};

export function ContractTemplatesTab() {
  const { templates, isLoading, createTemplate, updateTemplate, deleteTemplate, isCreating, isUpdating } = useContractTemplates();
  const [formOpen, setFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ContractTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<ContractTemplate | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);

  const handleCreate = () => { setEditingTemplate(null); setFormOpen(true); };
  const handleEdit = (t: ContractTemplate) => { setEditingTemplate(t); setFormOpen(true); };

  const handleSubmit = (data: ContractTemplateFormData) => {
    if (editingTemplate) {
      updateTemplate({ id: editingTemplate.id, data });
    } else {
      createTemplate(data);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Templates de Contrato</h3>
          <p className="text-sm text-muted-foreground">Modelos reutilizáveis com variáveis auto-preenchíveis</p>
        </div>
        <Button onClick={handleCreate} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Novo Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center text-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Nenhum template criado</h3>
            <p className="text-muted-foreground mt-1 mb-4">
              Crie templates de contrato com variáveis que serão preenchidas automaticamente
            </p>
            <Button onClick={handleCreate} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Criar Primeiro Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.id} className="group hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{t.name}</h4>
                    {t.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{t.description}</p>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setPreviewTemplate(t)}>
                        <Eye className="h-4 w-4 mr-2" /> Visualizar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEdit(t)}>
                        <Pencil className="h-4 w-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => { setTemplateToDelete(t.id); setDeleteDialogOpen(true); }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center gap-2 mt-3">
                  <Badge variant="outline" className="text-xs">
                    {typeLabels[t.contract_type] || t.contract_type}
                  </Badge>
                  {t.variables.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {t.variables.length} variáve{t.variables.length > 1 ? "is" : "l"}
                    </span>
                  )}
                </div>

                <p className="text-xs text-muted-foreground mt-2">
                  Criado em {format(new Date(t.created_at), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ContractTemplateForm
        open={formOpen}
        onOpenChange={setFormOpen}
        template={editingTemplate}
        onSubmit={handleSubmit}
        isSubmitting={isCreating || isUpdating}
      />

      <ContractTemplatePreview
        template={previewTemplate}
        open={!!previewTemplate}
        onOpenChange={(open) => !open && setPreviewTemplate(null)}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este template? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (templateToDelete) deleteTemplate(templateToDelete);
                setTemplateToDelete(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
