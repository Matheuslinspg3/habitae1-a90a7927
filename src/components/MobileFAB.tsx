import { useLocation } from "react-router-dom";
import { Plus, UserPlus, Home, CalendarPlus, FileText, X, CalendarCheck, FileUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";

interface FABAction {
  icon: typeof Plus;
  label: string;
  action: string;
}

const FAB_CONFIG: Record<string, FABAction[]> = {
  "/imoveis": [
    { icon: Home, label: "Novo Imóvel", action: "new-property" },
    { icon: FileUp, label: "Importar PDF", action: "import-pdf" },
  ],
  "/crm": [
    { icon: UserPlus, label: "Novo Lead", action: "new-lead" },
  ],
  "/agenda": [
    { icon: CalendarPlus, label: "Novo Compromisso", action: "new-appointment" },
    { icon: CalendarCheck, label: "Nova Tarefa", action: "new-task" },
  ],
  "/contratos": [
    { icon: FileText, label: "Novo Contrato", action: "new-contract" },
  ],
};

export function MobileFAB() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const fabRef = useRef<HTMLDivElement>(null);

  const currentPath = Object.keys(FAB_CONFIG).find(
    (path) => location.pathname === path || location.pathname.startsWith(`${path}/`)
  );

  // Close on route change
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  // A-09: Close on ESC key
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  if (!currentPath) return null;

  const actions = FAB_CONFIG[currentPath];
  const isSingleAction = actions.length === 1;

  const handleMainClick = () => {
    if (isSingleAction) {
      window.dispatchEvent(new CustomEvent("fab-action", { detail: { action: actions[0].action } }));
    } else {
      setIsOpen((prev) => !prev);
    }
  };

  const handleActionClick = (action: string) => {
    window.dispatchEvent(new CustomEvent("fab-action", { detail: { action } }));
    setIsOpen(false);
  };

  return (
    <div ref={fabRef} className="fixed right-4 bottom-20 z-50 md:hidden flex flex-col-reverse items-end gap-3">
      {/* Sub-actions */}
      {isOpen && !isSingleAction && (
        <div className="flex flex-col-reverse items-end gap-2 mb-1">
          {actions.map((act, i) => {
            const Icon = act.icon;
            return (
              <button
                key={act.action}
                onClick={() => handleActionClick(act.action)}
                className={cn(
                  "flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-full",
                  "bg-primary text-primary-foreground shadow-elevated",
                  "active:scale-95 touch-manipulation fab-expand"
                )}
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <Icon className="h-4 w-4" />
                <span className="text-sm font-medium whitespace-nowrap">{act.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Main FAB */}
      <button
        onClick={handleMainClick}
        className={cn(
          "flex items-center justify-center",
          "w-14 h-14 rounded-full",
          "bg-primary text-primary-foreground",
          "shadow-lg shadow-primary/30",
          "transition-all duration-250 ease-out-expo",
          "active:scale-90 touch-manipulation",
          isOpen && "shadow-glow"
        )}
        aria-label={isSingleAction ? actions[0].label : isOpen ? "Fechar" : "Ações"}
      >
        <Plus className={cn(
          "h-6 w-6 transition-transform duration-250 ease-out-expo",
          isOpen && "rotate-45"
        )} />
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-background/50 -z-10 backdrop-enter"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}