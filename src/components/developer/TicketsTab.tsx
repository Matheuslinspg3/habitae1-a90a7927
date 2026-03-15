import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare, CheckCircle2, Clock, AlertCircle, Loader2, Trash2 } from "lucide-react";
import { TicketChat } from "./TicketChat";

interface Ticket {
  id: string;
  user_id: string;
  organization_id: string;
  subject: string;
  description: string;
  category: string;
  status: string;
  created_at: string;
  updated_at: string;
  user_name?: string;
  org_name?: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Clock }> = {
  open: { label: "Aberto", variant: "destructive", icon: AlertCircle },
  in_progress: { label: "Em andamento", variant: "default", icon: Clock },
  resolved: { label: "Resolvido", variant: "secondary", icon: CheckCircle2 },
};

const categoryLabels: Record<string, string> = {
  bug: "Bug / Erro",
  feature: "Sugestão",
  duvida: "Dúvida",
  outro: "Outro",
};

export function TicketsTab() {
  const queryClient = useQueryClient();
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["dev-support-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const tickets = (data || []) as unknown as Ticket[];

      if (tickets.length === 0) return tickets;
      const userIds = [...new Set(tickets.map((t) => t.user_id))];
      const orgIds = [...new Set(tickets.map((t) => t.organization_id))];

      const [profilesRes, orgsRes] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name").in("user_id", userIds),
        supabase.from("organizations").select("id, name").in("id", orgIds),
      ]);

      const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.user_id, p.full_name]));
      const orgMap = new Map((orgsRes.data || []).map((o: any) => [o.id, o.name]));

      return tickets.map((t) => ({
        ...t,
        user_name: profileMap.get(t.user_id) || "Desconhecido",
        org_name: orgMap.get(t.organization_id) || "Desconhecida",
      }));
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("support_tickets" as any)
        .update({ status } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dev-support-tickets"] });
      toast.success("Status atualizado");
    },
    onError: () => toast.error("Erro ao atualizar status"),
  });

  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      // Delete related ticket_messages first, then tickets
      const { error: msgError } = await supabase
        .from("ticket_messages" as any)
        .delete()
        .in("ticket_id", ids);
      if (msgError) throw msgError;

      const { error } = await supabase
        .from("support_tickets" as any)
        .delete()
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["dev-support-tickets"] });
      setSelectedIds(new Set());
      toast.success(`${ids.length} ticket(s) excluído(s)`);
    },
    onError: () => toast.error("Erro ao excluir tickets"),
  });

  const filtered = filterStatus === "all" ? tickets : tickets.filter((t) => t.status === filterStatus);
  const openCount = tickets.filter((t) => t.status === "open").length;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((t) => t.id)));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">Tickets de Suporte</h3>
          {openCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {openCount} aberto{openCount > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={bulkDelete.isPending}
            >
              {bulkDelete.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Excluir ({selectedIds.size})
            </Button>
          )}
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos ({tickets.length})</SelectItem>
              <SelectItem value="open">Abertos ({tickets.filter((t) => t.status === "open").length})</SelectItem>
              <SelectItem value="in_progress">Em andamento ({tickets.filter((t) => t.status === "in_progress").length})</SelectItem>
              <SelectItem value="resolved">Resolvidos ({tickets.filter((t) => t.status === "resolved").length})</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Select all */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-2 px-1">
          <Checkbox
            checked={selectedIds.size === filtered.length && filtered.length > 0}
            onCheckedChange={toggleSelectAll}
          />
          <span className="text-xs text-muted-foreground">
            {selectedIds.size > 0 ? `${selectedIds.size} selecionado(s)` : "Selecionar todos"}
          </span>
        </div>
      )}

      {/* Ticket list */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum ticket encontrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((ticket) => {
            const sc = statusConfig[ticket.status] || statusConfig.open;
            const StatusIcon = sc.icon;
            const isSelected = selectedIds.has(ticket.id);
            return (
              <Card
                key={ticket.id}
                className={`transition-colors ${isSelected ? "ring-2 ring-primary/50 bg-primary/5" : "hover:bg-muted/50"}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelect(ticket.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 shrink-0"
                    />
                    <div
                      className="min-w-0 flex-1 cursor-pointer"
                      onClick={() => setSelectedTicket(ticket)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <StatusIcon className="h-4 w-4 shrink-0" />
                        <h4 className="font-medium text-sm truncate">{ticket.subject}</h4>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">{ticket.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-[10px]">
                          {categoryLabels[ticket.category] || ticket.category}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground truncate">
                          {ticket.user_name} • {ticket.org_name}
                        </span>
                        <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                          {format(new Date(ticket.created_at), "dd MMM yyyy HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                    <Badge variant={sc.variant} className="shrink-0 text-xs">
                      {sc.label}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Bulk delete confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedIds.size} ticket(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. Todos os tickets selecionados e suas mensagens serão permanentemente removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDelete.mutate([...selectedIds])}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Detail dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          {selectedTicket && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base">{selectedTicket.subject}</DialogTitle>
              </DialogHeader>
              <Tabs defaultValue="chat" className="flex-1 flex flex-col min-h-0">
                <TabsList className="w-full">
                  <TabsTrigger value="chat" className="flex-1">Chat</TabsTrigger>
                  <TabsTrigger value="details" className="flex-1">Detalhes</TabsTrigger>
                </TabsList>
                <TabsContent value="chat" className="flex-1 min-h-0">
                  <TicketChat ticketId={selectedTicket.id} ticketSubject={selectedTicket.subject} />
                </TabsContent>
                <TabsContent value="details">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">{categoryLabels[selectedTicket.category] || selectedTicket.category}</Badge>
                      <Badge variant={statusConfig[selectedTicket.status]?.variant || "outline"}>
                        {statusConfig[selectedTicket.status]?.label || selectedTicket.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {format(new Date(selectedTicket.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <Separator />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Descrição</p>
                      <p className="text-sm whitespace-pre-wrap">{selectedTicket.description}</p>
                    </div>
                    <Separator />
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium text-muted-foreground">Alterar status:</p>
                      <Select
                        value={selectedTicket.status}
                        onValueChange={(val) => {
                          updateStatus.mutate({ id: selectedTicket.id, status: val });
                          setSelectedTicket({ ...selectedTicket, status: val });
                        }}
                      >
                        <SelectTrigger className="w-[160px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Aberto</SelectItem>
                          <SelectItem value="in_progress">Em andamento</SelectItem>
                          <SelectItem value="resolved">Resolvido</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
