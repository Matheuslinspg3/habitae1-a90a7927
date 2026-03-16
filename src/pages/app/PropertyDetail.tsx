import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Heart, Share2, BedDouble, Bath, Car, Maximize, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useConsumerFavorites } from "@/hooks/useConsumerFavorites";
import { useState, useEffect, useCallback } from "react";
import { cn, proxyDriveImageUrl } from "@/lib/utils";
import { OptimizedImage } from "@/components/ui/optimized-image";
import useEmblaCarousel from "embla-carousel-react";

function formatPrice(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string>();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [favAnimating, setFavAnimating] = useState(false);
  const [emblaRef, emblaApi] = useEmblaCarousel();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id));
  }, []);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", () => setCurrentSlide(emblaApi.selectedScrollSnap()));
  }, [emblaApi]);

  const { favorites, toggleFavorite } = useConsumerFavorites(userId);

  const { data: property, isLoading } = useQuery({
    queryKey: ["consumer-property-detail", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_properties_public")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const handleShare = async () => {
    if (navigator.share && property) {
      await navigator.share({
        title: property.title || "Imóvel",
        url: window.location.href,
      });
    }
  };

  const handleFavorite = useCallback(() => {
    if (!id) return;
    setFavAnimating(true);
    setTimeout(() => setFavAnimating(false), 400);
    toggleFavorite(id);
  }, [id, toggleFavorite]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background page-enter">
        <div className="w-full aspect-video skeleton-elegant" />
        <div className="p-4 space-y-4">
          <div className="h-8 w-3/4 skeleton-elegant" />
          <div className="h-6 w-1/2 skeleton-elegant" />
          <div className="h-24 w-full skeleton-elegant" />
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center page-enter">
        <p className="text-muted-foreground">Imóvel não encontrado.</p>
      </div>
    );
  }

  const images = (property.images || []).map((img: string) => proxyDriveImageUrl(img, "w1600"));
  const price = property.transaction_type === "aluguel" ? property.rent_price : property.sale_price;
  const isFav = id ? favorites.has(id) : false;

  const features = [
    { icon: BedDouble, label: "Quartos", value: property.bedrooms },
    { icon: Bath, label: "Banheiros", value: property.bathrooms },
    { icon: Car, label: "Vagas", value: property.parking_spots },
    { icon: Maximize, label: "Área", value: property.area_total ? `${property.area_total}m²` : null },
  ].filter((f) => f.value);

  return (
    <div className="min-h-screen bg-background pb-24 page-enter">
      {/* Gallery */}
      <div className="relative">
        <div ref={emblaRef} className="overflow-hidden">
          <div className="flex">
            {images.length > 0 ? images.map((img, i) => (
              <div key={i} className="flex-[0_0_100%] min-w-0">
                {/* PERF: OptimizedImage with eager for first slide, lazy for rest */}
                <OptimizedImage
                  src={img}
                  alt={property.title || "Imóvel"}
                  aspectRatio="video"
                  loading={i === 0 ? "eager" : "lazy"}
                  fetchPriority={i === 0 ? "high" : undefined}
                  className="image-reveal"
                  wrapperClassName="image-reveal"
                />
              </div>
            )) : (
              <div className="flex-[0_0_100%] aspect-video bg-muted flex items-center justify-center text-muted-foreground">
                Sem fotos
              </div>
            )}
          </div>
        </div>

        {/* Top controls */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-center safe-area-top">
          <Button
            variant="ghost"
            size="icon"
            className="bg-background/80 backdrop-blur rounded-full transition-transform duration-150 ease-out-expo active:scale-90"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="bg-background/80 backdrop-blur rounded-full transition-transform duration-150 ease-out-expo active:scale-90"
              onClick={handleShare}
            >
              <Share2 className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="bg-background/80 backdrop-blur rounded-full transition-transform duration-150 ease-out-expo active:scale-90"
              onClick={handleFavorite}
            >
              <Heart className={cn(
                "h-5 w-5 transition-all duration-200",
                isFav ? "fill-destructive text-destructive" : "",
                favAnimating && "favorite-pop"
              )} />
            </Button>
          </div>
        </div>

        {/* Counter */}
        {images.length > 1 && (
          <div className="absolute bottom-3 right-3 bg-background/80 backdrop-blur text-xs px-2.5 py-1 rounded-full text-foreground scale-pop">
            {currentSlide + 1}/{images.length}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-4 py-5 space-y-5 stagger-children">
        <div>
          <Badge className="mb-2">{property.transaction_type === "aluguel" ? "Aluguel" : "Venda"}</Badge>
          {price && <p className="text-2xl font-bold text-foreground">{formatPrice(price)}{property.transaction_type === "aluguel" ? "/mês" : ""}</p>}
          <p className="text-base font-medium text-foreground mt-1">{property.title}</p>
          <p className="text-sm text-muted-foreground">
            {[property.address_neighborhood, property.address_city, property.address_state].filter(Boolean).join(", ")}
          </p>
        </div>

        {/* Features grid */}
        {features.length > 0 && (
          <div className="grid grid-cols-4 gap-3">
            {features.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-muted/50 transition-all duration-200 active:scale-95">
                <Icon className="h-5 w-5 text-primary" />
                <span className="text-sm font-semibold text-foreground">{value}</span>
                <span className="text-[10px] text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Description */}
        {property.description && (
          <div>
            <h3 className="font-semibold text-foreground mb-2">Descrição</h3>
            <p className={cn("text-sm text-muted-foreground leading-relaxed transition-all duration-300", !expanded && "line-clamp-4")}>
              {property.description}
            </p>
            {property.description.length > 200 && (
              <button onClick={() => setExpanded(!expanded)} className="text-primary text-sm font-medium mt-1 transition-colors duration-200 hover:text-primary/80">
                {expanded ? "Ver menos" : "Ler mais"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Fixed CTA */}
      <div className="fixed bottom-20 left-0 right-0 px-4 pb-4 safe-area-bottom slide-up-enter">
        <Button className="w-full h-14 rounded-xl text-base shadow-lg shadow-primary/20 transition-all duration-200 active:scale-[0.97]">
          <MessageCircle className="mr-2 h-5 w-5" /> Entrar em contato
        </Button>
      </div>
    </div>
  );
}