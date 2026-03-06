import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ImageGallery } from "@/components/properties/ImageViewer";
import { useToast } from "@/hooks/use-toast";
import { proxyDriveImageUrl } from "@/lib/utils";
import { useLandingContent } from "@/hooks/useLandingContent";
import { useLandingOverrides } from "@/hooks/useLandingOverrides";
import { HabitaeLogo } from "@/components/HabitaeLogo";
import { Hash } from "lucide-react";
import * as LucideIcons from "lucide-react";
import {
  MapPin,
  Bed,
  Bath,
  Car,
  Ruler,
  Building2,
  Send,
  Share2,
  Facebook,
  Linkedin,
  MessageCircle,
  Calendar,
  DollarSign,
  CheckCircle2,
  Home,
  Maximize,
  Sparkles,
  RefreshCw,
  ChevronDown,
  Phone,
} from "lucide-react";
import type { PropertyWithDetails } from "@/hooks/useProperties";

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

const statusLabels: Record<string, string> = {
  disponivel: "Disponível",
  reservado: "Reservado",
  vendido: "Vendido",
  alugado: "Alugado",
  inativo: "Indisponível",
};

const transactionLabels: Record<string, string> = {
  venda: "Venda",
  aluguel: "Aluguel",
  ambos: "Venda ou Aluguel",
};

// Dynamic icon component
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Sun: LucideIcons.Sun, Shield: LucideIcons.Shield, Leaf: LucideIcons.Leaf,
  Star: LucideIcons.Star, Heart: LucideIcons.Heart, Home: LucideIcons.Home,
  Key: LucideIcons.Key, Award: LucideIcons.Award, Zap: LucideIcons.Zap,
  Wifi: LucideIcons.Wifi, Waves: LucideIcons.Waves, Mountain: LucideIcons.Mountain,
  TreePine: LucideIcons.TreePine, Building: LucideIcons.Building,
  MapPin: LucideIcons.MapPin, Clock: LucideIcons.Clock, Coffee: LucideIcons.Coffee,
  Dumbbell: LucideIcons.Dumbbell, Utensils: LucideIcons.Utensils,
  GraduationCap: LucideIcons.GraduationCap, ShoppingBag: LucideIcons.ShoppingBag,
  Plane: LucideIcons.Plane, Train: LucideIcons.Train,
  ParkingCircle: LucideIcons.ParkingCircle, Lock: LucideIcons.Lock,
  Eye: LucideIcons.Eye, Sunset: LucideIcons.Sunset, Wind: LucideIcons.Wind,
  Droplets: LucideIcons.Droplets, Thermometer: LucideIcons.Thermometer,
  Sparkles: LucideIcons.Sparkles,
};

function DynamicIcon({ name, className }: { name: string; className?: string }) {
  const IconComponent = iconMap[name];
  if (!IconComponent) return <CheckCircle2 className={className} />;
  return <IconComponent className={className} />;
}

export default function PropertyLandingPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [property, setProperty] = useState<PropertyWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "", email: "", phone: "", message: "",
  });

  const { content: aiContent, isLoading: isLoadingAI, isGenerating, regenerate } = useLandingContent(id);
  const { overrides } = useLandingOverrides(id);

  // Merge overrides with AI content
  const headline = overrides?.custom_headline || aiContent?.headline || property?.title;
  const subheadline = overrides?.custom_subheadline || aiContent?.subheadline;
  const description = overrides?.custom_description || aiContent?.description_persuasive || property?.description;
  const ctaPrimary = overrides?.custom_cta_primary || aiContent?.cta_primary;
  const ctaSecondary = overrides?.custom_cta_secondary || aiContent?.cta_secondary;
  const hideAddress = overrides?.hide_exact_address ?? true;

  useEffect(() => {
    async function fetchProperty() {
      if (!id) return;

      // Use secure RPC functions that only expose safe columns (no commission, internal metadata, full address)
      const { data: propertyRows, error } = await (supabase.rpc as any)('get_public_property', { p_id: id });

      if (error || !propertyRows || propertyRows.length === 0) {
        console.error("Error fetching property:", error);
        setProperty(null);
        setLoading(false);
        return;
      }

      const propData = propertyRows[0];

      // Fetch property type name
      let propertyType = null;
      if (propData.property_type_id) {
        const { data: typeName } = await (supabase.rpc as any)('get_property_type_name', { p_type_id: propData.property_type_id });
        if (typeName) {
          propertyType = { id: propData.property_type_id, name: typeName };
        }
      }

      // Fetch images via secure function
      const { data: imageRows } = await (supabase.rpc as any)('get_public_property_images', { p_property_id: id });

      let images = (imageRows || []).map((img: any) => ({
        id: img.id,
        url: img.url,
        is_cover: img.is_cover || false,
        display_order: img.display_order || 0,
        property_id: id!,
        created_at: new Date().toISOString(),
        image_type: img.image_type || 'photo',
        source: img.source,
        scraped_from_url: null,
      }));

      // Fallback to property_media if no images
      if (images.length === 0) {
        const { data: mediaRows } = await (supabase.rpc as any)('get_public_property_media', { p_property_id: id });
        if (mediaRows && mediaRows.length > 0) {
          images = mediaRows.map((m: any, idx: number) => ({
            id: m.id,
            url: m.stored_url || m.original_url,
            is_cover: idx === 0,
            display_order: m.display_order || idx,
            property_id: id!,
            created_at: new Date().toISOString(),
            image_type: 'photo' as const,
            source: 'media',
            scraped_from_url: null,
          }));
        }
      }

      const propertyData = {
        ...propData,
        property_type: propertyType,
        images,
      } as PropertyWithDetails;

      setProperty(propertyData);
      setLoading(false);
    }
    fetchProperty();
  }, [id]);

  useEffect(() => {
    if (aiContent?.seo_title) {
      document.title = aiContent.seo_title;
    } else if (property?.title) {
      document.title = `${property.title} | Habitae`;
    }
  }, [aiContent, property]);

  const formatPrice = (price: number | null, isRent = false) => {
    if (!price) return null;
    const formatted = new Intl.NumberFormat("pt-BR", {
      style: "currency", currency: "BRL", maximumFractionDigits: 0,
    }).format(price);
    return isRent ? `${formatted}/mês` : formatted;
  };

  const getFullAddress = () => {
    if (!property) return "";
    return [property.address_neighborhood, property.address_city, property.address_state].filter(Boolean).join(", ");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!property) return;
    setSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    toast({ title: "Mensagem enviada!", description: "Em breve entraremos em contato." });
    setSubmitted(true);
    setSubmitting(false);
  };

  const handleShare = async (platform: string) => {
    const url = window.location.href;
    const title = aiContent?.headline || property?.title || "Imóvel";
    const text = `Confira este imóvel: ${title}`;
    const shareUrls: Record<string, string> = {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`${text} - ${url}`)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    };
    if (platform === "copy") {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copiado!", description: "O link foi copiado para a área de transferência." });
    } else if (shareUrls[platform]) {
      window.open(shareUrls[platform], "_blank", "width=600,height=400");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
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

  if (!property) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Building2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Imóvel não encontrado</h2>
            <p className="text-muted-foreground mb-6">Este imóvel não está mais disponível ou o link é inválido.</p>
            <Button onClick={() => (window.location.href = "/")}>
              <Home className="h-4 w-4 mr-2" />
              Ir para página inicial
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isAvailable = property.status === "disponivel";
  const ctaText = ctaPrimary || (isAvailable ? "Agendar visita" : "Receber novidades");
  const hasImages = property.images && property.images.length > 0;

  return (
    <div className="min-h-screen bg-background">
      {aiContent?.seo_description && <meta name="description" content={aiContent.seo_description} />}

      {/* Minimal sticky header — Vizcom-style */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div />
          <div className="flex items-center gap-1 sm:gap-2">
            <Button variant="ghost" size="icon" onClick={() => handleShare("whatsapp")} className="h-9 w-9 rounded-full">
              <MessageCircle className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => handleShare("copy")} className="h-9 w-9 rounded-full hidden sm:flex">
              <Share2 className="h-4 w-4" />
            </Button>
            <Button size="sm" className="rounded-full glow-primary-hover" onClick={() => document.querySelector("form")?.scrollIntoView({ behavior: "smooth" })}>
              <Phone className="h-4 w-4 mr-2" />
              Contato
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4">
        {/* AI Content Loading */}
        {(isLoadingAI || isGenerating) && (
          <div className="py-4">
            <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <div className="animate-pulse"><Sparkles className="h-6 w-6 text-primary" /></div>
                  <div className="flex-1">
                    <p className="font-medium text-primary text-sm">
                      {isGenerating ? "Gerando conteúdo exclusivo com IA..." : "Carregando conteúdo..."}
                    </p>
                    <Progress className="mt-2 h-1.5" value={isGenerating ? 66 : 33} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Hero: Full-width image gallery */}
        <section className="py-6">
          {hasImages ? (
            <div className="rounded-2xl overflow-hidden">
              <ImageGallery
                images={property.images!.map((img) => ({
                  url: proxyDriveImageUrl(img.url, "w1600"),
                  alt: aiContent?.headline || property.title,
                  is_cover: img.is_cover || false,
                }))}
              />
            </div>
          ) : (
            <div className="aspect-video bg-muted rounded-2xl flex items-center justify-center">
              <div className="text-center">
                <Building2 className="h-16 w-16 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">Imagens em breve</p>
              </div>
            </div>
          )}
        </section>

        {/* YouTube Video */}
        {(property as any).youtube_url && extractYouTubeId((property as any).youtube_url) && (
          <section className="py-6">
            <div className="aspect-video rounded-2xl overflow-hidden">
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${extractYouTubeId((property as any).youtube_url)}`}
                title="Vídeo do imóvel"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
                style={{ border: 0 }}
              />
            </div>
          </section>
        )}

        {/* Title + Price Hero Band — Editorial Lightweight style */}
        <section className="py-8 sm:py-12 space-y-5">
          <span className="editorial-label flex items-center gap-2">
            <span className="color-dot" />
            {property.property_type?.name || "Imóvel"}
          </span>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={isAvailable ? "default" : "secondary"} className="rounded-full px-3">{statusLabels[property.status]}</Badge>
            <Badge variant="outline" className="rounded-full px-3">{transactionLabels[property.transaction_type]}</Badge>
            {(property as any).property_code && (
              <Badge variant="outline" className="rounded-full px-3 font-mono">
                <Hash className="h-3 w-3 mr-1" />
                {(property as any).property_code}
              </Badge>
            )}
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.05] tracking-tight font-display">
            {headline}
          </h1>
          {subheadline && (
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl">{subheadline}</p>
          )}

          <div className="flex items-center text-muted-foreground">
            <MapPin className="h-4 w-4 mr-1.5 shrink-0" />
            {getFullAddress() || "Localização não informada"}
          </div>

          {/* Colorful divider */}
          <hr className="section-divider" />

          {/* Price Cards — with colorful accents */}
          <div className="flex flex-wrap gap-4 pt-2">
            {property.sale_price && (
              <div className="flex-1 min-w-[200px] p-5 sm:p-6 rounded-2xl border border-primary/15 relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-[2px]" style={{ background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)), transparent)" }} />
                <p className="editorial-label-muted mb-1">Valor de Venda</p>
                <p className="text-3xl sm:text-4xl font-extrabold text-gradient-vibrant tracking-tight">{formatPrice(property.sale_price)}</p>
              </div>
            )}
            {property.rent_price && (
              <div className="flex-1 min-w-[200px] p-5 sm:p-6 rounded-2xl border border-accent/15 relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-[2px]" style={{ background: "linear-gradient(90deg, hsl(var(--accent)), hsl(var(--warning)), transparent)" }} />
                <p className="editorial-label-muted mb-1">Aluguel</p>
                <p className="text-3xl sm:text-4xl font-extrabold text-gradient-warm tracking-tight">{formatPrice(property.rent_price, true)}</p>
              </div>
            )}
          </div>

          {/* Quick costs */}
          {(property.condominium_fee || property.iptu) && (
            <div className="flex gap-6 text-sm text-muted-foreground">
              {property.condominium_fee && (
                <span className="flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4" />
                  Condomínio: <strong>{formatPrice(property.condominium_fee)}/mês</strong>
                </span>
              )}
              {property.iptu && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  IPTU: <strong>{formatPrice(property.iptu)}/ano</strong>
                </span>
              )}
            </div>
          )}
        </section>

        <hr className="section-divider" />

        <div className="grid lg:grid-cols-3 gap-8 py-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Features Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { icon: Bed, value: property.bedrooms || 0, label: `Quartos${property.suites ? ` (${property.suites} suíte${(property.suites || 0) > 1 ? 's' : ''})` : ''}` },
                { icon: Bath, value: property.bathrooms || 0, label: "Banheiros" },
                { icon: Car, value: property.parking_spots || 0, label: "Vagas" },
                { icon: Maximize, value: property.area_total ? `${property.area_total}m²` : "-", label: "Área Total" },
              ].map((feat, i) => (
                <div key={i} className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 border">
                  <feat.icon className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="text-xl font-bold">{feat.value}</p>
                    <p className="text-xs text-muted-foreground">{feat.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Key Features (overrides or AI-generated) */}
            {(() => {
              const features = (overrides?.custom_key_features && overrides.custom_key_features.length > 0)
                ? overrides.custom_key_features
                : aiContent?.key_features;
              if (!features || features.length === 0) return null;
              return (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      Diferenciais Exclusivos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-3">
                      {features.map((feature: any, index: number) => (
                        <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                          <div className="p-1.5 rounded-full bg-primary/10 shrink-0">
                            <DynamicIcon name={feature.icon} className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{feature.title}</p>
                            <p className="text-xs text-muted-foreground">{feature.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Description */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Sobre o Imóvel</CardTitle>
                {aiContent && (
                  <Button variant="ghost" size="sm" onClick={regenerate} disabled={isGenerating} className="gap-2">
                    <RefreshCw className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
                    Regenerar
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-line leading-relaxed">
                  {description || "Descrição não disponível."}
                </p>
              </CardContent>
            </Card>

            {/* Amenities */}
            {property.amenities && property.amenities.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Comodidades</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {property.amenities.map((amenity, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm py-1">
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                        {amenity}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Location */}
            {property.address_city && property.address_state && (
              <Card>
                <CardHeader><CardTitle>Localização</CardTitle></CardHeader>
                <CardContent>
                  <div className="aspect-video rounded-lg overflow-hidden">
                    <iframe
                      width="100%" height="100%" style={{ border: 0 }} loading="lazy" allowFullScreen
                      referrerPolicy="no-referrer-when-downgrade"
                      src={import.meta.env.VITE_GOOGLE_MAPS_EMBED_KEY
                        ? `https://www.google.com/maps/embed/v1/place?key=${import.meta.env.VITE_GOOGLE_MAPS_EMBED_KEY}&q=${encodeURIComponent(
                            hideAddress
                              ? `${property.address_neighborhood || ""}, ${property.address_city}, ${property.address_state}, Brasil`
                              : `${property.address_street || ""} ${property.address_number || ""}, ${property.address_neighborhood || ""}, ${property.address_city}, ${property.address_state}, Brasil`
                          )}&zoom=${hideAddress ? 14 : 16}`
                        : `https://maps.google.com/maps?q=${encodeURIComponent(
                            hideAddress
                              ? `${property.address_neighborhood || ""}, ${property.address_city}, ${property.address_state}, Brasil`
                              : `${property.address_street || ""} ${property.address_number || ""}, ${property.address_neighborhood || ""}, ${property.address_city}, ${property.address_state}, Brasil`
                          )}&output=embed`}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground mt-3">
                    {hideAddress
                      ? `${property.address_neighborhood || ""}, ${property.address_city}, ${property.address_state}`
                      : getFullAddress()}
                  </p>
                  {hideAddress && (
                    <p className="text-xs text-muted-foreground mt-1">📍 Localização aproximada — endereço exato disponível após contato</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Contact Form Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-20">
              <Card className="border-2 border-primary/20 shadow-lg">
                <CardHeader className="bg-primary/5 rounded-t-xl">
                  <CardTitle className="text-center text-lg">
                    {isAvailable ? "Tenho interesse neste imóvel!" : "Receba novidades de imóveis similares"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  {submitted ? (
                    <div className="text-center py-8">
                      <CheckCircle2 className="h-14 w-14 text-primary mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Mensagem enviada!</h3>
                      <p className="text-sm text-muted-foreground">Em breve um corretor entrará em contato.</p>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-3">
                      <Input placeholder="Seu nome completo *" value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                      <Input type="email" placeholder="Seu e-mail *" value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
                      <Input type="tel" placeholder="Seu WhatsApp *" value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })} required />
                      <Textarea placeholder="Sua mensagem (opcional)" value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })} rows={3} />
                      <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                        {submitting ? "Enviando..." : (<><Send className="h-4 w-4 mr-2" />{ctaText}</>)}
                      </Button>
                      {ctaSecondary && (
                        <Button type="button" variant="outline" className="w-full"
                          onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Olá! ${ctaSecondary} - ${headline} - ${window.location.href}`)}`, "_blank")}>
                          <MessageCircle className="h-4 w-4 mr-2" />
                          {ctaSecondary}
                        </Button>
                      )}
                      <p className="text-[10px] text-muted-foreground text-center">
                        Ao enviar, você concorda com nossa política de privacidade.
                      </p>
                    </form>
                  )}
                </CardContent>
              </Card>

              <Button variant="outline" className="w-full mt-3"
                onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Olá! Tenho interesse no imóvel: ${aiContent?.headline || property.title} - ${window.location.href}`)}`, "_blank")}>
                <MessageCircle className="h-4 w-4 mr-2" />
                Contato via WhatsApp
              </Button>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile sticky CTA */}
      <div className="sticky bottom-0 lg:hidden bg-background/95 backdrop-blur-md border-t p-3">
        <Button className="w-full" size="lg"
          onClick={() => document.querySelector("form")?.scrollIntoView({ behavior: "smooth" })}>
          <Send className="h-4 w-4 mr-2" />{ctaText}
        </Button>
      </div>

      {/* Footer — minimal */}
      <footer className="mt-16 py-12 border-t border-border/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center space-y-3">
          <p className="text-xs text-muted-foreground/60 tracking-wide">
            © {new Date().getFullYear()} — Gestão imobiliária simplificada
          </p>
        </div>
      </footer>
    </div>
  );
}
