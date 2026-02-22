import React, { useState } from "react";
import { useAdEntities } from "@/hooks/useAdEntities";
import { useAdAccount } from "@/hooks/useAdSettings";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, Image as ImageIcon, RefreshCw, Loader2, Megaphone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function MetaAdsListContent() {
  const [search, setSearch] = useState("");
  const { data: ads = [], isLoading } = useAdEntities(search);
  const { isConnected } = useAdAccount();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("meta-sync-entities", {
        body: { days_back: 30 },
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["ad-entities"] });
      queryClient.invalidateQueries({ queryKey: ["ad-insights"] });
      toast({ title: "Sincronizado!", description: `${data.ads} anúncios e ${data.insights} métricas atualizados.` });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  if (!isConnected) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <Megaphone className="h-16 w-16 text-muted-foreground/40" />
          <h3 className="text-lg font-semibold">Meta Ads não conectado</h3>
          <p className="text-muted-foreground text-center text-sm">
            Conecte sua conta do Meta Ads nas configurações para visualizar seus anúncios e leads.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar anúncio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
          {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Sincronizar
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : ads.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Megaphone className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">Nenhum anúncio encontrado.</p>
            <p className="text-muted-foreground text-xs">Clique em "Sincronizar" para buscar seus anúncios do Meta.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {ads.map((ad) => (
            <Card
              key={ad.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => navigate(`/anuncios/ad/${ad.external_id}`)}
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
