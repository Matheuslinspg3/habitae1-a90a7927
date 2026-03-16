import React, { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  Users, 
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
  Megaphone,
  Search,
} from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { NavLink } from "@/components/NavLink";
import { ThemeToggle } from "@/components/ThemeToggle";
import { HabitaeLogo } from "@/components/HabitaeLogo";
import { PillBadge } from "@/components/ui/pill-badge";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRole";
import { useAdLeadsCount } from "@/hooks/useAdLeads";
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

// ── Sidebar Items ────────────────────────────────────────────

const mainItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Imóveis", url: "/imoveis", icon: Home },
  { title: "CRM", url: "/crm", icon: Users },
  { title: "Agenda", url: "/agenda", icon: Calendar },
  { title: "Marketplace", url: "/marketplace", icon: Store },
  { title: "Financeiro", url: "/financeiro", icon: DollarSign },
  { title: "Marketing", url: "/marketing", icon: Megaphone, badge: true },
];

// ── Component ────────────────────────────────────────────────

export function AppSidebar() {
  const { state, setOpenMobile, isMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut, user, profile, organizationType } = useAuth();
  const { isDeveloperOrLeader, isDeveloper, isAdminOrAbove } = useUserRoles();
  const currentPath = location.pathname;
  const { data: newAdLeadsCount = 0 } = useAdLeadsCount();

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

  const renderMenuItem = (item: { title: string; url: string; icon: React.ElementType; badge?: boolean }) => {
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
            {item.badge && newAdLeadsCount > 0 && (
              <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs rounded-full bg-destructive text-destructive-foreground">
                {newAdLeadsCount}
              </span>
            )}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/30 bg-sidebar backdrop-blur-xl">
      <SidebarHeader className="p-4 space-y-3">
        <a href="/dashboard" className="block cursor-pointer">
          {collapsed ? (
            <HabitaeLogo variant="icon" size="sm" />
          ) : (
            <HabitaeLogo variant="horizontal" size="md" />
          )}
        </a>
        {!collapsed && (
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground font-normal h-9"
            onClick={() => {
              window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
            }}
          >
            <Search className="h-3.5 w-3.5" />
            <span className="text-xs">Buscar...</span>
            <kbd className="ml-auto text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
          </Button>
        )}
      </SidebarHeader>

      <SidebarContent>
        {/* ── Menu Principal ── */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground/70 uppercase text-xs tracking-wider">
            Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map(renderMenuItem)}
              {isDeveloperOrLeader && renderMenuItem({ title: "Automações", url: "/automacoes", icon: Zap })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── Gestão (admin+) ── */}
        {isAdminOrAbove && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground/70 uppercase text-xs tracking-wider">
              Gestão
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {renderMenuItem({ title: "Administração", url: "/administracao", icon: UserCog })}
                {renderMenuItem({ title: "Integrações", url: "/integracoes", icon: Plug })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* ── Sistema ── */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground/70 uppercase text-xs tracking-wider">
            Sistema
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {renderMenuItem({ title: "Configurações", url: "/configuracoes", icon: Settings })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── Developer ── */}
        {isDeveloper && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground/70 uppercase text-xs tracking-wider">
              Developer
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {renderMenuItem({ title: "Developer", url: "/developer", icon: Code })}
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
