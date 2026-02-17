import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useInvoices, type Invoice, type InvoiceFormData } from '@/hooks/useInvoices';
import { useLeads } from '@/hooks/useLeads';
import { useContracts } from '@/hooks/useContracts';

interface InvoiceFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice?: Invoice | null;
}

export function InvoiceForm({ open, onOpenChange, invoice }: InvoiceFormProps) {
  const { createInvoice, updateInvoice, isCreating, isUpdating } = useInvoices();
  const { leads } = useLeads();
  const { contracts } = useContracts();

  const [formData, setFormData] = useState<InvoiceFormData>({
    description: '',
    amount: 0,
    due_date: new Date().toISOString().split('T')[0],
    status: 'pendente',
    lead_id: null,
    contract_id: null,
    notes: null,
    paid_at: null,
  });

  useEffect(() => {
    if (invoice) {
      setFormData({
        description: invoice.description,
        amount: Number(invoice.amount),
        due_date: invoice.due_date,
        status: invoice.status as InvoiceFormData['status'],
        lead_id: invoice.lead_id || null,
        contract_id: invoice.contract_id || null,
        notes: invoice.notes || null,
        paid_at: invoice.paid_at || null,
      });
    } else {
      setFormData({
        description: '',
        amount: 0,
        due_date: new Date().toISOString().split('T')[0],
        status: 'pendente',
        lead_id: null,
        contract_id: null,
        notes: null,
        paid_at: null,
      });
    }
  }, [invoice, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (invoice) {
      updateInvoice({ ...formData, id: invoice.id });
    } else {
      createInvoice(formData);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {invoice ? 'Editar Cobrança' : 'Nova Cobrança'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Descrição *</Label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Ex: Aluguel mensal"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valor *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.amount || ''}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                placeholder="0,00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Vencimento *</Label>
              <Input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status *</Label>
              <Select
                value={formData.status}
                onValueChange={(value: InvoiceFormData['status']) => {
                  const updates: Partial<InvoiceFormData> = { status: value };
                  if (value === 'pago') {
                    updates.paid_at = new Date().toISOString();
                  } else {
                    updates.paid_at = null;
                  }
                  setFormData({ ...formData, ...updates });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="atrasado">Atrasado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.status === 'pago' && (
              <div className="space-y-2">
                <Label>Data de Pagamento</Label>
                <Input
                  type="date"
                  value={formData.paid_at?.split('T')[0] || ''}
                  onChange={(e) => setFormData({ ...formData, paid_at: e.target.value })}
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Cliente</Label>
            <Select
              value={formData.lead_id || 'none'}
              onValueChange={(value) =>
                setFormData({ ...formData, lead_id: value === 'none' ? null : value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {leads.map((lead) => (
                  <SelectItem key={lead.id} value={lead.id}>
                    {lead.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Contrato Vinculado</Label>
            <Select
              value={formData.contract_id || 'none'}
              onValueChange={(value) =>
                setFormData({ ...formData, contract_id: value === 'none' ? null : value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {contracts.map((contract) => (
                  <SelectItem key={contract.id} value={contract.id}>
                    {contract.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Observações adicionais..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isCreating || isUpdating}>
              {isCreating || isUpdating ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
