import { PageHeader } from "@/components/PageHeader";
import { ImobziIntegrationCard } from "@/components/integrations/ImobziIntegrationCard";
import { WhatsAppIntegrationCard } from "@/components/integrations/WhatsAppIntegrationCard";
import { SyncHistorySection } from "@/components/integrations/SyncHistorySection";
import { PortalFeedsSection } from "@/components/integrations/PortalFeedsSection";
import { DatabaseTransferCard } from "@/components/integrations/DatabaseTransferCard";
import { Separator } from "@/components/ui/separator";
import { useUserRoles } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";

export default function Integrations() {
  const { isAdminOrAbove, isLoading } = useUserRoles();

  if (isLoading) return null;

  if (!isAdminOrAbove) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex flex-col min-h-screen relative page-enter">
      <div className="absolute inset-0 bg-gradient-mesh-vibrant pointer-events-none" />
      <PageHeader 
        title="Integrações" 
        description="Configure integrações com sistemas externos"
      />
      
      <div className="relative flex-1 p-4 sm:p-6 space-y-6">
        <div className="max-w-4xl">
          <WhatsAppIntegrationCard />
        </div>

        <Separator />

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

        <Separator />

        <div className="max-w-4xl">
          <DatabaseTransferCard />
        </div>
      </div>
    </div>
  );
}
