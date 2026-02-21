import React, { useState } from "react";
import { useAdEntities } from "@/hooks/useAdEntities";
import { useAdLeadsCount } from "@/hooks/useAdLeads";
import { useAdAccount } from "@/hooks/useAdSettings";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Image as ImageIcon, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

export default function MetaAdsList() {
  const [search, setSearch] = useState("");
  const { data: ads = [], isLoading } = useAdEntities(search);
  const { isConnected } = useAdAccount();
  const navigate = useNavigate();

  if (!isConnected) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <PageHeader title="Meta Ads" description="Gerencie seus anúncios do Meta" />
        <Card className="max-w-lg mx-auto">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <ImageIcon className="h-16 w-16 text-muted-foreground/40" />
            <h3 className="text-lg font-semibold">Meta Ads não conectado</h3>
            <p className="text-muted-foreground text-center text-sm">
              Conecte sua conta do Meta Ads nas configurações para visualizar seus anúncios e leads.
            </p>
            <Button onClick={() => navigate("/anuncios/meta/configuracoes")}>
              <Settings className="h-4 w-4 mr-2" />
              Ir para Configurações
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="Meta Ads" description="Lista de anúncios" />
      
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar anúncio..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : ads.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">Nenhum anúncio encontrado. Sincronize seus ads nas configurações.</p>
            <Button variant="outline" onClick={() => navigate("/anuncios/meta/configuracoes")}>
              Sincronizar Ads
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {ads.map((ad) => (
            <Card
              key={ad.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => navigate(`/anuncios/meta/ad/${ad.external_id}`)}
            >
              <CardContent className="p-4 flex gap-4">
                <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
                  {ad.thumbnail_url ? (
                    <img src={ad.thumbnail_url} alt={ad.name} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm truncate">{ad.name}</p>
                    {(ad.new_leads_count ?? 0) > 0 && (
                      <Badge variant="destructive" className="shrink-0 text-xs">
                        {ad.new_leads_count} {ad.new_leads_count === 1 ? 'novo' : 'novos'}
                      </Badge>
                    )}
                  </div>
                  {ad.status && (
                    <Badge variant={ad.status === 'ACTIVE' ? 'default' : 'secondary'} className="mt-1 text-xs">
                      {ad.status === 'ACTIVE' ? 'Ativo' : ad.status === 'PAUSED' ? 'Pausado' : ad.status}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
