import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BillingOverview } from "./BillingOverview";
import { BillingPricingTable } from "./BillingPricingTable";
import { BillingUsageLogs } from "./BillingUsageLogs";
import { BillingConfigPanel } from "./BillingConfigPanel";
import { BillingSandboxBanner } from "./BillingSandboxBanner";
import { useAiBillingConfig } from "@/hooks/useAiBilling";

export function BillingDashboardTab() {
  const [subTab, setSubTab] = useState("overview");
  const { data: config } = useAiBillingConfig();

  return (
    <div className="space-y-4">
      <BillingSandboxBanner config={config} />

      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="h-9">
          <TabsTrigger value="overview" className="text-xs">Visão Geral</TabsTrigger>
          <TabsTrigger value="pricing" className="text-xs">Precificação</TabsTrigger>
          <TabsTrigger value="logs" className="text-xs">Logs de Uso</TabsTrigger>
          <TabsTrigger value="config" className="text-xs">Configuração</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><BillingOverview /></TabsContent>
        <TabsContent value="pricing"><BillingPricingTable /></TabsContent>
        <TabsContent value="logs"><BillingUsageLogs /></TabsContent>
        <TabsContent value="config"><BillingConfigPanel /></TabsContent>
      </Tabs>
    </div>
  );
}
