import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare, CheckCircle2, Clock, AlertCircle, Loader2 } from "lucide-react";

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

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["dev-support-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Ticket[];
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

  const filtered = filterStatus === "all" ? tickets : tickets.filter((t) => t.status === filterStatus);
  const openCount = tickets.filter((t) => t.status === "open").length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">Tickets de Suporte</h3>
          {openCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {openCount} aberto{openCount > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
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
            return (
              <Card
                key={ticket.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setSelectedTicket(ticket)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <StatusIcon className="h-4 w-4 shrink-0" />
                        <h4 className="font-medium text-sm truncate">{ticket.subject}</h4>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">{ticket.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-[10px]">
                          {categoryLabels[ticket.category] || ticket.category}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
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

      {/* Detail dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="sm:max-w-lg">
          {selectedTicket && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base">{selectedTicket.subject}</DialogTitle>
              </DialogHeader>
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
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
