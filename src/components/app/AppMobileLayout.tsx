import { Outlet } from "react-router-dom";
import { AppBottomNav } from "./AppBottomNav";

export function AppMobileLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1 pb-20">
        <Outlet />
      </main>
      <AppBottomNav />
    </div>
  );
}
