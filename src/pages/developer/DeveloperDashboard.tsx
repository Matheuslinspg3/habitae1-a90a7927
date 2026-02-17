import { useState } from "react";
import { useUserRoles } from "@/hooks/useUserRole";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  HardDrive, Cloud, Shield, Users, Database, Download, 
  Terminal, ChevronRight
} from "lucide-react";
import { SystemHealthCard } from "@/components/developer/SystemHealthCard";
import { OrgUsageTab } from "@/components/developer/OrgUsageTab";
import { StorageUsageTab } from "@/components/developer/StorageUsageTab";
import { RolesTab } from "@/components/developer/RolesTab";
import { UsersTab } from "@/components/developer/UsersTab";
import { ImportHistoryTab } from "@/components/developer/ImportHistoryTab";
import { DatabaseTab } from "@/components/developer/DatabaseTab";
import { useIsMobile } from "@/hooks/use-mobile";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

const tabs = [
  { id: "overview", label: "Uso por Org", icon: HardDrive },
  { id: "storage", label: "Storage", icon: Cloud },
  { id: "database", label: "Banco", icon: Database },
  { id: "imports", label: "Importações", icon: Download },
  { id: "roles", label: "Roles", icon: Shield },
  { id: "users", label: "Usuários", icon: Users },
] as const;

export default function DeveloperDashboard() {
  const { isDeveloper } = useUserRoles();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState("overview");

  if (!isDeveloper) return null;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Terminal className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight">Painel Developer</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Infraestrutura e gestão do sistema Habitae</p>
        </div>
      </div>

      {/* System Health Overview */}
      <SystemHealthCard />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        {isMobile ? (
          <ScrollArea className="w-full">
            <TabsList className="inline-flex w-max h-10 p-1 gap-0.5">
              {tabs.map(({ id, label, icon: Icon }) => (
                <TabsTrigger key={id} value={id} className="gap-1.5 px-3 text-xs whitespace-nowrap">
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        ) : (
          <TabsList className="h-10 p-1 gap-0.5">
            {tabs.map(({ id, label, icon: Icon }) => (
              <TabsTrigger key={id} value={id} className="gap-1.5 text-sm">
                <Icon className="h-4 w-4" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        )}

        <TabsContent value="overview"><OrgUsageTab /></TabsContent>
        <TabsContent value="storage"><StorageUsageTab /></TabsContent>
        <TabsContent value="database"><DatabaseTab /></TabsContent>
        <TabsContent value="imports"><ImportHistoryTab /></TabsContent>
        <TabsContent value="roles"><RolesTab /></TabsContent>
        <TabsContent value="users"><UsersTab /></TabsContent>
      </Tabs>
    </div>
  );
}
