import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageGallery } from "@/components/properties/ImageViewer";
import { getImageUrl, type ImageRecord } from "@/lib/imageUrl";
import { proxyDriveImageUrl } from "@/lib/utils";
import { HabitaeLogo } from "@/components/HabitaeLogo";
import {
  MapPin, Bed, Bath, Car, Building2, MessageCircle, Share2,
  Phone, Maximize, DollarSign, Calendar, Home, CheckCircle2,
  Hash,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const statusLabels: Record<string, string> = {
  disponivel: "Disponível", reservado: "Reservado",
  vendido: "Vendido", alugado: "Alugado", inativo: "Indisponível",
};
const transactionLabels: Record<string, string> = {
  venda: "Venda", aluguel: "Aluguel", ambos: "Venda ou Aluguel",
};

interface PublicPropertyData {
  property: {
    id: string; title: string; description: string | null;
    property_type: string | null; transaction_type: string; status: string;
    sale_price: number | null; rent_price: number | null;
    condominium_fee: number | null; iptu: number | null;
    bedrooms: number | null; suites: number | null;
    bathrooms: number | null; parking_spots: number | null;
    area_total: number | null; area_built: number | null;
    amenities: string[] | null; neighborhood: string | null;
    city: string | null; state: string | null;
    youtube_url: string | null; property_condition: string | null; floor: number | null;
    property_code: string | null;
  };
  images: Array<{
    id: string; url: string; is_cover: boolean; display_order: number;
    r2_key_full?: string | null; r2_key_thumb?: string | null;
    storage_provider?: string | null; cached_thumbnail_url?: string | null;
  }>;
  media: Array<{ id: string; url: string; display_order: number }>;
  broker: { name: string | null; phone: string | null; avatar_url: string | null };
}

function resolveImageUrl(img: PublicPropertyData["images"][0]): string {
  // If it has R2 fields, use the imageUrl resolver
  if (img.storage_provider === "r2" && (img.r2_key_full || img.r2_key_thumb)) {
    return getImageUrl(img as ImageRecord, "full");
  }
  // Otherwise proxy Drive URLs or pass through
  return proxyDriveImageUrl(img.url, "w1600");
}

export default function PublicPropertyBySlug() {
  const { slug, orgSlug, code } = useParams<{ slug?: string; orgSlug?: string; code?: string }>();
  const { toast } = useToast();
  const [data, setData] = useState<PublicPropertyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function fetchData() {
      let result: any = null;
      let error: any = null;

      if (orgSlug && code) {
        // New format: /i/:orgSlug/:code
        const resp = await (supabase.rpc as any)(
          "get_public_property_by_org_code", { p_org_slug: orgSlug, p_property_code: code }
        );
        result = resp.data;
        error = resp.error;
      } else if (slug) {
        // Legacy format: /i/:slug
        const resp = await (supabase.rpc as any)(
          "get_public_property_by_slug", { p_slug: slug }
        );
        result = resp.data;
        error = resp.error;
      }

      if (error || !result) {
        setNotFound(true);
      } else {
        setData(result);
        if (result.property?.title) {
          document.title = `${result.property.title} | Imóvel`;
        }
      }
      setLoading(false);
    }
    fetchData();
  }, [slug, orgSlug, code]);

  const formatPrice = (price: number | null, isRent = false) => {
    if (!price) return null;
    const formatted = new Intl.NumberFormat("pt-BR", {
      style: "currency", currency: "BRL", maximumFractionDigits: 0,
    }).format(price);
    return isRent ? `${formatted}/mês` : formatted;
  };

  const handleWhatsApp = () => {
    if (!data?.broker?.phone) return;
    const phone = data.broker.phone.replace(/\D/g, "");
    const msg = encodeURIComponent(
      `Olá! Vi o imóvel "${data.property.title}"${data.property.property_code ? ` (cód. ${data.property.property_code})` : ""} e gostaria de mais informações.`
    );
    window.open(`https://wa.me/55${phone}?text=${msg}`, "_blank");
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: data?.property.title, url }); } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copiado!" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-[60vh] w-full rounded-2xl" />
          <div className="grid md:grid-cols-3 gap-8">
            <Skeleton className="h-64 md:col-span-2" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Building2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Imóvel não encontrado</h2>
            <p className="text-muted-foreground mb-6">
              Este link não é válido, expirou ou foi revogado.
            </p>
            <Button onClick={() => (window.location.href = "/")}>
              <Home className="h-4 w-4 mr-2" />
              Ir para página inicial
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { property: prop, broker } = data;

  // Resolve images using R2 or Drive proxy
  const images = data.images?.length > 0
    ? data.images.map((img) => ({
        id: img.id,
        url: resolveImageUrl(img),
        is_cover: img.is_cover,
        display_order: img.display_order,
      }))
    : data.media?.map((m, i) => ({
        id: m.id,
        url: proxyDriveImageUrl(m.url, "w1600"),
        is_cover: i === 0,
        display_order: m.display_order,
      })) || [];

  const location = [prop.neighborhood, prop.city, prop.state].filter(Boolean).join(", ");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div />
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handleShare} className="h-9 w-9 rounded-full">
              <Share2 className="h-4 w-4" />
            </Button>
            {broker.phone && (
              <Button size="sm" className="rounded-full" onClick={handleWhatsApp}>
                <MessageCircle className="h-4 w-4 mr-2" />
                Falar com corretor
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-8">
        {/* Images */}
        {images.length > 0 ? (
          <div className="rounded-2xl overflow-hidden">
            <ImageGallery
              images={images.map((img) => ({
                url: img.url,
                alt: prop.title,
                is_cover: img.is_cover,
              }))}
            />
          </div>
        ) : (
          <div className="aspect-video bg-muted rounded-2xl flex items-center justify-center">
            <Building2 className="h-16 w-16 text-muted-foreground" />
          </div>
        )}

        {/* YouTube */}
        {prop.youtube_url && (() => {
          const match = prop.youtube_url!.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([a-zA-Z0-9_-]{11})/);
          if (!match) return null;
          return (
            <div className="aspect-video rounded-2xl overflow-hidden">
              <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${match[1]}`}
                title="Vídeo" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen style={{ border: 0 }} />
            </div>
          );
        })()}

        {/* Title + badges */}
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {prop.property_type && <Badge variant="outline" className="rounded-full">{prop.property_type}</Badge>}
            <Badge variant={prop.status === "disponivel" ? "default" : "secondary"} className="rounded-full">
              {statusLabels[prop.status] || prop.status}
            </Badge>
            <Badge variant="outline" className="rounded-full">
              {transactionLabels[prop.transaction_type] || prop.transaction_type}
            </Badge>
            {prop.property_code && (
              <Badge variant="outline" className="rounded-full font-mono">
                <Hash className="h-3 w-3 mr-1" />
                {prop.property_code}
              </Badge>
            )}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{prop.title}</h1>
          {location && (
            <div className="flex items-center text-muted-foreground">
              <MapPin className="h-4 w-4 mr-1.5" /> {location}
            </div>
          )}
        </div>

        {/* Prices */}
        <div className="flex flex-wrap gap-4">
          {prop.sale_price && (
            <div className="flex-1 min-w-[200px] p-5 rounded-2xl border">
              <p className="text-sm text-muted-foreground mb-1">Valor de Venda</p>
              <p className="text-3xl font-extrabold text-primary">{formatPrice(prop.sale_price)}</p>
            </div>
          )}
          {prop.rent_price && (
            <div className="flex-1 min-w-[200px] p-5 rounded-2xl border">
              <p className="text-sm text-muted-foreground mb-1">Aluguel</p>
              <p className="text-3xl font-extrabold text-primary">{formatPrice(prop.rent_price, true)}</p>
            </div>
          )}
        </div>

        {/* Costs */}
        {(prop.condominium_fee || prop.iptu) && (
          <div className="flex gap-6 text-sm text-muted-foreground">
            {prop.condominium_fee && (
              <span className="flex items-center gap-1.5">
                <DollarSign className="h-4 w-4" /> Condomínio: <strong>{formatPrice(prop.condominium_fee)}/mês</strong>
              </span>
            )}
            {prop.iptu && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" /> IPTU: <strong>{formatPrice(prop.iptu)}/ano</strong>
              </span>
            )}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main */}
          <div className="lg:col-span-2 space-y-8">
            {/* Features */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { icon: Bed, value: prop.bedrooms || 0, label: `Quartos${prop.suites ? ` (${prop.suites} suíte${prop.suites > 1 ? "s" : ""})` : ""}` },
                { icon: Bath, value: prop.bathrooms || 0, label: "Banheiros" },
                { icon: Car, value: prop.parking_spots || 0, label: "Vagas" },
                { icon: Maximize, value: prop.area_total ? `${prop.area_total}m²` : "-", label: "Área Total" },
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 border">
                  <f.icon className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-semibold">{f.value}</p>
                    <p className="text-xs text-muted-foreground">{f.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Description */}
            {prop.description && (
              <div>
                <h2 className="text-xl font-semibold mb-3">Sobre o imóvel</h2>
                <p className="text-muted-foreground whitespace-pre-line leading-relaxed">{prop.description}</p>
              </div>
            )}

            {/* Amenities */}
            {prop.amenities && prop.amenities.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-3">Comodidades</h2>
                <div className="flex flex-wrap gap-2">
                  {prop.amenities.map((a, i) => (
                    <Badge key={i} variant="outline" className="rounded-full px-3 py-1">
                      <CheckCircle2 className="h-3 w-3 mr-1.5" /> {a}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - Broker Contact */}
          <div>
            <Card className="sticky top-20">
              <CardContent className="pt-6 space-y-4">
                <h3 className="font-semibold text-lg">Fale com o corretor</h3>
                {broker.avatar_url && (
                  <img src={broker.avatar_url} alt={broker.name || "Corretor"}
                    className="w-16 h-16 rounded-full object-cover" />
                )}
                {broker.name && <p className="font-medium">{broker.name}</p>}
                {prop.property_code && (
                  <p className="text-xs text-muted-foreground font-mono">
                    Cód. do imóvel: #{prop.property_code}
                  </p>
                )}
                {broker.phone && (
                  <>
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <Phone className="h-4 w-4" /> {broker.phone}
                    </p>
                    <Button className="w-full" onClick={handleWhatsApp}>
                      <MessageCircle className="h-4 w-4 mr-2" />
                      WhatsApp
                    </Button>
                  </>
                )}
                <Button variant="outline" className="w-full" onClick={() => {
                  if (broker.phone) window.open(`tel:${broker.phone.replace(/\D/g, "")}`, "_self");
                }}>
                  <Phone className="h-4 w-4 mr-2" />
                  Ligar
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-16 py-8 text-center text-sm text-muted-foreground">
      </footer>
    </div>
  );
}
