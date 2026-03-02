import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TicketChat } from "@/components/developer/TicketChat";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare, CheckCircle2, Clock, AlertCircle, Loader2 } from "lucide-react";

interface Ticket {
  id: string;
  subject: string;
  description: string;
  category: string;
  status: string;
  created_at: string;
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

export function UserTicketsSection() {
  const { user } = useAuth();
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["my-tickets", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Ticket[];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-24">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">Você ainda não abriu nenhum ticket.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {tickets.map((ticket) => {
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
                  <Badge variant={sc.variant} className="shrink-0 text-xs">{sc.label}</Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

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
                  <TicketChat ticketId={selectedTicket.id} ticketSubject={selectedTicket.subject} showSupportButton={false} />
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
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
