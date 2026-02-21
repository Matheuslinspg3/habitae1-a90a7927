import React from "react";
import { 
  Users, 
  FileText, 
  DollarSign, 
  Calendar, 
  LayoutDashboard,
  LogOut,
  Settings,
  Home,
  Store,
  Plug,
  Code,
  Building2,
  User,
  Zap,
  UserCog,
} from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { NavLink } from "@/components/NavLink";
import { ThemeToggle } from "@/components/ThemeToggle";
import { HabitaeLogo } from "@/components/HabitaeLogo";
import { PillBadge } from "@/components/ui/pill-badge";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const mainMenuItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Imóveis", url: "/imoveis", icon: Home },
  { title: "Proprietários", url: "/proprietarios", icon: UserCog },
  { title: "Marketplace", url: "/marketplace", icon: Store },
  { title: "CRM", url: "/crm", icon: Users },
  { title: "Contratos", url: "/contratos", icon: FileText },
  { title: "Financeiro", url: "/financeiro", icon: DollarSign },
  { title: "Agenda", url: "/agenda", icon: Calendar },
];

const settingsItems = [
  { title: "Integrações", url: "/integracoes", icon: Plug },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

export function AppSidebar() {
  const { state, setOpenMobile, isMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut, user, profile, organizationType } = useAuth();
  const { isDeveloperOrLeader, isDeveloper, isAdminOrAbove } = useUserRoles();
  const currentPath = location.pathname;

  const [orgName, setOrgName] = React.useState<string>("");
  React.useEffect(() => {
    if (!profile?.organization_id) return;
    const load = async () => {
      const { data } = await (await import("@/integrations/supabase/client")).supabase
        .from("organizations")
        .select("name")
        .eq("id", profile.organization_id!)
        .maybeSingle();
      if (data?.name) setOrgName(data.name);
    };
    load();
  }, [profile?.organization_id]);

  const isActive = (path: string) => currentPath.startsWith(path);

  // Auto-close sidebar on mobile when route changes
  const prevPath = React.useRef(currentPath);
  React.useEffect(() => {
    if (isMobile && currentPath !== prevPath.current) {
      setOpenMobile(false);
    }
    prevPath.current = currentPath;
  }, [currentPath, isMobile, setOpenMobile]);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/30 bg-sidebar backdrop-blur-xl">
      <SidebarHeader className="p-4">
        <div>
          {collapsed ? (
            <HabitaeLogo variant="icon" size="sm" />
          ) : (
            <HabitaeLogo variant="horizontal" size="md" />
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground/70 uppercase text-xs tracking-wider">
            Menu Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainMenuItems.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={active}
                      tooltip={item.title}
                      className={active ? "bg-sidebar-accent border-l-2 border-primary" : ""}
                    >
                      <NavLink 
                        to={item.url} 
                        className="flex items-center gap-3"
                        activeClassName="text-primary font-medium"
                      >
                        <item.icon className={`h-4 w-4 ${active ? "text-primary" : ""}`} />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isDeveloperOrLeader && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground/70 uppercase text-xs tracking-wider">
              Automações
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild 
                    isActive={isActive("/automacoes")}
                    tooltip="Automações"
                    className={isActive("/automacoes") ? "bg-sidebar-accent border-l-2 border-primary" : ""}
                  >
                    <NavLink 
                      to="/automacoes" 
                      className="flex items-center gap-3"
                      activeClassName="text-primary font-medium"
                    >
                      <Zap className={`h-4 w-4 ${isActive("/automacoes") ? "text-primary" : ""}`} />
                      <span>Automações</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {isAdminOrAbove && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground/70 uppercase text-xs tracking-wider">
              Gestão
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild 
                    isActive={isActive("/administracao")}
                    tooltip="Administração"
                    className={isActive("/administracao") ? "bg-sidebar-accent border-l-2 border-primary" : ""}
                  >
                    <NavLink 
                      to="/administracao" 
                      className="flex items-center gap-3"
                      activeClassName="text-primary font-medium"
                    >
                      <UserCog className={`h-4 w-4 ${isActive("/administracao") ? "text-primary" : ""}`} />
                      <span>Administração</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}


        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground/70 uppercase text-xs tracking-wider">
            Sistema
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {isAdminOrAbove && (
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild 
                    isActive={isActive("/integracoes")}
                    tooltip="Integrações"
                    className={isActive("/integracoes") ? "bg-sidebar-accent border-l-2 border-primary" : ""}
                  >
                    <NavLink 
                      to="/integracoes" 
                      className="flex items-center gap-3"
                      activeClassName="text-primary font-medium"
                    >
                      <Plug className={`h-4 w-4 ${isActive("/integracoes") ? "text-primary" : ""}`} />
                      <span>Integrações</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              <SidebarMenuItem>
                <SidebarMenuButton 
                  asChild 
                  isActive={isActive("/configuracoes")}
                  tooltip="Configurações"
                  className={isActive("/configuracoes") ? "bg-sidebar-accent border-l-2 border-primary" : ""}
                >
                  <NavLink 
                    to="/configuracoes" 
                    className="flex items-center gap-3"
                    activeClassName="text-primary font-medium"
                  >
                    <Settings className={`h-4 w-4 ${isActive("/configuracoes") ? "text-primary" : ""}`} />
                    <span>Configurações</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isDeveloper && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground/70 uppercase text-xs tracking-wider">
              Developer
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild 
                    isActive={isActive("/developer")}
                    tooltip="Developer"
                    className={isActive("/developer") ? "bg-sidebar-accent border-l-2 border-primary" : ""}
                  >
                    <NavLink 
                      to="/developer" 
                      className="flex items-center gap-3"
                      activeClassName="text-primary font-medium"
                    >
                      <Code className={`h-4 w-4 ${isActive("/developer") ? "text-primary" : ""}`} />
                      <span>Developer</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        {!collapsed && user && (
          <div className="mb-3 px-2">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {user.user_metadata?.full_name || user.email}
            </p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
             {organizationType && (
              <PillBadge
                size="sm"
                variant={organizationType === 'imobiliaria' ? 'warning' : 'muted'}
                icon={organizationType === 'imobiliaria' ? <Building2 className="h-3 w-3" /> : <User className="h-3 w-3" />}
                className="mt-2"
              >
                {organizationType === 'imobiliaria' ? 'Imobiliária' : 'Corretor Individual'}
              </PillBadge>
            )}
            {orgName && (
              <p className="text-xs text-muted-foreground truncate mt-1">{orgName}</p>
            )}
          </div>
        )}
        {collapsed && organizationType && (
          <div className="flex justify-center mb-2">
            {organizationType === 'imobiliaria' ? (
              <Building2 className="h-4 w-4 text-accent" />
            ) : (
              <User className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        )}
        <div className="flex items-center gap-2">
          <NotificationBell />
          <ThemeToggle />
          <Button 
            variant="ghost" 
            className="flex-1 justify-start gap-3 text-muted-foreground hover:text-destructive"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>Sair</span>}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
