import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Building2, Bed, Bath, Car, Maximize, MapPin, ChevronDown, ExternalLink, Star } from 'lucide-react';
import type { PropertyWithDetails } from '@/hooks/useProperties';
import type { CreateLeadInput } from '@/hooks/useLeads';
import { useNavigate } from 'react-router-dom';

interface LeadInterests {
  transaction_interest?: string;
  interested_property_type_ids?: string[];
  interested_property_type_id?: string;
  estimated_value?: number;
  min_bedrooms?: number;
  min_bathrooms?: number;
  min_parking?: number;
  min_area?: number;
  preferred_neighborhoods?: string[];
  preferred_cities?: string[];
}

interface ScoredProperty {
  property: PropertyWithDetails;
  score: number;
  matchReasons: string[];
}

function scoreProperty(property: PropertyWithDetails, interests: LeadInterests): ScoredProperty {
  let score = 0;
  const matchReasons: string[] = [];

  // Transaction type match (high weight)
  if (interests.transaction_interest) {
    const ti = interests.transaction_interest;
    if (ti === 'venda' && (property.transaction_type === 'venda' || property.transaction_type === 'ambos')) {
      score += 25;
      matchReasons.push('Tipo de transação compatível');
    } else if (ti === 'aluguel' && (property.transaction_type === 'aluguel' || property.transaction_type === 'ambos')) {
      score += 25;
      matchReasons.push('Tipo de transação compatível');
    } else if (ti === 'ambos') {
      score += 25;
      matchReasons.push('Tipo de transação compatível');
    }
  }

  // Property type match
  const typeIds = interests.interested_property_type_ids?.length
    ? interests.interested_property_type_ids
    : interests.interested_property_type_id
      ? [interests.interested_property_type_id]
      : [];
  if (typeIds.length > 0 && property.property_type_id && typeIds.includes(property.property_type_id)) {
    score += 20;
    matchReasons.push('Tipo de imóvel compatível');
  }

  // Budget match
  if (interests.estimated_value) {
    const price = interests.transaction_interest === 'aluguel'
      ? (property.rent_price || 0)
      : (property.sale_price || 0);
    if (price > 0 && price <= interests.estimated_value) {
      score += 15;
      matchReasons.push('Dentro do orçamento');
    } else if (price > 0 && price <= interests.estimated_value * 1.15) {
      score += 8;
      matchReasons.push('Próximo do orçamento');
    }
  }

  // Bedrooms
  if (interests.min_bedrooms && property.bedrooms != null && property.bedrooms >= interests.min_bedrooms) {
    score += 10;
    matchReasons.push(`${property.bedrooms} quartos`);
  }

  // Bathrooms
  if (interests.min_bathrooms && property.bathrooms != null && property.bathrooms >= interests.min_bathrooms) {
    score += 5;
  }

  // Parking
  if (interests.min_parking && property.parking_spots != null && property.parking_spots >= interests.min_parking) {
    score += 5;
  }

  // Area
  if (interests.min_area && property.area_total != null && property.area_total >= interests.min_area) {
    score += 10;
    matchReasons.push(`${property.area_total}m²`);
  }

  // Neighborhood match
  if (interests.preferred_neighborhoods?.length && property.address_neighborhood) {
    const neighLower = property.address_neighborhood.toLowerCase();
    if (interests.preferred_neighborhoods.some(n => n.toLowerCase() === neighLower)) {
      score += 15;
      matchReasons.push(`Bairro: ${property.address_neighborhood}`);
    }
  }

  // City match
  if (interests.preferred_cities?.length && property.address_city) {
    const cityLower = property.address_city.toLowerCase();
    if (interests.preferred_cities.some(c => c.toLowerCase() === cityLower)) {
      score += 10;
      matchReasons.push(`Cidade: ${property.address_city}`);
    }
  }

  // Only available properties
  if (property.status !== 'disponivel') {
    score = 0;
  }

  return { property, score, matchReasons: [...new Set(matchReasons)] };
}

const PAGE_SIZE = 10;

interface PropertySuggestionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadName: string;
  leadInterests: LeadInterests;
  properties: PropertyWithDetails[];
}

export function PropertySuggestionsDialog({
  open,
  onOpenChange,
  leadName,
  leadInterests,
  properties,
}: PropertySuggestionsDialogProps) {
  const navigate = useNavigate();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const scoredProperties = useMemo(() => {
    const scored = properties
      .map(p => scoreProperty(p, leadInterests))
      .filter(sp => sp.score > 0)
      .sort((a, b) => b.score - a.score);
    return scored;
  }, [properties, leadInterests]);

  const visibleProperties = scoredProperties.slice(0, visibleCount);
  const hasMore = visibleCount < scoredProperties.length;
  const maxScore = scoredProperties[0]?.score || 1;

  const formatPrice = (value: number | null) => {
    if (!value) return null;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
  };

  const getRelevanceLabel = (score: number) => {
    const pct = (score / maxScore) * 100;
    if (pct >= 80) return { label: 'Excelente', variant: 'default' as const };
    if (pct >= 60) return { label: 'Bom', variant: 'secondary' as const };
    return { label: 'Parcial', variant: 'outline' as const };
  };

  const coverImage = (p: PropertyWithDetails) => {
    const cover = p.images?.find(i => i.is_cover) || p.images?.[0];
    return cover?.url;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col mx-4 sm:mx-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500" />
            Imóveis Sugeridos
          </DialogTitle>
          <DialogDescription>
            {scoredProperties.length > 0
              ? `Encontramos ${scoredProperties.length} imóvel(is) compatíveis com o perfil de ${leadName}.`
              : `Nenhum imóvel compatível com o perfil de ${leadName} no momento.`}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {scoredProperties.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nenhum imóvel disponível corresponde aos critérios informados.</p>
            </div>
          ) : (
            <div className="space-y-3 pb-4">
              {visibleProperties.map(({ property: p, score, matchReasons }, idx) => {
                const relevance = getRelevanceLabel(score);
                const img = coverImage(p);
                const price = p.sale_price || p.rent_price;

                return (
                  <div
                    key={p.id}
                    className="flex gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => {
                      onOpenChange(false);
                      navigate(`/imoveis/${p.id}`);
                    }}
                  >
                    {/* Rank number */}
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                      {idx + 1}
                    </div>

                    {/* Image */}
                    {img && (
                      <div className="flex-shrink-0 w-20 h-16 rounded-md overflow-hidden bg-muted">
                        <img src={img} alt={p.title} className="w-full h-full object-cover" />
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-medium text-sm truncate">{p.title}</h4>
                        <Badge variant={relevance.variant} className="shrink-0 text-[10px]">
                          {relevance.label}
                        </Badge>
                      </div>

                      {(p.address_neighborhood || p.address_city) && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3" />
                          {[p.address_neighborhood, p.address_city].filter(Boolean).join(', ')}
                        </p>
                      )}

                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        {p.bedrooms != null && (
                          <span className="flex items-center gap-0.5"><Bed className="h-3 w-3" />{p.bedrooms}</span>
                        )}
                        {p.bathrooms != null && (
                          <span className="flex items-center gap-0.5"><Bath className="h-3 w-3" />{p.bathrooms}</span>
                        )}
                        {p.parking_spots != null && (
                          <span className="flex items-center gap-0.5"><Car className="h-3 w-3" />{p.parking_spots}</span>
                        )}
                        {p.area_total != null && (
                          <span className="flex items-center gap-0.5"><Maximize className="h-3 w-3" />{p.area_total}m²</span>
                        )}
                        {price && (
                          <span className="ml-auto font-medium text-foreground">{formatPrice(price)}</span>
                        )}
                      </div>

                      {matchReasons.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {matchReasons.slice(0, 3).map(r => (
                            <span key={r} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                              {r}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                  </div>
                );
              })}

              {hasMore && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    setVisibleCount(prev => prev + PAGE_SIZE);
                  }}
                >
                  <ChevronDown className="h-4 w-4 mr-2" />
                  Ver Mais ({scoredProperties.length - visibleCount} restantes)
                </Button>
              )}
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-end pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
