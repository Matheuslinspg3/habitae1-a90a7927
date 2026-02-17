import { PageHeader } from "@/components/PageHeader";
import { KanbanBoard } from "@/components/crm/KanbanBoard";
import { InactiveLeadsList } from "@/components/crm/InactiveLeadsList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useLeads } from "@/hooks/useLeads";
import { useTabParam } from "@/hooks/useTabParam";

export default function CRM() {
  const { 
    inactiveLeads, 
    isLoadingInactive, 
    reactivateLead,
    isReactivating 
  } = useLeads();

  const [tab, setTab] = useTabParam("tab", "active");

  return (
    <div className="flex flex-col min-h-screen relative page-enter">
      <div className="absolute inset-0 bg-gradient-mesh-vibrant pointer-events-none" />
      <PageHeader 
        title="CRM" 
        description="Gerencie seus leads e clientes"
      />
      
      <div className="relative flex-1 p-4 sm:p-6">
        <Tabs value={tab} onValueChange={setTab} className="space-y-4 sm:space-y-6">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="active" className="flex-1 sm:flex-initial min-h-[44px]">
              Leads Ativos
            </TabsTrigger>
            <TabsTrigger value="inactive" className="flex-1 sm:flex-initial min-h-[44px] flex items-center gap-2">
              <span className="hidden sm:inline">Leads </span>Inativos
              {inactiveLeads.length > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                  {inactiveLeads.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-0">
            <KanbanBoard />
          </TabsContent>

          <TabsContent value="inactive" className="mt-0">
            <InactiveLeadsList 
              leads={inactiveLeads}
              isLoading={isLoadingInactive}
              onReactivate={reactivateLead}
              isReactivating={isReactivating}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
