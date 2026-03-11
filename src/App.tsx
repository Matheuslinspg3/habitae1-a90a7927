import { lazy, Suspense } from "react";
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
import { ManagerRoute } from "@/components/admin/ManagerRoute";
import { DeveloperRoute } from "@/components/developer/DeveloperRoute";
import { AppLayout } from "@/components/layouts/AppLayout";
import { FloatingImportProgress } from "@/components/integrations/FloatingImportProgress";
import { AppMobileLayout } from "@/components/app/AppMobileLayout";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import { ClarityProvider } from "@/components/ClarityProvider";
import { MaintenanceGuard } from "@/components/MaintenanceGuard";
import { Loader2 } from "lucide-react";

// Lazy-loaded pages
const Auth = lazy(() => import("./pages/Auth"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite"));
const Demo = lazy(() => import("./pages/Demo"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Properties = lazy(() => import("./pages/Properties"));
const PropertyDetails = lazy(() => import("./pages/PropertyDetails"));
const PropertyByCode = lazy(() => import("./pages/PropertyByCode"));
const PropertyLandingPage = lazy(() => import("./pages/PropertyLandingPage"));
const Marketplace = lazy(() => import("./pages/Marketplace"));
const MarketplacePropertyDetails = lazy(() => import("./pages/MarketplacePropertyDetails"));
const CRM = lazy(() => import("./pages/CRM"));
const Contracts = lazy(() => import("./pages/Contracts"));
const Financial = lazy(() => import("./pages/Financial"));
const Schedule = lazy(() => import("./pages/Schedule"));
const Settings = lazy(() => import("./pages/Settings"));
const AdminAudit = lazy(() => import("./pages/admin/AdminAudit"));
const DeveloperDashboard = lazy(() => import("./pages/developer/DeveloperDashboard"));
const ImportPendencies = lazy(() => import("./pages/ImportPendencies"));
const Integrations = lazy(() => import("./pages/Integrations"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AccessDenied = lazy(() => import("./pages/AccessDenied"));
const PlatformSignup = lazy(() => import("./pages/PlatformSignup"));
const Install = lazy(() => import("./pages/Install"));
const Automations = lazy(() => import("./pages/Automations"));
const Activities = lazy(() => import("./pages/Activities"));
const Administration = lazy(() => import("./pages/Administration"));
const Anuncios = lazy(() => import("./pages/Anuncios"));
const RDStation = lazy(() => import("./pages/RDStation"));
const MetaAdDetail = lazy(() => import("./pages/ads/MetaAdDetail"));
const Owners = lazy(() => import("./pages/Owners"));
const PublicPropertyBySlug = lazy(() => import("./pages/PublicPropertyBySlug"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const Maintenance = lazy(() => import("./pages/Maintenance"));
const Onboarding = lazy(() => import("./pages/app/Onboarding"));
const AppAuth = lazy(() => import("./pages/app/AppAuth"));
const AppHome = lazy(() => import("./pages/app/Home"));
const AppSearch = lazy(() => import("./pages/app/Search"));
const AppFavorites = lazy(() => import("./pages/app/Favorites"));
const AppProfile = lazy(() => import("./pages/app/Profile"));
const AppPropertyDetail = lazy(() => import("./pages/app/PropertyDetail"));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

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
                  <ClarityProvider />
                  <CookieConsentBanner />
                  <Suspense fallback={<PageLoader />}>
                    <MaintenanceGuard>
                    <Routes>
                      <Route path="/manutencao" element={<Maintenance />} />
                      <Route path="/auth" element={<Auth />} />
                      <Route path="/convite/:id" element={<AcceptInvite />} />
                      <Route path="/cadastro/:id" element={<PlatformSignup />} />
                      <Route path="/demo" element={<Demo />} />
                      <Route path="/imovel/:id" element={<PropertyLandingPage />} />
                      <Route path="/instalar" element={<Install />} />
                      <Route path="/i/:orgSlug/:code" element={<PublicPropertyBySlug />} />
                      <Route path="/i/:slug" element={<PublicPropertyBySlug />} />
                      <Route path="/privacidade" element={<PrivacyPolicy />} />
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
                        <Route path="/atividades" element={<ManagerRoute><Activities /></ManagerRoute>} />
                        <Route path="/administracao" element={<Administration />} />
                        <Route path="/integracoes" element={<Integrations />} />
                        <Route path="/configuracoes" element={<Settings />} />
                        
                        {/* Ads module */}
                        <Route path="/anuncios" element={<Anuncios />} />
                        <Route path="/anuncios/ad/:externalId" element={<MetaAdDetail />} />
                        <Route path="/rdstation" element={<RDStation />} />
                        
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
                    </MaintenanceGuard>
                  </Suspense>
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
