import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ConsumerPropertyCard } from "@/components/app/ConsumerPropertyCard";
import { PropertyCardSkeleton } from "@/components/app/PropertyCardSkeleton";
import { useConsumerProperties } from "@/hooks/useConsumerProperties";
import { useConsumerFavorites } from "@/hooks/useConsumerFavorites";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { HabitaeLogo } from "@/components/HabitaeLogo";
import { proxyDriveImageUrl } from "@/lib/utils";

export default function AppHome() {
  const navigate = useNavigate();
  const { data: properties, isLoading } = useConsumerProperties();
  const [userId, setUserId] = useState<string>();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id));
  }, []);

  const { favorites, toggleFavorite } = useConsumerFavorites(userId);

  const featured = properties?.filter((p) => p.is_featured) || [];
  const recent = properties || [];

  return (
    <div className="min-h-screen bg-background safe-area-top page-enter">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 border-b border-border/50 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <HabitaeLogo variant="horizontal" size="sm" />
        </div>
        <div
          className="relative cursor-pointer search-expand"
          onClick={() => navigate("/app/busca")}
        >
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
          <Input
            readOnly
            placeholder="Buscar por cidade, bairro..."
            className="pl-10 h-11 rounded-xl bg-muted/40 border-border/40 cursor-pointer"
          />
        </div>
      </header>

      <div className="px-4 py-6 space-y-8">
        {/* Featured */}
        {featured.length > 0 && (
          <section className="page-enter" style={{ animationDelay: "100ms" }}>
            <h2 className="text-lg font-semibold text-foreground mb-4">Destaques</h2>
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide">
              {featured.map((p, i) => (
                <div
                  key={p.id}
                  className="min-w-[280px] snap-start"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <ConsumerPropertyCard
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
                    imageUrl={p.images?.[0]}
                    isFavorite={favorites.has(p.id!)}
                    onFavoriteToggle={toggleFavorite}
                    onClick={(id) => navigate(`/app/imovel/${id}`)}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recent */}
        <section className="page-enter" style={{ animationDelay: "200ms" }}>
          <h2 className="text-lg font-semibold text-foreground mb-4">Adicionados recentemente</h2>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => <PropertyCardSkeleton key={i} />)}
            </div>
          ) : recent.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground page-enter">
              <div className="w-16 h-16 rounded-full bg-muted/60 flex items-center justify-center mx-auto mb-4 animate-float">
                <Search className="h-7 w-7 text-muted-foreground/50" />
              </div>
              <p className="font-medium mb-1">Nenhum imóvel disponível</p>
              <p className="text-sm">Novos imóveis aparecerão aqui.</p>
            </div>
          ) : (
            <div className="space-y-4 stagger-children">
              {recent.map((p) => (
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
                  imageUrl={p.images?.[0]}
                  isFavorite={favorites.has(p.id!)}
                  onFavoriteToggle={toggleFavorite}
                  onClick={(id) => navigate(`/app/imovel/${id}`)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}