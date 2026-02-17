import { useState } from "react";
import { Plus, Zap, BarChart3, History, LayoutTemplate } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PillBadge } from "@/components/ui/pill-badge";
import { AutomationDashboard } from "@/components/automations/AutomationDashboard";
import { AutomationList } from "@/components/automations/AutomationList";
import { AutomationWizard } from "@/components/automations/AutomationWizard";
import { AutomationStatsPanel } from "@/components/automations/AutomationStats";
import { AutomationExecutionLog, type ExecutionLogEntry } from "@/components/automations/AutomationExecutionLog";
import { AutomationTemplates } from "@/components/automations/AutomationTemplates";
import { LeadScoreConfig } from "@/components/automations/LeadScoreConfig";
import { useAutomations } from "@/hooks/useAutomations";
import { toast } from "@/hooks/use-toast";

export default function Automations() {
  const {
    automations,
    stats,
    plan,
    canCreate,
    maxAutomations,
    toggleAutomation,
    deleteAutomation,
    duplicateAutomation,
    addAutomation,
  } = useAutomations();

  const [showWizard, setShowWizard] = useState(false);
  const [selectedAutomationId, setSelectedAutomationId] = useState<string | null>(null);
  const [executionLogs] = useState<ExecutionLogEntry[]>([]);

  const selectedAutomation = selectedAutomationId
    ? automations.find((a) => a.id === selectedAutomationId)
    : null;

  const handleCreate = () => {
    if (!canCreate) {
      toast({
        title: "Limite atingido",
        description: `Seu plano permite apenas ${maxAutomations} automações ativas. Faça upgrade para Pro.`,
        variant: "destructive",
      });
      return;
    }
    setShowWizard(true);
  };

  return (
    <div className="flex flex-col min-h-screen relative page-enter">
      <div className="absolute inset-0 bg-radial-gradient pointer-events-none" />

      <PageHeader
        title="Automações"
        description="Automatize tarefas e aumente suas conversões"
        actions={
          <div className="flex items-center gap-2">
            <PillBadge size="sm" variant={plan === "free" ? "muted" : "default"}>
              {plan === "free" ? "Free" : plan === "pro" ? "Pro" : "Enterprise"}
            </PillBadge>
            <Button onClick={handleCreate} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Nova Automação
            </Button>
          </div>
        }
      />

      <div className="relative flex-1 p-4 sm:p-6 space-y-6">
        {showWizard && (
          <div className="mb-6">
            <AutomationWizard
              onSave={(rule) => {
                addAutomation(rule);
                setShowWizard(false);
                toast({ title: "Automação criada!", description: rule.name });
              }}
              onCancel={() => setShowWizard(false)}
            />
          </div>
        )}

        {selectedAutomation && !showWizard && (
          <AutomationStatsPanel
            automation={selectedAutomation}
            onClose={() => setSelectedAutomationId(null)}
          />
        )}

        {!showWizard && !selectedAutomation && (
          <Tabs defaultValue="automations" className="space-y-4">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="automations" className="gap-1.5">
                <Zap className="h-3.5 w-3.5" /> Automações
              </TabsTrigger>
              <TabsTrigger value="templates" className="gap-1.5">
                <LayoutTemplate className="h-3.5 w-3.5" /> Templates
              </TabsTrigger>
              <TabsTrigger value="logs" className="gap-1.5">
                <History className="h-3.5 w-3.5" /> Logs
              </TabsTrigger>
              <TabsTrigger value="score" className="gap-1.5">
                <BarChart3 className="h-3.5 w-3.5" /> Score
              </TabsTrigger>
            </TabsList>

            <TabsContent value="automations" className="space-y-6">
              <AutomationDashboard stats={stats} />
              <AutomationList
                automations={automations}
                plan={plan}
                onToggle={toggleAutomation}
                onDelete={(id) => {
                  deleteAutomation(id);
                  toast({ title: "Automação excluída" });
                }}
                onDuplicate={(id) => {
                  duplicateAutomation(id);
                  toast({ title: "Automação duplicada" });
                }}
                onViewStats={setSelectedAutomationId}
              />
            </TabsContent>

            <TabsContent value="templates">
              <AutomationTemplates
                onUseTemplate={(templateId) => {
                  handleCreate();
                  toast({ title: "Template selecionado", description: "Configure os detalhes da automação." });
                }}
                currentPlan={plan}
              />
            </TabsContent>

            <TabsContent value="logs">
              <AutomationExecutionLog logs={executionLogs} />
            </TabsContent>

            <TabsContent value="score">
              <LeadScoreConfig />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
