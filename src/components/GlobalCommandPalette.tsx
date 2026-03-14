import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Home,
  Users,
  Calendar,
  DollarSign,
  Store,
  Settings,
  Search,
  FileText,
  Megaphone,
} from "lucide-react";
import { trackSearch, trackQuickAction } from "@/hooks/useAnalytics";

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Imóveis", icon: Home, path: "/imoveis" },
  { label: "CRM / Leads", icon: Users, path: "/crm" },
  { label: "Agenda", icon: Calendar, path: "/agenda" },
  { label: "Marketplace", icon: Store, path: "/marketplace" },
  { label: "Financeiro", icon: DollarSign, path: "/financeiro" },
  { label: "Marketing", icon: Megaphone, path: "/marketing" },
  { label: "Configurações", icon: Settings, path: "/configuracoes" },
];

export function GlobalCommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { profile } = useAuth();

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
        trackQuickAction("command_palette_shortcut");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const debouncedQuery = useDebounced(query, 250);
  const orgId = profile?.organization_id;

  // Search properties
  const { data: properties = [] } = useQuery({
    queryKey: ["cmd-properties", debouncedQuery, orgId],
    queryFn: async () => {
      if (!orgId || !debouncedQuery) return [];
      const isCode = /^\d+$/.test(debouncedQuery);
      if (isCode) {
        const { data } = await supabase.rpc("search_properties_by_code", {
          p_code_prefix: debouncedQuery,
          p_organization_id: orgId,
          p_limit: 5,
        });
        return (data || []) as { id: string; property_code: string | null; title: string }[];
      }
      const { data } = await supabase
        .from("properties")
        .select("id, property_code, title")
        .eq("organization_id", orgId)
        .ilike("title", `%${debouncedQuery}%`)
        .limit(5);
      return data || [];
    },
    enabled: !!orgId && debouncedQuery.length >= 2,
    staleTime: 15000,
  });

  // Search leads
  const { data: leads = [] } = useQuery({
    queryKey: ["cmd-leads", debouncedQuery, orgId],
    queryFn: async () => {
      if (!orgId || !debouncedQuery) return [];
      const { data } = await supabase
        .from("leads")
        .select("id, name, email")
        .eq("organization_id", orgId)
        .or(`name.ilike.%${debouncedQuery}%,email.ilike.%${debouncedQuery}%`)
        .limit(5);
      return data || [];
    },
    enabled: !!orgId && debouncedQuery.length >= 2,
    staleTime: 15000,
  });

  // Search contracts
  const { data: contracts = [] } = useQuery({
    queryKey: ["cmd-contracts", debouncedQuery, orgId],
    queryFn: async () => {
      if (!orgId || !debouncedQuery) return [];
      const { data } = await supabase
        .from("contracts")
        .select("id, code, type, status")
        .eq("organization_id", orgId)
        .ilike("code", `%${debouncedQuery}%`)
        .limit(5);
      return data || [];
    },
    enabled: !!orgId && debouncedQuery.length >= 2,
    staleTime: 15000,
  });

  const go = useCallback(
    (path: string, label: string) => {
      setOpen(false);
      setQuery("");
      navigate(path);
      trackQuickAction(`cmd_navigate_${label}`);
    },
    [navigate]
  );

  const hasResults = properties.length > 0 || leads.length > 0 || contracts.length > 0;

  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      trackSearch("global", hasResults || NAV_ITEMS.some((i) => i.label.toLowerCase().includes(debouncedQuery.toLowerCase())));
    }
  }, [debouncedQuery, hasResults]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Buscar imóveis, leads, contratos ou navegar..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

        {/* Navigation */}
        <CommandGroup heading="Navegar">
          {NAV_ITEMS.map((item) => (
            <CommandItem
              key={item.path}
              onSelect={() => go(item.path, item.label)}
              className="min-h-[44px]"
            >
              <item.icon className="mr-2 h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        {/* Properties */}
        {properties.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Imóveis">
              {properties.map((p) => (
                <CommandItem
                  key={p.id}
                  onSelect={() => go(`/imoveis/${p.id}`, "property")}
                  className="min-h-[44px]"
                >
                  <Home className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">
                    {p.property_code && <span className="font-mono text-primary mr-1.5">#{p.property_code}</span>}
                    {p.title}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Leads */}
        {leads.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Leads">
              {leads.map((l) => (
                <CommandItem
                  key={l.id}
                  onSelect={() => go(`/crm?lead=${l.id}`, "lead")}
                  className="min-h-[44px]"
                >
                  <Users className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">
                    {l.name}
                    {l.email && <span className="text-xs text-muted-foreground ml-1.5">{l.email}</span>}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Contracts */}
        {contracts.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Contratos">
              {contracts.map((c) => (
                <CommandItem
                  key={c.id}
                  onSelect={() => go(`/financeiro?contract=${c.id}`, "contract")}
                  className="min-h-[44px]"
                >
                  <FileText className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate font-mono">{c.code}</span>
                  <span className="ml-1.5 text-xs text-muted-foreground capitalize">{c.type} · {c.status}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

// Expose open trigger for external buttons
export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  return { open, setOpen, toggle: () => setOpen((v) => !v) };
}

// Simple debounce hook
function useDebounced(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
