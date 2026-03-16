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
import { Plus, TrendingUp, TrendingDown, Wallet, CreditCard, FileText, LayoutTemplate } from "lucide-react";
import { useTransactions, type Transaction } from "@/hooks/useTransactions";
import { useInvoices, type Invoice } from "@/hooks/useInvoices";
import { useCommissions } from "@/hooks/useCommissions";
import { useContracts, type ContractWithDetails, type ContractFormData } from "@/hooks/useContracts";
import { TransactionForm } from "@/components/financial/TransactionForm";
import { InvoiceForm } from "@/components/financial/InvoiceForm";
import { CashFlowChart } from "@/components/financial/CashFlowChart";
import { TransactionsTab } from "@/components/financial/TransactionsTab";
import { InvoicesTab } from "@/components/financial/InvoicesTab";
import { CommissionsTab } from "@/components/financial/CommissionsTab";
import { ContractForm } from "@/components/contracts/ContractForm";
import { ContractDetails } from "@/components/contracts/ContractDetails";
import { ContractFilters } from "@/components/contracts/ContractFilters";
import { MobileContractCard } from "@/components/contracts/MobileContractCard";
import { useIsMobile } from "@/hooks/use-mobile";
import { ContractTemplatesTab } from "@/components/contracts/ContractTemplatesTab";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  rascunho: { label: "Rascunho", variant: "secondary" },
  ativo: { label: "Ativo", variant: "default" },
  encerrado: { label: "Encerrado", variant: "outline" },
  cancelado: { label: "Cancelado", variant: "destructive" },
};

const typeLabels: Record<string, string> = {
  venda: "Venda",
  locacao: "Locação",
};

export default function Financial() {
  const isMobile = useIsMobile();
  const [transactionFormOpen, setTransactionFormOpen] = useState(false);
  const [invoiceFormOpen, setInvoiceFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [finTab, setFinTab] = useTabParam("tab", "transactions");

  // Financial data
  const { transactions, stats, chartData, deleteTransaction } = useTransactions();
  const { invoices, pendingAmount, pendingCount } = useInvoices();
  const { commissions } = useCommissions();

  // Contracts data
  const { 
    contracts, isLoading: loadingContracts, stats: contractStats, 
    createContract, updateContract, deleteContract: deleteContractFn,
    isCreating, isUpdating 
  } = useContracts();
  const [contractSearch, setContractSearch] = useState("");
  const [contractStatusFilter, setContractStatusFilter] = useState("all");
  const [contractTypeFilter, setContractTypeFilter] = useState("all");
  const [contractFormOpen, setContractFormOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<ContractWithDetails | null>(null);
  const [contractDetailsOpen, setContractDetailsOpen] = useState(false);
  const [deleteContractDialogOpen, setDeleteContractDialogOpen] = useState(false);
  const [contractToDelete, setContractToDelete] = useState<string | null>(null);

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

  // Contract helpers
  const filteredContracts = contracts.filter((contract) => {
    const matchesSearch = 
      contract.code.toLowerCase().includes(contractSearch.toLowerCase()) ||
      contract.property?.title?.toLowerCase().includes(contractSearch.toLowerCase()) ||
      contract.lead?.name?.toLowerCase().includes(contractSearch.toLowerCase());
    const matchesType = contractTypeFilter === "all" || contract.type === contractTypeFilter;
    const matchesStatus = contractStatusFilter === "all" || contract.status === contractStatusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const handleCreateContract = () => { setSelectedContract(null); setContractFormOpen(true); };
  const handleEditContract = (contract: ContractWithDetails) => { setSelectedContract(contract); setContractFormOpen(true); };
  const handleViewContract = (contract: ContractWithDetails) => { setSelectedContract(contract); setContractDetailsOpen(true); };
  const handleSubmitContract = (data: ContractFormData) => {
    if (selectedContract) {
      updateContract({ id: selectedContract.id, data });
    } else {
      createContract(data);
    }
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return "-";
    return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
  };

  const formatContractCurrency = (value: number | null | undefined) => {
    if (!value) return "R$ 0";
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
  };

  return (
    <div className="flex flex-col min-h-screen relative page-enter" data-clarity-mask="true">
      <div className="absolute inset-0 bg-gradient-mesh-vibrant pointer-events-none" />
      <PageHeader
        title="Financeiro"
        description="Gerencie finanças, cobranças e contratos"
        actions={
          finTab === "contracts" ? (
            <Button onClick={handleCreateContract} size={isMobile ? "icon" : "default"}>
              <Plus className="h-4 w-4" />
              {!isMobile && <span className="ml-2">Novo Contrato</span>}
            </Button>
          ) : (
            <Button onClick={() => { setEditingTransaction(null); setTransactionFormOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Transação
            </Button>
          )
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
              <CardTitle className="text-sm font-medium text-muted-foreground">Contratos Ativos</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{contractStats.ativo}</div>
              <p className="text-xs text-muted-foreground">{formatContractCurrency(contractStats.valorTotal)} em valor</p>
            </CardContent>
          </Card>
        </div>

        {finTab === "transactions" && <CashFlowChart data={chartData} />}

        <Tabs value={finTab} onValueChange={setFinTab}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="transactions" className="flex-1 sm:flex-initial min-h-[44px]">Transações</TabsTrigger>
            <TabsTrigger value="invoices" className="flex-1 sm:flex-initial min-h-[44px]">
              Cobranças
              {pendingCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] rounded-full bg-destructive text-destructive-foreground">
                  {pendingCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="commissions" className="flex-1 sm:flex-initial min-h-[44px]">Comissões</TabsTrigger>
            <TabsTrigger value="contracts" className="flex-1 sm:flex-initial min-h-[44px] gap-2">
              <FileText className="h-4 w-4" />
              Contratos
            </TabsTrigger>
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

          <TabsContent value="contracts" className="mt-4 space-y-4">
            {/* Contract Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Total</p><p className="text-xl font-bold">{contractStats.total}</p></CardContent></Card>
              <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Rascunhos</p><p className="text-xl font-bold text-muted-foreground">{contractStats.rascunho}</p></CardContent></Card>
              <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Ativos</p><p className="text-xl font-bold text-success">{contractStats.ativo}</p></CardContent></Card>
              <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Encerrados</p><p className="text-xl font-bold">{contractStats.encerrado}</p></CardContent></Card>
            </div>

            {/* Contract Filters */}
            <Card>
              <CardContent className="p-3 sm:p-4">
                <ContractFilters
                  search={contractSearch} onSearchChange={setContractSearch}
                  typeFilter={contractTypeFilter} onTypeFilterChange={setContractTypeFilter}
                  statusFilter={contractStatusFilter} onStatusFilterChange={setContractStatusFilter}
                />
              </CardContent>
            </Card>

            {/* Contract List */}
            {loadingContracts ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-lg" />
                ))}
              </div>
            ) : filteredContracts.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center text-center h-32 p-6">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">
                    {contracts.length === 0 ? "Nenhum contrato cadastrado" : "Nenhum contrato encontrado"}
                  </h3>
                  <p className="text-muted-foreground mt-1">
                    {contracts.length === 0 ? 'Clique em "Novo Contrato" para começar' : "Tente ajustar os filtros"}
                  </p>
                </CardContent>
              </Card>
            ) : isMobile ? (
              <div className="space-y-3">
                {filteredContracts.map((contract) => (
                  <MobileContractCard
                    key={contract.id}
                    contract={contract}
                    statusConfig={statusConfig}
                    typeLabels={typeLabels}
                    formatCurrency={formatContractCurrency}
                    formatDate={formatDate}
                    onView={handleViewContract}
                    onEdit={handleEditContract}
                    onDelete={(id) => { setContractToDelete(id); setDeleteContractDialogOpen(true); }}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Imóvel</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Início</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredContracts.map((contract) => {
                          const status = statusConfig[contract.status] || statusConfig.rascunho;
                          return (
                            <TableRow key={contract.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleViewContract(contract)}>
                              <TableCell className="font-medium">{contract.code}</TableCell>
                              <TableCell>{contract.property?.title || <span className="text-muted-foreground">-</span>}</TableCell>
                              <TableCell>{contract.lead?.name || <span className="text-muted-foreground">-</span>}</TableCell>
                              <TableCell>{typeLabels[contract.type]}</TableCell>
                              <TableCell className="font-medium">{formatContractCurrency(Number(contract.value))}</TableCell>
                              <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                              <TableCell>{formatDate(contract.start_date)}</TableCell>
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                    <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewContract(contract); }}>Ver detalhes</DropdownMenuItem>
                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditContract(contract); }}>Editar</DropdownMenuItem>
                                    <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); setContractToDelete(contract.id); setDeleteContractDialogOpen(true); }}>Excluir</DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <TransactionForm open={transactionFormOpen} onOpenChange={setTransactionFormOpen} transaction={editingTransaction} />
      <InvoiceForm open={invoiceFormOpen} onOpenChange={setInvoiceFormOpen} invoice={editingInvoice} />
      <ContractForm open={contractFormOpen} onOpenChange={setContractFormOpen} contract={selectedContract} onSubmit={handleSubmitContract} isSubmitting={isCreating || isUpdating} />
      <ContractDetails contract={selectedContract} open={contractDetailsOpen} onOpenChange={setContractDetailsOpen} onEdit={handleEditContract} onDelete={deleteContractFn} />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir esta transação?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteContractDialogOpen} onOpenChange={setDeleteContractDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contrato</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir este contrato?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (contractToDelete) deleteContractFn(contractToDelete); setContractToDelete(null); }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
