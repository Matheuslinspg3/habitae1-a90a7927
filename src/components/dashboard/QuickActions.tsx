import { Button } from "@/components/ui/button";
import { Home, UserPlus, FileText, CalendarPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface QuickAction {
  icon: React.ElementType;
  label: string;
  description: string;
  path: string;
  action?: string;
  dotClass: string;
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
    description: "Marque um compromisso",
    path: "/agenda",
    action: "new-appointment",
    dotClass: "color-dot",
  },
];

export function QuickActions() {
  const navigate = useNavigate();

  const handleAction = (action: QuickAction) => {
    navigate(action.path, { state: { action: action.action } });
  };

  return (
    <div className="flex flex-wrap gap-2 sm:gap-3">
      {quickActions.map((action) => (
        <Button
          key={action.label}
          variant="outline"
          size="sm"
          className="gap-2 rounded-full border-border/50 hover:border-primary/40 hover:bg-primary/5 press-scale transition-all"
          onClick={() => handleAction(action)}
        >
          <span className={action.dotClass} />
          <span className="text-sm font-medium">{action.label}</span>
        </Button>
      ))}
    </div>
  );
}
