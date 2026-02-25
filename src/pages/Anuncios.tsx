import React, { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useTabParam } from "@/hooks/useTabParam";
import { useAdLeadsCount } from "@/hooks/useAdLeads";
import { useAdAccount } from "@/hooks/useAdSettings";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Megaphone, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";

// Tab content components (inline imports from existing pages)
import MetaAdsListContent from "@/components/ads/MetaAdsListContent";
import MetaLeadsInboxContent from "@/components/ads/MetaLeadsInboxContent";
import MetaStatsContent from "@/components/ads/MetaStatsContent";
import MetaSettingsContent from "@/components/ads/MetaSettingsContent";
import RDStationSettingsContent from "@/components/ads/RDStationSettingsContent";
import RDStationStatsContent from "@/components/ads/RDStationStatsContent";

export default function Anuncios() {
  const [tab, setTab] = useTabParam("tab", "ads");
  const { data: totalNew = 0 } = useAdLeadsCount();
  const { isConnected } = useAdAccount();

  return (
    <div className="flex flex-col min-h-screen page-enter">
      <PageHeader
        title="Anúncios"
        description="Gerencie seus anúncios e leads do Meta Ads"
      />

      <div className="flex-1 p-4 sm:p-6 space-y-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="ads">Anúncios</TabsTrigger>
            <TabsTrigger value="leads" className="relative">
              Leads
              {totalNew > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] rounded-full bg-destructive text-destructive-foreground">
                  {totalNew}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="estatisticas">Estatísticas</TabsTrigger>
            <TabsTrigger value="rdstation">RD Station</TabsTrigger>
            <TabsTrigger value="rd-stats">RD Estatísticas</TabsTrigger>
            <TabsTrigger value="configuracoes">Configurações</TabsTrigger>
          </TabsList>

          <TabsContent value="ads" className="mt-4">
            <MetaAdsListContent />
          </TabsContent>

          <TabsContent value="leads" className="mt-4">
            <MetaLeadsInboxContent />
          </TabsContent>

          <TabsContent value="estatisticas" className="mt-4">
            <MetaStatsContent />
          </TabsContent>

          <TabsContent value="rdstation" className="mt-4">
            <RDStationSettingsContent />
          </TabsContent>

          <TabsContent value="rd-stats" className="mt-4">
            <RDStationStatsContent />
          </TabsContent>

          <TabsContent value="configuracoes" className="mt-4">
            <MetaSettingsContent />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
