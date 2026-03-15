import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useConsumerFavorites } from "@/hooks/useConsumerFavorites";
import { ConsumerPropertyCard } from "@/components/app/ConsumerPropertyCard";
import { PropertyCardSkeleton } from "@/components/app/PropertyCardSkeleton";
import { useQuery } from "@tanstack/react-query";
import { proxyDriveImageUrl } from "@/lib/utils";

export default function Favorites() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string>();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id));
  }, []);

  const { favorites, toggleFavorite, isLoading: favLoading } = useConsumerFavorites(userId);

  const { data: properties, isLoading } = useQuery({
    queryKey: ["consumer-favorite-properties", Array.from(favorites)],
    enabled: favorites.size > 0,
    queryFn: async () => {
      const ids = Array.from(favorites);
      const { data, error } = await supabase
        .from("marketplace_properties_public")
        .select("*")
        .in("id", ids);
      if (error) throw error;
      return data || [];
    },
  });

  const loading = favLoading || isLoading;

  return (
    <div className="min-h-screen bg-background safe-area-top">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b px-4 py-4">
        <h1 className="text-xl font-bold text-foreground">Salvos</h1>
      </header>

      <div className="px-4 py-6">
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => <PropertyCardSkeleton key={i} />)}
          </div>
        ) : !properties || properties.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Heart className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum imóvel salvo</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Toque no coração nos imóveis que gostar para salvá-los aqui.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {properties.map((p) => (
              <ConsumerPropertyCard
                key={p.id}
                id={p.id!}
                title={p.title || "Imóvel"}
                neighborhood={p.address_neighborhood}
                city={p.address_city}
                salePrice={p.sale_price}
                rentPrice={p.rent_price}
                transactionType={p.transaction_type || "venda"}
                bedrooms={p.bedrooms}
                parkingSpots={p.parking_spots}
                areaTotal={p.area_total}
                imageUrl={p.images?.[0] ? proxyDriveImageUrl(p.images[0]) : null}
                isFavorite={true}
                onFavoriteToggle={toggleFavorite}
                onClick={(id) => navigate(`/app/imovel/${id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
