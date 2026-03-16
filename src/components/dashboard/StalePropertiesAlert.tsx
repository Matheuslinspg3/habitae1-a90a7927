import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, ChevronRight, Home, Bell, CheckCircle } from "lucide-react";
import { getDaysSinceUpdate, getFreshnessLevel } from "@/components/properties/PropertyFreshnessBadge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface StaleProperty {
  id: string;
  title: string;
  days: number;
  level: "warning" | "stale" | "critical";
}

export function StalePropertiesAlert() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [notified, setNotified] = useState(false);

  // Lightweight query: only id, title, updated_at for active properties
  const { data: properties = [], isLoading } = useQuery({
    queryKey: ["stale_properties_check", profile?.organization_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, title, updated_at, status")
        .in("status", ["disponivel", "com_proposta", "reservado"])
        .order("updated_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.organization_id,
    staleTime: 5 * 60_000,
  });

  const staleProperties = useMemo(() => {
    if (!properties.length) return [];

    const stale: StaleProperty[] = [];
    for (const p of properties) {
      const days = getDaysSinceUpdate(p.updated_at);
      const level = getFreshnessLevel(days);
      if (level !== "fresh") {
        stale.push({ id: p.id, title: p.title, days, level: level as StaleProperty["level"] });
      }
    }

    return stale.sort((a, b) => b.days - a.days);
  }, [properties]);

  if (isLoading || staleProperties.length === 0) return null;

  const critical = staleProperties.filter(p => p.level === "critical").length;
  const stale = staleProperties.filter(p => p.level === "stale").length;
  const warning = staleProperties.filter(p => p.level === "warning").length;

  const handleNotifyTeam = async () => {
    if (!profile?.organization_id || !profile?.user_id) return;

    const criticalItems = staleProperties.filter(p => p.level === "critical");
    const message = criticalItems.length > 0
      ? `${criticalItems.length} imóvel(is) com mais de 60 dias sem atualização: ${criticalItems.slice(0, 3).map(p => p.title).join(", ")}${criticalItems.length > 3 ? "..." : ""}`
      : `${staleProperties.length} imóvel(is) precisam de atualização.`;

    await supabase.from("notifications").insert({
      user_id: profile.user_id,
      organization_id: profile.organization_id,
      type: "freshness_alert",
      title: "Imóveis precisam de atenção",
      message,
      entity_type: "property",
    });

    setNotified(true);
    toast({ title: "Notificação criada", description: "Alerta adicionado às suas notificações." });
  };

  return (
    <Card className={critical > 0 ? "border-destructive/30" : "border-warning/30"}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${critical > 0 ? "bg-destructive/15" : "bg-warning/15"}`}>
              <AlertTriangle className={`h-4 w-4 ${critical > 0 ? "text-destructive" : "text-warning"}`} />
            </div>
            <div>
              <CardTitle className="text-base">Imóveis precisam de atenção</CardTitle>
              <CardDescription>
                {staleProperties.length} imóvel(is) sem atualização recente
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {critical > 0 && (
              <Badge className="bg-destructive/15 text-destructive border-destructive/30">
                {critical} crítico{critical > 1 ? "s" : ""}
              </Badge>
            )}
            {stale > 0 && (
              <Badge className="bg-warning/15 text-warning border-warning/30">
                {stale} desatualizado{stale > 1 ? "s" : ""}
              </Badge>
            )}
            {warning > 0 && (
              <Badge className="bg-info/15 text-info border-info/30">
                {warning} atenção
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {staleProperties.slice(0, 5).map((p) => {
          const levelColors = {
            warning: "text-info",
            stale: "text-warning",
            critical: "text-destructive",
          };

          return (
            <div
              key={p.id}
              className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
              onClick={() => navigate(`/imoveis/${p.id}`)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Home className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm truncate">{p.title}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs font-medium flex items-center gap-1 ${levelColors[p.level]}`}>
                  <Clock className="h-3 w-3" />
                  {p.days}d
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </div>
          );
        })}
        <div className="flex items-center justify-between pt-1">
          {staleProperties.length > 5 ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => navigate("/imoveis")}
            >
              Ver todos os {staleProperties.length} imóveis
            </Button>
          ) : <div />}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleNotifyTeam}
            disabled={notified}
          >
            {notified ? (
              <>
                <CheckCircle className="h-3.5 w-3.5" />
                Notificado
              </>
            ) : (
              <>
                <Bell className="h-3.5 w-3.5" />
                Lembrete
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
