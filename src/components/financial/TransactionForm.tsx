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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTransactions, type Transaction, type TransactionFormData } from '@/hooks/useTransactions';
import { useTransactionCategories } from '@/hooks/useTransactionCategories';
import { useContracts } from '@/hooks/useContracts';

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: Transaction | null;
}

export function TransactionForm({ open, onOpenChange, transaction }: TransactionFormProps) {
  const { createTransaction, updateTransaction, isCreating, isUpdating } = useTransactions();
  const { revenueCategories, expenseCategories } = useTransactionCategories();
  const { contracts } = useContracts();

  const [formData, setFormData] = useState<TransactionFormData>({
    type: 'receita',
    description: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    category_id: null,
    contract_id: null,
    paid: false,
    paid_at: null,
    notes: null,
  });

  useEffect(() => {
    if (transaction) {
      setFormData({
        type: transaction.type as 'receita' | 'despesa',
        description: transaction.description,
        amount: Number(transaction.amount),
        date: transaction.date,
        category_id: transaction.category_id || null,
        contract_id: transaction.contract_id || null,
        paid: transaction.paid || false,
        paid_at: transaction.paid_at || null,
        notes: transaction.notes || null,
      });
    } else {
      setFormData({
        type: 'receita',
        description: '',
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        category_id: null,
        contract_id: null,
        paid: false,
        paid_at: null,
        notes: null,
      });
    }
  }, [transaction, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (transaction) {
      updateTransaction({ ...formData, id: transaction.id });
    } else {
      createTransaction(formData);
    }
    onOpenChange(false);
  };

  const categories = formData.type === 'receita' ? revenueCategories : expenseCategories;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {transaction ? 'Editar Transação' : 'Nova Transação'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select
                value={formData.type}
                onValueChange={(value: 'receita' | 'despesa') =>
                  setFormData({ ...formData, type: value, category_id: null })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="despesa">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data *</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição *</Label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Ex: Comissão de venda"
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
              <Label>Categoria</Label>
              <Select
                value={formData.category_id || 'none'}
                onValueChange={(value) =>
                  setFormData({ ...formData, category_id: value === 'none' ? null : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem categoria</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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

          <div className="flex items-center space-x-2">
            <Checkbox
              id="paid"
              checked={formData.paid}
              onCheckedChange={(checked) =>
                setFormData({
                  ...formData,
                  paid: !!checked,
                  paid_at: checked ? new Date().toISOString() : null,
                })
              }
            />
            <Label htmlFor="paid">Já foi pago/recebido</Label>
          </div>

          {formData.paid && (
            <div className="space-y-2">
              <Label>Data de Pagamento</Label>
              <Input
                type="date"
                value={formData.paid_at?.split('T')[0] || ''}
                onChange={(e) => setFormData({ ...formData, paid_at: e.target.value })}
              />
            </div>
          )}

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
