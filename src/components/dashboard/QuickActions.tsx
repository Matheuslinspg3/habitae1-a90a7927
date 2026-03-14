import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Home, UserPlus, FileText, CalendarPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ScheduleVisitDialog } from "@/components/visits/ScheduleVisitDialog";

interface QuickAction {
  icon: React.ElementType;
  label: string;
  description: string;
  path?: string;
  action?: string;
  dotClass: string;
  isDialog?: boolean;
}

const quickActions: QuickAction[] = [
  {
    icon: Home,
    label: "Novo Imóvel",
    description: "Cadastre um imóvel",
    path: "/imoveis",
    action: "new-property",
    dotClass: "color-dot",
  },
  {
    icon: UserPlus,
    label: "Novo Lead",
    description: "Adicione um lead",
    path: "/crm",
    action: "new-lead",
    dotClass: "color-dot-accent",
  },
  {
    icon: FileText,
    label: "Novo Contrato",
    description: "Crie um contrato",
    path: "/contratos",
    action: "new-contract",
    dotClass: "color-dot-warm",
  },
  {
    icon: CalendarPlus,
    label: "Agendar Visita",
    description: "Marque uma visita",
    dotClass: "color-dot",
    isDialog: true,
  },
];

export function QuickActions() {
  const navigate = useNavigate();
  const [visitDialogOpen, setVisitDialogOpen] = useState(false);

  const handleAction = (action: QuickAction) => {
    if (action.isDialog) {
      setVisitDialogOpen(true);
    } else if (action.path) {
      navigate(action.path, { state: { action: action.action } });
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2.5 sm:gap-3">
        {quickActions.map((action) => (
          <Button
            key={action.label}
            variant="outline"
            size="default"
            className="gap-2 rounded-full border-border/50 hover:border-primary/40 hover:bg-primary/5 press-scale transition-all min-h-[44px] px-4"
            onClick={() => handleAction(action)}
          >
            <span className={action.dotClass} />
            <span className="text-sm font-medium">{action.label}</span>
          </Button>
        ))}
      </div>

      <ScheduleVisitDialog
        open={visitDialogOpen}
        onOpenChange={setVisitDialogOpen}
      />
    </>
  );
}
