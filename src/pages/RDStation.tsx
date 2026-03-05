import React from "react";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTabParam } from "@/hooks/useTabParam";
import RDStationStatsContent from "@/components/ads/RDStationStatsContent";
import RDWebhookTab from "@/components/ads/rdstation/RDWebhookTab";
import RDOAuthTab from "@/components/ads/rdstation/RDOAuthTab";
import RDSettingsTab from "@/components/ads/rdstation/RDSettingsTab";

export default function RDStation() {
  const [tab, setTab] = useTabParam("tab", "config");

  return (
    <div className="flex flex-col min-h-screen page-enter">
      <PageHeader
        title="RD Station"
        description="Integração com RD Station Marketing — webhook, sincronização e estatísticas"
      />

      <div className="flex-1 p-4 sm:p-6 space-y-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="config">Configurações</TabsTrigger>
            <TabsTrigger value="webhook">Webhook</TabsTrigger>
            <TabsTrigger value="oauth">Sincronização (OAuth)</TabsTrigger>
            <TabsTrigger value="estatisticas">Estatísticas</TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="mt-4">
            <RDSettingsTab />
          </TabsContent>

          <TabsContent value="webhook" className="mt-4">
            <RDWebhookTab />
          </TabsContent>

          <TabsContent value="oauth" className="mt-4">
            <RDOAuthTab />
          </TabsContent>

          <TabsContent value="estatisticas" className="mt-4">
            <RDStationStatsContent />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
