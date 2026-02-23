import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";
import { useDemo } from "@/contexts/DemoContext";
import { DemoBanner } from "@/components/DemoBanner";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { MobileTopBar } from "@/components/MobileTopBar";
import { MobileFAB } from "@/components/MobileFAB";
import { usePerformanceMode } from "@/hooks/usePerformanceMode";
import { RenewalBanner } from "@/components/RenewalBanner";

export function AppLayout() {
  const { isDemoMode } = useDemo();
  usePerformanceMode();

  // Push notification permission is now requested only via explicit user gesture
  // (Settings page or notification bell) — not auto-prompted here

  return (
    <SidebarProvider>
      {isDemoMode && <DemoBanner />}
      <div className={`min-h-dvh flex w-full overflow-hidden ${isDemoMode ? "pt-10" : ""}`}>
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <MobileTopBar />
          <RenewalBanner />
          <main className="flex-1 overflow-y-auto pb-24 md:pb-0" style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}>
            <Outlet />
          </main>
        </div>
        <MobileFAB />
        <MobileBottomNav />
        <span className="fixed bottom-1 left-1 z-[9999] text-[10px] text-muted-foreground/40 pointer-events-none select-none hidden md:block">Porta v3.1.2</span>
      </div>
    </SidebarProvider>
  );
}
