import React, { useState } from "react";
import { useAdLeads, AdLeadStatus } from "@/hooks/useAdLeads";
import { useAdEntities } from "@/hooks/useAdEntities";
import { useAdLeadsCount } from "@/hooks/useAdLeads";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Inbox } from "lucide-react";
import { AdLeadRow } from "@/components/ads/AdLeadRow";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "new", label: "Novos" },
  { value: "read", label: "Lidos" },
  { value: "sent_to_crm", label: "Enviados ao CRM" },
  { value: "send_failed", label: "Falha no envio" },
  { value: "archived", label: "Arquivados" },
];

export default function MetaLeadsInbox() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [adFilter, setAdFilter] = useState("all");
  const { data: totalNew = 0 } = useAdLeadsCount();
  const { data: ads = [] } = useAdEntities();

  const { leads, isLoading } = useAdLeads({
    search: search || undefined,
    status: statusFilter !== "all" ? statusFilter as AdLeadStatus : undefined,
    externalAdId: adFilter !== "all" ? adFilter : undefined,
  });

  const adNameMap: Record<string, string> = {};
  ads.forEach(a => { adNameMap[a.external_id] = a.name; });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <PageHeader title="Leads" description="Inbox de leads dos anúncios" />
        {totalNew > 0 && (
          <Badge variant="destructive" className="text-sm">{totalNew} novos</Badge>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, email ou telefone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={adFilter} onValueChange={setAdFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Anúncio" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os anúncios</SelectItem>
            {ads.map(a => <SelectItem key={a.external_id} value={a.external_id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : leads.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Inbox className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">Nenhum lead encontrado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {leads.map(lead => (
            <AdLeadRow key={lead.id} lead={lead} adName={adNameMap[lead.external_ad_id]} showAdName />
          ))}
        </div>
      )}
    </div>
  );
}
