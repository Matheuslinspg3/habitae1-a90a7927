import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTabParam } from "@/hooks/useTabParam";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, TrendingUp, TrendingDown, Wallet, CreditCard } from "lucide-react";
import { useTransactions, type Transaction } from "@/hooks/useTransactions";
import { useInvoices, type Invoice } from "@/hooks/useInvoices";
import { useCommissions } from "@/hooks/useCommissions";
import { TransactionForm } from "@/components/financial/TransactionForm";
import { InvoiceForm } from "@/components/financial/InvoiceForm";
import { CashFlowChart } from "@/components/financial/CashFlowChart";
import { TransactionsTab } from "@/components/financial/TransactionsTab";
import { InvoicesTab } from "@/components/financial/InvoicesTab";
import { CommissionsTab } from "@/components/financial/CommissionsTab";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export default function Financial() {
  const [transactionFormOpen, setTransactionFormOpen] = useState(false);
  const [invoiceFormOpen, setInvoiceFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [finTab, setFinTab] = useTabParam("tab", "transactions");

  const { transactions, stats, chartData, deleteTransaction } = useTransactions();
  const { invoices, pendingAmount, pendingCount } = useInvoices();
  const { commissions } = useCommissions();

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setTransactionFormOpen(true);
  };

  const handleEditInvoice = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setInvoiceFormOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (deleteId) deleteTransaction(deleteId);
    setDeleteId(null);
  };

  return (
    <div className="flex flex-col min-h-screen relative page-enter">
      <div className="absolute inset-0 bg-gradient-mesh-vibrant pointer-events-none" />
      <PageHeader
        title="Financeiro"
        description="Gerencie o fluxo de caixa e cobranças"
        actions={
          <Button onClick={() => { setEditingTransaction(null); setTransactionFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Transação
          </Button>
        }
      />

      <div className="relative flex-1 p-4 sm:p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Atual</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stats.balance >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatCurrency(stats.balance)}
              </div>
              <p className="text-xs text-muted-foreground">{transactions.filter(t => t.paid).length} transações pagas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Receitas do Mês</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{formatCurrency(stats.monthlyRevenue)}</div>
              <p className="text-xs text-muted-foreground">{transactions.filter(t => t.type === 'receita').length} receitas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Despesas do Mês</CardTitle>
              <TrendingDown className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{formatCurrency(stats.monthlyExpenses)}</div>
              <p className="text-xs text-muted-foreground">{transactions.filter(t => t.type === 'despesa').length} despesas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">A Receber</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(pendingAmount)}</div>
              <p className="text-xs text-muted-foreground">{pendingCount} cobranças pendentes</p>
            </CardContent>
          </Card>
        </div>

        <CashFlowChart data={chartData} />

        <Tabs value={finTab} onValueChange={setFinTab}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="transactions" className="flex-1 sm:flex-initial min-h-[44px]">Transações</TabsTrigger>
            <TabsTrigger value="invoices" className="flex-1 sm:flex-initial min-h-[44px]">Cobranças</TabsTrigger>
            <TabsTrigger value="commissions" className="flex-1 sm:flex-initial min-h-[44px]">Comissões</TabsTrigger>
          </TabsList>

          <TabsContent value="transactions" className="mt-4">
            <TransactionsTab
              transactions={transactions}
              onEdit={handleEditTransaction}
              onDelete={setDeleteId}
              formatCurrency={formatCurrency}
            />
          </TabsContent>

          <TabsContent value="invoices" className="mt-4">
            <InvoicesTab
              invoices={invoices}
              onEdit={handleEditInvoice}
              onNew={() => { setEditingInvoice(null); setInvoiceFormOpen(true); }}
              formatCurrency={formatCurrency}
            />
          </TabsContent>

          <TabsContent value="commissions" className="mt-4">
            <CommissionsTab commissions={commissions} formatCurrency={formatCurrency} />
          </TabsContent>
        </Tabs>
      </div>

      <TransactionForm open={transactionFormOpen} onOpenChange={setTransactionFormOpen} transaction={editingTransaction} />
      <InvoiceForm open={invoiceFormOpen} onOpenChange={setInvoiceFormOpen} invoice={editingInvoice} />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
