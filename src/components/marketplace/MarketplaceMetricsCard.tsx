import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMarketplaceMetrics } from "@/hooks/useMarketplaceMetrics";
import { BarChart3, Phone, TrendingUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function MarketplaceMetricsCard() {
  const { data: metrics = [], isLoading } = useMarketplaceMetrics();

  if (isLoading || metrics.length === 0) return null;

  const totalContacts = metrics.reduce((sum, m) => sum + m.contact_count, 0);
  const propertiesWithContacts = metrics.filter((m) => m.contact_count > 0).length;
  const topProperties = [...metrics].sort((a, b) => b.contact_count - a.contact_count).slice(0, 5);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <BarChart3 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">Marketplace</CardTitle>
            <CardDescription>
              {metrics.length} imóvel(is) publicado(s)
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-2xl font-bold text-foreground">{totalContacts}</p>
            <p className="text-xs text-muted-foreground">Contatos recebidos</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-2xl font-bold text-foreground">{propertiesWithContacts}</p>
            <p className="text-xs text-muted-foreground">Com interesse</p>
          </div>
        </div>

        {/* Top properties */}
        {topProperties.some((p) => p.contact_count > 0) && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mais procurados</p>
            {topProperties
              .filter((p) => p.contact_count > 0)
              .map((p) => (
                <div key={p.property_id} className="flex items-center justify-between py-1.5">
                  <span className="text-sm truncate flex-1 mr-2">{p.title}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Phone className="h-3 w-3" />
                      {p.contact_count}
                    </Badge>
                    {p.last_contact_at && (
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(p.last_contact_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
