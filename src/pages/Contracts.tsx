import { useState, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, FileText, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useContracts, type ContractWithDetails, type ContractFormData } from "@/hooks/useContracts";
import { ContractForm } from "@/components/contracts/ContractForm";
import { ContractDetails } from "@/components/contracts/ContractDetails";
import { ContractFilters } from "@/components/contracts/ContractFilters";
import { MobileContractCard } from "@/components/contracts/MobileContractCard";
import { useIsMobile } from "@/hooks/use-mobile";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

export default function Contracts() {
  const isMobile = useIsMobile();
  const { 
    contracts, isLoading, stats, createContract, updateContract, deleteContract,
    isCreating, isUpdating 
  } = useContracts();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<ContractWithDetails | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contractToDelete, setContractToDelete] = useState<string | null>(null);

  const filteredContracts = useMemo(() => {
    return contracts.filter((contract) => {
      const matchesSearch = 
        contract.code.toLowerCase().includes(search.toLowerCase()) ||
        contract.property?.title?.toLowerCase().includes(search.toLowerCase()) ||
        contract.lead?.name?.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === "all" || contract.type === typeFilter;
      const matchesStatus = statusFilter === "all" || contract.status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [contracts, search, typeFilter, statusFilter]);

  const handleCreate = () => { setSelectedContract(null); setIsFormOpen(true); };
  const handleEdit = (contract: ContractWithDetails) => { setSelectedContract(contract); setIsFormOpen(true); };
  const handleView = (contract: ContractWithDetails) => { setSelectedContract(contract); setIsDetailsOpen(true); };

  const handleSubmit = (data: ContractFormData) => {
    if (selectedContract) {
      updateContract({ id: selectedContract.id, data });
    } else {
      createContract(data);
    }
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return "R$ 0";
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return "-";
    return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
  };

  return (
    <div className="flex flex-col min-h-screen relative page-enter" data-clarity-mask="true">
      <div className="absolute inset-0 bg-gradient-mesh-vibrant pointer-events-none" />
      <PageHeader 
        title="Contratos" 
        description="Gerencie contratos de venda e locação"
        actions={
          <Button onClick={handleCreate} size={isMobile ? "icon" : "default"}>
            <Plus className="h-4 w-4" />
            {!isMobile && <span className="ml-2">Novo Contrato</span>}
          </Button>
        }
      />
      
      <div className="relative flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
          <Card><CardContent className="p-3 sm:p-4"><p className="text-xs sm:text-sm text-muted-foreground">Total</p><p className="text-xl sm:text-2xl font-bold">{stats.total}</p></CardContent></Card>
          <Card><CardContent className="p-3 sm:p-4"><p className="text-xs sm:text-sm text-muted-foreground">Rascunhos</p><p className="text-xl sm:text-2xl font-bold text-muted-foreground">{stats.rascunho}</p></CardContent></Card>
          <Card><CardContent className="p-3 sm:p-4"><p className="text-xs sm:text-sm text-muted-foreground">Ativos</p><p className="text-xl sm:text-2xl font-bold text-success">{stats.ativo}</p></CardContent></Card>
          <Card><CardContent className="p-3 sm:p-4"><p className="text-xs sm:text-sm text-muted-foreground">Encerrados</p><p className="text-xl sm:text-2xl font-bold">{stats.encerrado}</p></CardContent></Card>
          <Card className="col-span-2 sm:col-span-1"><CardContent className="p-3 sm:p-4"><p className="text-xs sm:text-sm text-muted-foreground">Valor Ativo</p><p className="text-xl sm:text-2xl font-bold text-primary">{formatCurrency(stats.valorTotal)}</p></CardContent></Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-3 sm:p-4">
            <ContractFilters
              search={search} onSearchChange={setSearch}
              typeFilter={typeFilter} onTypeFilterChange={setTypeFilter}
              statusFilter={statusFilter} onStatusFilterChange={setStatusFilter}
            />
          </CardContent>
        </Card>

        {/* Contracts - Mobile Cards / Desktop Table */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : filteredContracts.length === 0 ? (
          <Card>
            <CardContent className="p-0">
              <div className="flex flex-col items-center justify-center text-center h-32 p-6">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">
                  {contracts.length === 0 ? "Nenhum contrato cadastrado" : "Nenhum contrato encontrado"}
                </h3>
                <p className="text-muted-foreground mt-1">
                  {contracts.length === 0 ? 'Clique em "Novo Contrato" para começar' : "Tente ajustar os filtros de busca"}
                </p>
              </div>
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
                formatCurrency={formatCurrency}
                formatDate={formatDate}
                onView={handleView}
                onEdit={handleEdit}
                onDelete={(id) => { setContractToDelete(id); setDeleteDialogOpen(true); }}
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
                      <TableHead>Corretor</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContracts.map((contract) => {
                      const status = statusConfig[contract.status] || statusConfig.rascunho;
                      return (
                        <TableRow key={contract.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleView(contract)}>
                          <TableCell className="font-medium">{contract.code}</TableCell>
                          <TableCell>{contract.property?.title || <span className="text-muted-foreground">-</span>}</TableCell>
                          <TableCell>{contract.lead?.name || <span className="text-muted-foreground">-</span>}</TableCell>
                          <TableCell>{typeLabels[contract.type]}</TableCell>
                          <TableCell className="font-medium">{formatCurrency(Number(contract.value))}</TableCell>
                          <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                          <TableCell>{formatDate(contract.start_date)}</TableCell>
                          <TableCell>{contract.broker?.full_name || <span className="text-muted-foreground">-</span>}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleView(contract); }}>Ver detalhes</DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(contract); }}>Editar</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); setContractToDelete(contract.id); setDeleteDialogOpen(true); }}>Excluir</DropdownMenuItem>
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
      </div>

      <ContractForm open={isFormOpen} onOpenChange={setIsFormOpen} contract={selectedContract} onSubmit={handleSubmit} isSubmitting={isCreating || isUpdating} />
      <ContractDetails contract={selectedContract} open={isDetailsOpen} onOpenChange={setIsDetailsOpen} onEdit={handleEdit} onDelete={deleteContract} />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contrato</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir este contrato? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (contractToDelete) deleteContract(contractToDelete); setContractToDelete(null); }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
