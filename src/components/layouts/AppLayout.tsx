import { useEffect, useRef } from "react";
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
import { usePushNotifications } from "@/hooks/usePushNotifications";

export function AppLayout() {
  const { isDemoMode } = useDemo();
  usePerformanceMode();

  // Auto-prompt push notification permission once per session
  const { isSupported, permission, subscribe } = usePushNotifications();
  const prompted = useRef(false);

  useEffect(() => {
    if (isSupported && permission === "default" && !prompted.current) {
      prompted.current = true;
      // Small delay so the page renders first
      const timer = setTimeout(() => subscribe(), 2000);
      return () => clearTimeout(timer);
    }
  }, [isSupported, permission, subscribe]);

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
        <span className="fixed bottom-1 left-1 z-[9999] text-[10px] text-muted-foreground/40 pointer-events-none select-none hidden md:block">Porta v3.0</span>
      </div>
    </SidebarProvider>
  );
}
