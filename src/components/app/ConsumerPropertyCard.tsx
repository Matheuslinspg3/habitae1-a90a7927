import { Heart, BedDouble, Car, Maximize } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useState, useCallback } from "react";

interface ConsumerPropertyCardProps {
  id: string;
  title: string;
  neighborhood?: string | null;
  city?: string | null;
  salePrice?: number | null;
  rentPrice?: number | null;
  transactionType: string;
  bedrooms?: number | null;
  parkingSpots?: number | null;
  areaTotal?: number | null;
  imageUrl?: string | null;
  isFavorite?: boolean;
  onFavoriteToggle?: (id: string) => void;
  onClick?: (id: string) => void;
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

export function ConsumerPropertyCard({
  id, title, neighborhood, city, salePrice, rentPrice,
  transactionType, bedrooms, parkingSpots, areaTotal,
  imageUrl, isFavorite, onFavoriteToggle, onClick,
}: ConsumerPropertyCardProps) {
  const price = transactionType === "aluguel" ? rentPrice : salePrice;
  const label = transactionType === "aluguel" ? "Aluguel" : "Venda";
  const [imgLoaded, setImgLoaded] = useState(false);
  const [favAnimating, setFavAnimating] = useState(false);

  const handleFavorite = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setFavAnimating(true);
    setTimeout(() => setFavAnimating(false), 400);
    onFavoriteToggle?.(id);
  }, [id, onFavoriteToggle]);

  return (
    <div
      className="rounded-2xl overflow-hidden border border-border/50 bg-card shadow-sm press-scale touch-manipulation cursor-pointer"
      onClick={() => onClick?.(id)}
    >
      {/* Image */}
      <div className="relative aspect-[16/10] bg-muted overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            loading="lazy"
            decoding="async"
            onLoad={() => setImgLoaded(true)}
            className={cn(
              "w-full h-full object-cover transition-opacity duration-300",
              imgLoaded ? "opacity-100" : "opacity-0"
            )}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground/40 text-sm">Sem foto</div>
        )}
        <Badge className="absolute top-3 left-3 text-xs rounded-lg font-medium scale-pop">{label}</Badge>
        <button
          onClick={handleFavorite}
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-background/80 flex items-center justify-center touch-manipulation transition-transform duration-150 ease-out-expo active:scale-90"
          aria-label={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        >
          <Heart className={cn(
            "h-4.5 w-4.5 transition-all duration-200",
            isFavorite ? "fill-destructive text-destructive" : "text-foreground/50",
            favAnimating && "favorite-pop"
          )} />
        </button>
      </div>

      {/* Info */}
      <div className="p-4 space-y-1.5">
        {price && <p className="text-lg font-bold text-foreground">{formatPrice(price)}{transactionType === "aluguel" ? "/mês" : ""}</p>}
        <p className="text-sm text-foreground font-medium truncate">{title}</p>
        {(neighborhood || city) && (
          <p className="text-xs text-muted-foreground truncate">
            {[neighborhood, city].filter(Boolean).join(", ")}
          </p>
        )}
        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1.5">
          {!!bedrooms && (
            <span className="flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" />{bedrooms}</span>
          )}
          {!!parkingSpots && (
            <span className="flex items-center gap-1"><Car className="h-3.5 w-3.5" />{parkingSpots}</span>
          )}
          {!!areaTotal && (
            <span className="flex items-center gap-1"><Maximize className="h-3.5 w-3.5" />{areaTotal}m²</span>
          )}
        </div>
      </div>
    </div>
  );
}