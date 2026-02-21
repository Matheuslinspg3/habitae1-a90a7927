import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAdEntity } from "@/hooks/useAdEntities";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Image as ImageIcon } from "lucide-react";
import { useAdLeadsCount } from "@/hooks/useAdLeads";
import { AdDetailLeads } from "@/components/ads/AdDetailLeads";
import { AdDetailStats } from "@/components/ads/AdDetailStats";

export default function MetaAdDetail() {
  const { externalId } = useParams<{ externalId: string }>();
  const { data: ad, isLoading } = useAdEntity(externalId);
  const { data: newCount = 0 } = useAdLeadsCount(externalId);
  const navigate = useNavigate();
  const [tab, setTab] = useState("leads");

  if (isLoading) {
    return <div className="p-4 md:p-6"><p className="text-muted-foreground">Carregando...</p></div>;
  }

  if (!ad) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Button variant="ghost" onClick={() => navigate("/anuncios")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        <p className="text-muted-foreground">Anúncio não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/anuncios")}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
      </Button>

      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
          {ad.thumbnail_url ? (
            <img src={ad.thumbnail_url} alt={ad.name} className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div>
          <h1 className="text-xl font-bold">{ad.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            {ad.status && (
              <Badge variant={ad.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-xs">
                {ad.status === 'ACTIVE' ? 'Ativo' : ad.status === 'PAUSED' ? 'Pausado' : ad.status}
              </Badge>
            )}
            {newCount > 0 && (
              <Badge variant="destructive" className="text-xs">{newCount} leads novos</Badge>
            )}
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="leads" className="relative">
            Leads
            {newCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-xs rounded-full bg-destructive text-destructive-foreground">
                {newCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="stats">Estatísticas</TabsTrigger>
        </TabsList>
        <TabsContent value="leads">
          <AdDetailLeads externalAdId={externalId!} />
        </TabsContent>
        <TabsContent value="stats">
          <AdDetailStats externalAdId={externalId!} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
