import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Home, Users, Calendar, Menu, DollarSign, Store, Megaphone, Settings, Plug, UserCog, X, Building2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useNotifications } from "@/hooks/useNotifications";
import { useUserRoles } from "@/hooks/useUserRole";

const primaryItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: Home, label: "Imóveis", path: "/imoveis" },
  { icon: Users, label: "CRM", path: "/crm" },
  { icon: Calendar, label: "Agenda", path: "/agenda" },
];

interface MoreItem {
  icon: typeof Home;
  label: string;
  path: string;
  adminOnly?: boolean;
  developerOnly?: boolean;
}

const moreItems: MoreItem[] = [
  { icon: Store, label: "Marketplace", path: "/marketplace" },
  { icon: DollarSign, label: "Financeiro", path: "/financeiro" },
  { icon: Megaphone, label: "Marketing", path: "/marketing" },
  { icon: Building2, label: "Proprietários", path: "/proprietarios" },
  { icon: Zap, label: "Automações", path: "/automacoes" },
  { icon: UserCog, label: "Administração", path: "/administracao", adminOnly: true },
  { icon: Plug, label: "Integrações", path: "/integracoes", adminOnly: true },
  { icon: Settings, label: "Configurações", path: "/configuracoes" },
];

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdminOrAbove, isDeveloper } = useUserRoles();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // Close sheet on route change
  useEffect(() => {
    setIsSheetOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when sheet is open
  useEffect(() => {
    if (isSheetOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isSheetOpen]);

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  const isMoreActive = moreItems.some(item => isActive(item.path));

  const filteredMoreItems = moreItems.filter(item => {
    if (item.adminOnly && !isAdminOrAbove) return false;
    if (item.developerOnly && !isDeveloper) return false;
    return true;
  });

  return (
    <>
      {/* Bottom Sheet Overlay */}
      {isSheetOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden backdrop-enter"
          onClick={() => setIsSheetOpen(false)}
        >
          {/* Scrim */}
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />

          {/* Sheet */}
          <div
            className="absolute bottom-0 left-0 right-0 bg-card rounded-t-2xl border-t border-border/50 shadow-2xl slide-up-enter safe-area-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-2">
              <p className="text-sm font-semibold text-foreground">Menu</p>
              <button
                onClick={() => setIsSheetOpen(false)}
                className="p-2 rounded-full hover:bg-muted active:scale-90 touch-manipulation"
                aria-label="Fechar"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {/* Grid of items */}
            <div className="grid grid-cols-4 gap-1 px-3 pb-6 pt-1">
              {filteredMoreItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => {
                      navigate(item.path);
                      setIsSheetOpen(false);
                    }}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl",
                      "active:scale-90 touch-manipulation transition-all duration-150",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-[10px] font-medium leading-tight text-center">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Nav Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-background/95 backdrop-blur-lg border-t border-border/50 safe-area-bottom slide-up-enter">
        <div className="flex items-center justify-around h-[68px] px-1">
          {primaryItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1 min-w-[60px] min-h-[48px] px-2 py-2 rounded-xl",
                  "transition-all duration-200 ease-out-expo",
                  "active:scale-90 touch-manipulation",
                  active
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
              >
                <Icon className={cn(
                  "h-[22px] w-[22px] transition-all duration-200",
                  active && "stroke-[2.5px]"
                )} />
                <span className={cn(
                  "text-[10px] leading-none transition-all",
                  active ? "font-bold" : "font-medium"
                )}>
                  {item.label}
                </span>
                {active && (
                  <div className="absolute bottom-1 w-5 h-0.5 rounded-full bg-primary scale-pop" />
                )}
              </button>
            );
          })}

          {/* More Button */}
          <button
            onClick={() => setIsSheetOpen(true)}
            className={cn(
              "relative flex flex-col items-center justify-center gap-1 min-w-[60px] min-h-[48px] px-2 py-2 rounded-xl",
              "transition-all duration-200 ease-out-expo",
              "active:scale-90 touch-manipulation",
              isMoreActive || isSheetOpen
                ? "text-primary"
                : "text-muted-foreground"
            )}
            aria-label="Menu"
          >
            <Menu className={cn(
              "h-[22px] w-[22px] transition-all duration-200",
              (isMoreActive || isSheetOpen) && "stroke-[2.5px]"
            )} />
            <span className={cn(
              "text-[10px] leading-none",
              (isMoreActive || isSheetOpen) ? "font-bold" : "font-medium"
            )}>
              Mais
            </span>
            {isMoreActive && !isSheetOpen && (
              <div className="absolute bottom-1 w-5 h-0.5 rounded-full bg-primary scale-pop" />
            )}
          </button>
        </div>
      </nav>
    </>
  );
}
