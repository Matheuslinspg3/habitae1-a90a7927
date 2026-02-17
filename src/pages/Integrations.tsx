import { PageHeader } from "@/components/PageHeader";
import { ImobziIntegrationCard } from "@/components/integrations/ImobziIntegrationCard";
import { SyncHistorySection } from "@/components/integrations/SyncHistorySection";
import { PortalFeedsSection } from "@/components/integrations/PortalFeedsSection";
import { Separator } from "@/components/ui/separator";

export default function Integrations() {
  return (
    <div className="flex flex-col min-h-screen relative page-enter">
      <div className="absolute inset-0 bg-gradient-mesh-vibrant pointer-events-none" />
      <PageHeader 
        title="Integrações" 
        description="Configure integrações com sistemas externos"
      />
      
      <div className="relative flex-1 p-4 sm:p-6 space-y-6">
        <div className="max-w-4xl">
          <ImobziIntegrationCard />
        </div>
        
        <Separator />

        <div className="max-w-4xl">
          <PortalFeedsSection />
        </div>
        
        <Separator />
        
        <div className="max-w-4xl">
          <SyncHistorySection />
        </div>
      </div>
    </div>
  );
}
