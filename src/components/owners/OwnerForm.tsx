import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import type { OwnerWithDetails } from "@/hooks/useOwners";

interface OwnerFormData {
  name: string;
  phone: string;
  email: string;
  document: string;
  notes: string;
}

interface OwnerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  owner?: OwnerWithDetails | null;
  onSubmit: (data: OwnerFormData) => void;
  isSubmitting: boolean;
}

export function OwnerForm({ open, onOpenChange, owner, onSubmit, isSubmitting }: OwnerFormProps) {
  const { register, handleSubmit, formState: { errors }, reset } = useForm<OwnerFormData>({
    defaultValues: {
      name: owner?.primary_name || "",
      phone: owner?.phone || "",
      email: owner?.email || "",
      document: owner?.document || "",
      notes: owner?.notes || "",
    },
  });

  // Reset form values when owner changes (fixes stale data on edit)
  useEffect(() => {
    if (open) {
      reset({
        name: owner?.primary_name || "",
        phone: owner?.phone || "",
        email: owner?.email || "",
        document: owner?.document || "",
        notes: owner?.notes || "",
      });
    }
  }, [owner, open, reset]);

  // Reset form when owner changes
  const isEdit = !!owner;

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Proprietário" : "Novo Proprietário"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              placeholder="Nome completo"
              {...register("name", { required: "Nome é obrigatório" })}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone *</Label>
            <Input
              id="phone"
              placeholder="(00) 00000-0000"
              {...register("phone", { required: "Telefone é obrigatório" })}
            />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" placeholder="email@exemplo.com" {...register("email")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="document">CPF/CNPJ</Label>
              <Input id="document" placeholder="000.000.000-00" {...register("document")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea id="notes" placeholder="Informações adicionais..." className="min-h-[80px]" {...register("notes")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : isEdit ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
