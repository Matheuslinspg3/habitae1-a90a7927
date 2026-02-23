import { HabitaeLogo } from "@/components/HabitaeLogo";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";

export function MobileTopBar() {
  return (
    <header className="sticky top-0 z-40 md:hidden bg-background/95 backdrop-blur-lg border-b border-border/50 safe-area-top">
      <div className="flex items-center justify-between h-16 px-4">
        <div className="flex items-center gap-2">
          <a href="/dashboard" className="block cursor-pointer">
            <HabitaeLogo variant="icon" size="sm" />
          </a>
          <span className="text-[10px] text-muted-foreground font-medium">v3.1.6</span>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
