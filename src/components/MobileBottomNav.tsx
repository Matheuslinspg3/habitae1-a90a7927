import { useLocation } from "react-router-dom";
import { LayoutDashboard, Home, Users, Calendar, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";
import { useNavigate } from "react-router-dom";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: Home, label: "Imóveis", path: "/imoveis" },
  { icon: Users, label: "CRM", path: "/crm" },
  { icon: Calendar, label: "Agenda", path: "/agenda" },
  { icon: MoreHorizontal, label: "Mais", action: "toggle-sidebar" as const },
];

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toggleSidebar } = useSidebar();

  const handleItemClick = (item: typeof navItems[0]) => {
    if ("action" in item && item.action === "toggle-sidebar") {
      toggleSidebar();
    } else if ("path" in item && item.path) {
      navigate(item.path);
    }
  };

  const isActive = (path?: string) => {
    if (!path) return false;
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/95 backdrop-blur-lg border-t border-border/50 safe-area-bottom slide-up-enter">
      <div className="flex items-center justify-around h-[72px] px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = "path" in item ? isActive(item.path) : false;
          
          return (
            <button
              key={item.label}
              onClick={() => handleItemClick(item)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1.5 min-w-[64px] min-h-[48px] px-3 py-2.5 rounded-xl",
                "transition-all duration-200 ease-out-expo",
                "active:scale-90 touch-manipulation",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
            >
              <Icon className={cn(
                "h-6 w-6 transition-all duration-200 ease-out-expo",
                active && "stroke-[2.5px] scale-110"
              )} />
              <span className={cn(
                "text-[11px] leading-none transition-all duration-200",
                active ? "font-semibold" : "font-medium"
              )}>
                {item.label}
              </span>
              {active && (
                <div className="absolute bottom-1.5 w-5 h-0.5 rounded-full bg-primary nav-indicator scale-pop" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}