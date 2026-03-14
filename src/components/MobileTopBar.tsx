import { HabitaeLogo } from "@/components/HabitaeLogo";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MobileTopBar() {
  const { profile } = useAuth();
  const firstName = profile?.full_name?.split(" ")[0] || "";

  return (
    <header className="sticky top-0 z-40 md:hidden bg-background/95 backdrop-blur-lg border-b border-border/50 safe-area-top">
      <div className="flex items-center justify-between h-14 px-4">
        <div className="flex items-center gap-2.5">
          <a href="/dashboard" className="block cursor-pointer">
            <HabitaeLogo variant="icon" size="sm" />
          </a>
          {firstName && (
            <span className="text-sm font-semibold text-foreground truncate max-w-[140px]">
              Olá, {firstName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => {
              window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
            }}
            aria-label="Buscar"
          >
            <Search className="h-4 w-4" />
          </Button>
          <NotificationBell />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
