import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ImageViewer } from "@/components/properties/ImageViewer";
import { ContactDialog } from "@/components/marketplace/ContactDialog";
import { proxyDriveImageUrl, formatCurrency } from "@/lib/utils";
import type { MarketplaceProperty } from "@/hooks/useMarketplace";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useCallback, useEffect } from "react";
import useEmblaCarousel from "embla-carousel-react";
import {
  ArrowLeft, MapPin, Bed, Bath, Car, Maximize, Building2,
  Phone, Star, Ruler, Tag, Share2, ChevronRight,
  ChevronLeft, ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/* ── helpers ── */
const fmtPrice = (price: number | null, isRent = false) => {
  if (!price) return null;
  const f = formatCurrency(price);
  return isRent ? `${f}/mês` : f;
};

/* ── sub-components ── */
function DetailSkeleton() {
  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full rounded-xl" />
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-64" />
        </div>
      </div>
    </div>
  );
}

function PropertyNotFound({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-1 p-6 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Imóvel não encontrado</h2>
            <p className="text-muted-foreground mb-4">
              O imóvel que você está procurando não existe ou foi removido.
            </p>
            <Button onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Voltar ao Marketplace
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FeatureItem({ icon: Icon, value, label, accent = false }: {
  icon: React.ElementType; value: number | null; label: string; accent?: boolean;
}) {
  if (!value || value <= 0) return null;
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
      <Icon className={`h-5 w-5 ${accent ? "text-primary" : "text-muted-foreground"}`} />
      <div>
        <p className="font-semibold text-sm">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

/* ── image carousel ── */
function PropertyImageCarousel({ images }: { images: Array<{ url: string; alt: string }> }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "center" });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo = useCallback((i: number) => emblaApi?.scrollTo(i), [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi]);

  if (!images.length) {
    return (
      <div className="aspect-video bg-muted rounded-xl flex items-center justify-center">
        <p className="text-muted-foreground">Nenhuma imagem disponível</p>
      </div>
    );
  }

  return (
    <>
      <div className="relative group rounded-xl overflow-hidden">
        {/* Main carousel */}
        <div ref={emblaRef} className="overflow-hidden">
          <div className="flex">
            {images.map((image, index) => (
              <div
                key={index}
                className="flex-[0_0_100%] min-w-0 relative aspect-[16/9] cursor-pointer"
                onClick={() => { setSelectedIndex(index); setViewerOpen(true); }}
              >
                <img
                  src={image.url}
                  alt={image.alt || `Imagem ${index + 1}`}
                  className="w-full h-full object-cover"
                  loading={index === 0 ? "eager" : "lazy"}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Nav arrows */}
        {images.length > 1 && (
          <>
            <Button
              variant="secondary"
              size="icon"
              className="absolute left-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg h-10 w-10"
              onClick={(e) => { e.stopPropagation(); scrollPrev(); }}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg h-10 w-10"
              onClick={(e) => { e.stopPropagation(); scrollNext(); }}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </>
        )}

        {/* Counter badge */}
        <Badge
          variant="secondary"
          className="absolute bottom-3 right-3 shadow-sm text-xs gap-1"
        >
          <ImageIcon className="h-3 w-3" />
          {selectedIndex + 1} / {images.length}
        </Badge>
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
          {images.map((image, index) => (
            <button
              key={index}
              onClick={() => scrollTo(index)}
              className={cn(
                "flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition-all",
                index === selectedIndex
                  ? "border-primary ring-2 ring-primary/20 opacity-100"
                  : "border-transparent opacity-50 hover:opacity-80"
              )}
            >
              <img
                src={image.url}
                alt={`Miniatura ${index + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}

      <ImageViewer
        images={images}
        initialIndex={selectedIndex}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
      />
    </>
  );
}

/* ── main page ── */
export default function MarketplacePropertyDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [contactOpen, setContactOpen] = useState(false);

  const { data: property, isLoading } = useQuery({
    queryKey: ["marketplace-property-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_properties_public" as any)
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as unknown as MarketplaceProperty;
    },
    enabled: !!id,
  });

  const logContactAccess = async () => {
    if (!profile?.organization_id || !profile?.user_id || !id) return;
    await supabase.from("marketplace_contact_access").insert({
      user_id: profile.user_id,
      organization_id: profile.organization_id,
      marketplace_property_id: id,
    });
  };

  const handleContactClick = async () => {
    await logContactAccess();
    setContactOpen(true);
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: property?.title || "Imóvel", url });
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado!");
    }
  };

  if (isLoading) return <DetailSkeleton />;
  if (!property) return <PropertyNotFound onBack={() => navigate("/marketplace")} />;

  const fullAddress = [
    property.address_street,
    property.address_number,
    property.address_complement,
    property.address_neighborhood,
    property.address_city,
    property.address_state,
  ].filter(Boolean).join(", ");

  const images = property.images?.map((url) => ({
    url: proxyDriveImageUrl(url, "w1600"),
    alt: property.title,
    is_cover: false,
  })) || [];

  const features = [
    { icon: Bed, value: property.bedrooms, label: "Quartos" },
    { icon: Bed, value: property.suites, label: "Suítes", accent: true },
    { icon: Bath, value: property.bathrooms, label: "Banheiros" },
    { icon: Car, value: property.parking_spots, label: "Vagas" },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Breadcrumb nav */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/marketplace")}
            className="gap-1 px-2"
          >
            <ArrowLeft className="h-4 w-4" /> Marketplace
          </Button>
          <ChevronRight className="h-3 w-3" />
          <span className="truncate font-medium text-foreground">{property.title}</span>
        </div>

        {/* Image carousel */}
        {images.length > 0 && <PropertyImageCarousel images={images} />}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title + price */}
            <div>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <Badge variant={property.transaction_type === "venda" ? "default" : "secondary"}>
                  {property.transaction_type === "venda" ? "Venda" : property.transaction_type === "aluguel" ? "Aluguel" : "Venda/Aluguel"}
                </Badge>
                {property.is_featured && (
                  <Badge className="bg-yellow-500 text-yellow-950">
                    <Star className="h-3 w-3 mr-1" /> Destaque
                  </Badge>
                )}
                {property.external_code && (
                  <Badge variant="outline" className="font-mono text-xs">{property.external_code}</Badge>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{property.title}</h1>

              {fullAddress && (
                <div className="flex items-center text-muted-foreground mt-2 gap-1">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span className="text-sm">{fullAddress}</span>
                </div>
              )}

              {/* Price row */}
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 mt-4">
                {property.sale_price && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Venda</p>
                    <p className="text-2xl sm:text-3xl font-bold text-primary">{fmtPrice(property.sale_price)}</p>
                  </div>
                )}
                {property.rent_price && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Aluguel</p>
                    <p className="text-2xl sm:text-3xl font-bold text-primary">{fmtPrice(property.rent_price, true)}</p>
                  </div>
                )}
                {!property.sale_price && !property.rent_price && (
                  <p className="text-xl font-bold text-muted-foreground">Sob consulta</p>
                )}
              </div>
            </div>

            <Separator />

            {/* Features grid */}
            <div>
              <h2 className="text-lg font-semibold mb-3">Características</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {features.map((feat) => (
                  <FeatureItem key={feat.label} {...feat} />
                ))}
              </div>

              {(property.area_total || property.area_built) && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  {property.area_total && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <Maximize className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-semibold text-sm">{property.area_total} m²</p>
                        <p className="text-xs text-muted-foreground">Área total</p>
                      </div>
                    </div>
                  )}
                  {property.area_built && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <Ruler className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-semibold text-sm">{property.area_built} m²</p>
                        <p className="text-xs text-muted-foreground">Área construída</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Description */}
            {property.description && (
              <>
                <Separator />
                <div>
                  <h2 className="text-lg font-semibold mb-3">Descrição</h2>
                  <p className="text-muted-foreground whitespace-pre-line leading-relaxed">
                    {property.description}
                  </p>
                </div>
              </>
            )}

            {/* Amenities */}
            {property.amenities && property.amenities.length > 0 && (
              <>
                <Separator />
                <div>
                  <h2 className="text-lg font-semibold mb-3">Comodidades</h2>
                  <div className="flex flex-wrap gap-2">
                    {property.amenities.map((amenity, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        <Tag className="h-3 w-3 mr-1" />
                        {amenity}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Sidebar — sticky on desktop */}
          <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            {/* CTA card */}
            <Card className="border-primary/20">
              <CardContent className="pt-6 space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">Interessado neste imóvel?</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Entre em contato com o corretor responsável para mais informações e agendar uma visita.
                  </p>
                </div>
                <Button className="w-full" size="lg" onClick={handleContactClick}>
                  <Phone className="h-4 w-4 mr-2" /> Ver contato do corretor
                </Button>
                <Button variant="outline" className="w-full" size="sm" onClick={handleShare}>
                  <Share2 className="h-4 w-4 mr-2" /> Compartilhar
                </Button>
              </CardContent>
            </Card>

            {/* Location card */}
            {(property.address_neighborhood || property.address_city) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Localização</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {property.address_neighborhood && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{property.address_neighborhood}</span>
                    </div>
                  )}
                  {property.address_city && (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{[property.address_city, property.address_state].filter(Boolean).join(" - ")}</span>
                    </div>
                  )}
                  {property.address_zipcode && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span>CEP: {property.address_zipcode}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <ContactDialog
        property={contactOpen ? property : null}
        open={contactOpen}
        onOpenChange={(open) => !open && setContactOpen(false)}
      />
    </div>
  );
}
