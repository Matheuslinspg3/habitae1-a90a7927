import { HabitaeLogo } from "@/components/HabitaeLogo";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";

export function MobileTopBar() {
  return (
    <header className="sticky top-0 z-40 md:hidden bg-background/95 backdrop-blur-lg border-b border-border/50 safe-area-top">
      <div className="flex items-center justify-between h-14 px-4">
        <HabitaeLogo variant="horizontal" size="sm" />
        <div className="flex items-center gap-1">
          <NotificationBell />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
