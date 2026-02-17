import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import { CarnivalThemeProvider } from "@/components/CarnivalThemeProvider";
import { DemoProvider } from "@/contexts/DemoContext";

import { ImportProgressProvider } from "@/contexts/ImportProgressContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/admin/AdminRoute";
import { DeveloperRoute } from "@/components/developer/DeveloperRoute";
import { AppLayout } from "@/components/layouts/AppLayout";
import { FloatingImportProgress } from "@/components/integrations/FloatingImportProgress";

import Auth from "./pages/Auth";
import AcceptInvite from "./pages/AcceptInvite";
import Demo from "./pages/Demo";
import Dashboard from "./pages/Dashboard";
import Properties from "./pages/Properties";
import PropertyDetails from "./pages/PropertyDetails";
import PropertyByCode from "./pages/PropertyByCode";
import PropertyLandingPage from "./pages/PropertyLandingPage";
import Marketplace from "./pages/Marketplace";
import MarketplacePropertyDetails from "./pages/MarketplacePropertyDetails";
import CRM from "./pages/CRM";
import Contracts from "./pages/Contracts";
import Financial from "./pages/Financial";
import Schedule from "./pages/Schedule";
import Settings from "./pages/Settings";

import AdminAudit from "./pages/admin/AdminAudit";
import DeveloperDashboard from "./pages/developer/DeveloperDashboard";
import ImportPendencies from "./pages/ImportPendencies";
import Integrations from "./pages/Integrations";
import NotFound from "./pages/NotFound";
import AccessDenied from "./pages/AccessDenied";
import PlatformSignup from "./pages/PlatformSignup";
import Install from "./pages/Install";
import Automations from "./pages/Automations";
import Administration from "./pages/Administration";
import Owners from "./pages/Owners";

import { AppMobileLayout } from "@/components/app/AppMobileLayout";
import Onboarding from "./pages/app/Onboarding";
import AppAuth from "./pages/app/AppAuth";
import AppHome from "./pages/app/Home";
import AppSearch from "./pages/app/Search";
import AppFavorites from "./pages/app/Favorites";
import AppProfile from "./pages/app/Profile";
import AppPropertyDetail from "./pages/app/PropertyDetail";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
  <ThemeProvider>
    <CarnivalThemeProvider>
      <AuthProvider>
        <ImportProgressProvider>
            <BrowserRouter>
              <DemoProvider>
                <TooltipProvider>
                  <Toaster />
                  <Sonner />
                  <FloatingImportProgress />
                  <Routes>
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/convite/:id" element={<AcceptInvite />} />
                    <Route path="/cadastro/:id" element={<PlatformSignup />} />
                    <Route path="/demo" element={<Demo />} />
                    <Route path="/imovel/:id" element={<PropertyLandingPage />} />
                    <Route path="/instalar" element={<Install />} />
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/acesso-negado" element={<AccessDenied />} />

                    {/* Consumer App routes */}
                    <Route path="/app" element={<Navigate to="/app/home" replace />} />
                    <Route path="/app/onboarding" element={<Onboarding />} />
                    <Route path="/app/auth" element={<AppAuth />} />
                    <Route element={<AppMobileLayout />}>
                      <Route path="/app/home" element={<AppHome />} />
                      <Route path="/app/busca" element={<AppSearch />} />
                      <Route path="/app/favoritos" element={<AppFavorites />} />
                      <Route path="/app/perfil" element={<AppProfile />} />
                    </Route>
                    <Route path="/app/imovel/:id" element={<AppPropertyDetail />} />
                    
                    
                    <Route
                      element={
                        <ProtectedRoute>
                          <AppLayout />
                        </ProtectedRoute>
                      }
                    >
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/imoveis" element={<Properties />} />
                      <Route path="/proprietarios" element={<Owners />} />
                      <Route path="/imoveis/pendencias" element={<ImportPendencies />} />
                      <Route path="/imoveis/codigo/:codeOrId" element={<PropertyByCode />} />
                      <Route path="/imoveis/:id" element={<PropertyDetails />} />
                      <Route path="/marketplace" element={<Marketplace />} />
                      <Route path="/marketplace/:id" element={<MarketplacePropertyDetails />} />
                      <Route path="/crm" element={<CRM />} />
                      <Route path="/contratos" element={<Contracts />} />
                      <Route path="/financeiro" element={<Financial />} />
                      <Route path="/agenda" element={<Schedule />} />
                      
                      <Route path="/automacoes" element={<Automations />} />
                      <Route path="/administracao" element={<Administration />} />
                      <Route path="/integracoes" element={<Integrations />} />
                      <Route path="/configuracoes" element={<Settings />} />
                      
                      {/* Developer route inside AppLayout */}
                      <Route path="/developer" element={
                        <DeveloperRoute>
                          <DeveloperDashboard />
                        </DeveloperRoute>
                      } />
                      
                      {/* Admin route inside AppLayout */}
                      <Route path="/admin/auditoria" element={
                        <AdminRoute>
                          <AdminAudit />
                        </AdminRoute>
                      } />
                    </Route>

                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </TooltipProvider>
              </DemoProvider>
            </BrowserRouter>
        </ImportProgressProvider>
    </AuthProvider>
    </CarnivalThemeProvider>
  </ThemeProvider>
</QueryClientProvider>
);

export default App;
