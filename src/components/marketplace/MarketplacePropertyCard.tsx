import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MapPin, Bed, Bath, Car, Maximize, Phone, Star, Building, ImageIcon,
} from "lucide-react";
import { formatCurrency, proxyDriveImageUrl } from "@/lib/utils";
import type { MarketplaceProperty } from "@/hooks/useMarketplace";

interface MarketplacePropertyCardProps {
  property: MarketplaceProperty;
  onContactClick: (property: MarketplaceProperty) => void;
}

export function MarketplacePropertyCard({ property, onContactClick }: MarketplacePropertyCardProps) {
  const navigate = useNavigate();

  const getDisplayPrice = () => {
    if (property.sale_price) return formatCurrency(property.sale_price);
    if (property.rent_price) return `${formatCurrency(property.rent_price)}/mês`;
    return "Sob consulta";
  };

  const handleCardClick = () => {
    navigate(`/marketplace/${property.id}`);
  };

  const featureItems = [
    { icon: Bed, value: property.bedrooms, label: "quartos" },
    { icon: Bath, value: property.bathrooms, label: "banh." },
    { icon: Car, value: property.parking_spots, label: "vagas" },
    { icon: Maximize, value: property.area_total, label: "m²", suffix: "m²" },
  ].filter(f => (f.value ?? 0) > 0);

  return (
    <Card
      className="overflow-hidden group cursor-pointer border-border/40 hover:border-primary/20 hover:shadow-elevated card-hover-lift transition-all duration-300"
      onClick={handleCardClick}
    >
      {/* Image — cinematic aspect */}
      <div className="relative aspect-[16/10] bg-muted overflow-hidden">
        {property.images && property.images.length > 0 ? (
          <img
            src={proxyDriveImageUrl(property.images[0])}
            alt={property.title}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700 ease-out-expo"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Building className="h-12 w-12 text-muted-foreground/30" />
          </div>
        )}

        {/* Gradient overlay at bottom for readability */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-foreground/30 to-transparent pointer-events-none" />

        {/* Top badges */}
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between pointer-events-none">
          <div className="flex gap-1.5">
            {property.is_featured && (
              <Badge className="bg-warning text-foreground shadow-sm text-xs rounded-full px-2.5">
                <Star className="h-3 w-3 mr-1" /> Destaque
              </Badge>
            )}
            <Badge
              variant={property.transaction_type === "venda" ? "default" : "secondary"}
              className="shadow-sm text-xs rounded-full px-2.5"
            >
              {property.transaction_type === "venda" ? "Venda" : property.transaction_type === "aluguel" ? "Aluguel" : "Venda/Aluguel"}
            </Badge>
          </div>
        </div>

        {/* Photo count */}
        {property.images && property.images.length > 1 && (
          <Badge variant="secondary" className="absolute bottom-3 right-3 text-xs shadow-sm rounded-full bg-background/80 backdrop-blur-sm">
            <ImageIcon className="h-3 w-3 mr-1" />
            {property.images.length}
          </Badge>
        )}

        {/* Price overlay */}
        <div className="absolute bottom-3 left-3">
          <p className="text-xl font-extrabold text-primary-foreground drop-shadow-md leading-tight tracking-tight">
            {getDisplayPrice()}
          </p>
          {property.sale_price && property.rent_price && (
            <p className="text-xs text-primary-foreground/80 drop-shadow-sm">
              ou {formatCurrency(property.rent_price)}/mês
            </p>
          )}
        </div>
      </div>

      {/* Content */}
      <CardContent className="p-4 space-y-2.5">
        {/* Title & location */}
        <div>
          <h3 className="font-bold line-clamp-1 text-sm tracking-tight">{property.title}</h3>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {[property.address_neighborhood, property.address_city, property.address_state]
                .filter(Boolean)
                .join(", ")}
            </span>
          </p>
        </div>

        {/* Features row */}
        {featureItems.length > 0 && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {featureItems.map((feat) => (
              <span key={feat.label} className="flex items-center gap-1">
                <feat.icon className="h-3.5 w-3.5" />
                <span className="font-medium text-foreground">{feat.value}{feat.suffix || ""}</span>
              </span>
            ))}
          </div>
        )}

        {/* Commission */}
        {property.commission_percentage && (
          <Badge variant="outline" className="text-xs rounded-full">
            Comissão: {property.commission_percentage}%
          </Badge>
        )}

        {/* CTA */}
        <Button
          className="w-full rounded-xl glow-primary-hover transition-all duration-300"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onContactClick(property);
          }}
        >
          <Phone className="h-4 w-4 mr-2" /> Ver contato do corretor
        </Button>
      </CardContent>
    </Card>
  );
}
