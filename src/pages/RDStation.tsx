import React from "react";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTabParam } from "@/hooks/useTabParam";
import RDStationSettingsContent from "@/components/ads/RDStationSettingsContent";
import RDStationStatsContent from "@/components/ads/RDStationStatsContent";

export default function RDStation() {
  const [tab, setTab] = useTabParam("tab", "config");

  return (
    <div className="flex flex-col min-h-screen page-enter">
      <PageHeader
        title="RD Station"
        description="Integração com RD Station Marketing — configurações e estatísticas"
      />

      <div className="flex-1 p-4 sm:p-6 space-y-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="config">Configurações</TabsTrigger>
            <TabsTrigger value="estatisticas">Estatísticas</TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="mt-4">
            <RDStationSettingsContent />
          </TabsContent>

          <TabsContent value="estatisticas" className="mt-4">
            <RDStationStatsContent />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
