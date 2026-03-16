import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, Bed, Bath, Car, Maximize, MapPin, ChevronDown, ExternalLink, Star } from 'lucide-react';
import type { PropertyWithDetails } from '@/hooks/useProperties';
import { useProperties } from '@/hooks/useProperties';
import { useNavigate } from 'react-router-dom';
import type { Lead } from '@/hooks/useLeads';
import { Skeleton } from '@/components/ui/skeleton';

interface ScoredProperty {
  property: PropertyWithDetails;
  score: number;
  matchReasons: string[];
}

function scoreProperty(property: PropertyWithDetails, lead: Lead): ScoredProperty {
  let score = 0;
  const matchReasons: string[] = [];
  const leadAny = lead as any;

  // Transaction type
  const ti = leadAny.transaction_interest;
  if (ti) {
    if (ti === 'venda' && (property.transaction_type === 'venda' || property.transaction_type === 'ambos')) {
      score += 25;
      matchReasons.push('Transação compatível');
    } else if (ti === 'aluguel' && (property.transaction_type === 'aluguel' || property.transaction_type === 'ambos')) {
      score += 25;
      matchReasons.push('Transação compatível');
    } else if (ti === 'ambos') {
      score += 25;
      matchReasons.push('Transação compatível');
    }
  }

  // Property type
  const typeIds = lead.interested_property_type_ids?.length
    ? lead.interested_property_type_ids
    : lead.interested_property_type_id
      ? [lead.interested_property_type_id]
      : [];
  if (typeIds.length > 0 && property.property_type_id && typeIds.includes(property.property_type_id)) {
    score += 20;
    matchReasons.push('Tipo compatível');
  }

  // Budget
  if (lead.estimated_value) {
    const price = ti === 'aluguel' ? (property.rent_price || 0) : (property.sale_price || 0);
    if (price > 0 && price <= lead.estimated_value) {
      score += 15;
      matchReasons.push('Dentro do orçamento');
    } else if (price > 0 && price <= lead.estimated_value * 1.15) {
      score += 8;
      matchReasons.push('Próximo do orçamento');
    }
  }

  if (lead.min_bedrooms && property.bedrooms != null && property.bedrooms >= lead.min_bedrooms) {
    score += 10;
    matchReasons.push(`${property.bedrooms} quartos`);
  }
  if (lead.min_bathrooms && property.bathrooms != null && property.bathrooms >= lead.min_bathrooms) {
    score += 5;
  }
  if (lead.min_parking && property.parking_spots != null && property.parking_spots >= lead.min_parking) {
    score += 5;
  }
  if (lead.min_area && property.area_total != null && property.area_total >= lead.min_area) {
    score += 10;
    matchReasons.push(`${property.area_total}m²`);
  }

  if (leadAny.preferred_neighborhoods?.length && property.address_neighborhood) {
    const n = property.address_neighborhood.toLowerCase();
    if (leadAny.preferred_neighborhoods.some((x: string) => x.toLowerCase() === n)) {
      score += 15;
      matchReasons.push(`Bairro: ${property.address_neighborhood}`);
    }
  }
  if (leadAny.preferred_cities?.length && property.address_city) {
    const c = property.address_city.toLowerCase();
    if (leadAny.preferred_cities.some((x: string) => x.toLowerCase() === c)) {
      score += 10;
      matchReasons.push(`Cidade: ${property.address_city}`);
    }
  }

  if (property.status !== 'disponivel') score = 0;

  return { property, score, matchReasons: [...new Set(matchReasons)] };
}

const PAGE_SIZE = 5;

export function LeadSuggestedProperties({ lead }: { lead: Lead }) {
  const navigate = useNavigate();
  const { properties, isLoading } = useProperties();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const scored = useMemo(() => {
    if (!properties?.length) return [];
    return properties
      .map(p => scoreProperty(p, lead))
      .filter(sp => sp.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [properties, lead]);

  const visible = scored.slice(0, visibleCount);
  const hasMore = visibleCount < scored.length;
  const maxScore = scored[0]?.score || 1;

  const formatPrice = (v: number | null) => {
    if (!v) return null;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
  };

  const getRelevance = (score: number) => {
    const pct = (score / maxScore) * 100;
    if (pct >= 80) return { label: 'Excelente', variant: 'default' as const };
    if (pct >= 60) return { label: 'Bom', variant: 'secondary' as const };
    return { label: 'Parcial', variant: 'outline' as const };
  };

  const coverImage = (p: PropertyWithDetails) => {
    const cover = p.images?.find(i => i.is_cover) || p.images?.[0];
    return cover?.url;
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Star className="h-4 w-4 text-amber-500" />
          Imóveis Sugeridos
        </h3>
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <Star className="h-4 w-4 text-amber-500" />
        Imóveis Sugeridos
        {scored.length > 0 && (
          <Badge variant="secondary" className="h-5 px-1.5 text-xs">
            {scored.length}
          </Badge>
        )}
      </h3>

      {scored.length === 0 ? (
        <div className="py-6 text-center text-muted-foreground rounded-lg border border-dashed">
          <Building2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-xs">Nenhum imóvel compatível encontrado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map(({ property: p, score, matchReasons }, idx) => {
            const relevance = getRelevance(score);
            const img = coverImage(p);
            const price = p.sale_price || p.rent_price;

            return (
              <div
                key={p.id}
                className="flex gap-2.5 p-2.5 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => navigate(`/imoveis/${p.id}`)}
              >
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                  {idx + 1}
                </div>

                {img && (
                  <div className="flex-shrink-0 w-14 h-12 rounded-md overflow-hidden bg-muted">
                    <OptimizedImage src={img} alt={p.title} className="w-full h-full object-cover" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    <h4 className="font-medium text-xs truncate">{p.title}</h4>
                    <Badge variant={relevance.variant} className="shrink-0 text-[9px] px-1 py-0">
                      {relevance.label}
                    </Badge>
                  </div>

                  {(p.address_neighborhood || p.address_city) && (
                    <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                      <MapPin className="h-2.5 w-2.5" />
                      {[p.address_neighborhood, p.address_city].filter(Boolean).join(', ')}
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                    {p.bedrooms != null && <span className="flex items-center gap-0.5"><Bed className="h-2.5 w-2.5" />{p.bedrooms}</span>}
                    {p.bathrooms != null && <span className="flex items-center gap-0.5"><Bath className="h-2.5 w-2.5" />{p.bathrooms}</span>}
                    {p.area_total != null && <span className="flex items-center gap-0.5"><Maximize className="h-2.5 w-2.5" />{p.area_total}m²</span>}
                    {price && <span className="ml-auto font-medium text-foreground text-xs">{formatPrice(price)}</span>}
                  </div>

                  {matchReasons.length > 0 && (
                    <div className="flex flex-wrap gap-0.5 mt-1">
                      {matchReasons.slice(0, 3).map(r => (
                        <span key={r} className="text-[9px] px-1 py-0 rounded bg-primary/10 text-primary">
                          {r}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {hasMore && (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={(e) => {
                e.stopPropagation();
                setVisibleCount(prev => prev + PAGE_SIZE);
              }}
            >
              <ChevronDown className="h-3 w-3 mr-1" />
              Ver Mais ({scored.length - visibleCount} restantes)
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
