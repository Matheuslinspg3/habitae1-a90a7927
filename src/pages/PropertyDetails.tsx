import { useState, useEffect } from "react";
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ImageGallery } from "@/components/properties/ImageViewer";
import { proxyDriveImageUrl } from "@/lib/utils";
import { getImageUrl } from "@/lib/imageUrl";
import { useProperties, PropertyWithDetails, PropertyFormData } from "@/hooks/useProperties";
import { PropertyForm } from "@/components/properties/PropertyForm";
import { useAuth } from "@/contexts/AuthContext";
import { useShareLink } from "@/hooks/useShareLink";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActivityLogger } from "@/hooks/useActivityLogger";
import {
  ArrowLeft,
  Edit,
  ExternalLink,
  Share2,
  MapPin,
  Bed,
  Bath,
  Car,
  Ruler,
  Building2,
  DollarSign,
  Calendar,
  Copy,
  Check,
  Maximize,
  Home,
  Layers,
  Import,
  Hash,
  User,
  Phone,
  Mail,
  FileText,
  CreditCard,
  Percent,
  ClipboardList,
  Sparkles,
  QrCode,
  CopyPlus,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LandingPageEditor } from "@/components/properties/LandingPageEditor";
import { PropertyQRCode } from "@/components/properties/PropertyQRCode";

const statusColors: Record<string, string> = {
  disponivel: "bg-success/15 text-success",
  reservado: "bg-warning/15 text-warning",
  vendido: "bg-info/15 text-info",
  alugado: "bg-accent/15 text-accent",
  inativo: "bg-muted text-muted-foreground",
};

const statusLabels: Record<string, string> = {
  disponivel: "Disponível",
  reservado: "Reservado",
  vendido: "Vendido",
  alugado: "Alugado",
  inativo: "Inativo",
};

interface PropertyImage {
  id?: string;
  url: string;
  path?: string;
  is_cover?: boolean;
  display_order?: number;
}

export default function PropertyDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { properties, isLoading, updateProperty, publishToMarketplace, isUpdating, createProperty, isCreating } = useProperties();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const { generateShareLink, isGenerating: isGeneratingShareLink } = useShareLink();

  const property = properties.find((p) => p.id === id);
  const { logActivity } = useActivityLogger();

  // Log property view
  useEffect(() => {
    if (property && id) {
      logActivity({
        actionType: 'viewed',
        entityType: 'property',
        entityId: id,
        entityName: property.title || '',
      });
    }
  }, [id]);

  // Auto-open edit form from ?edit=true
  useEffect(() => {
    if (searchParams.get('edit') === 'true' && property) {
      setFormOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, property]);

  // Auto-trigger duplicate from ?duplicate=true
  const [autoDuplicate, setAutoDuplicate] = useState(() => false);
  useEffect(() => {
    if (searchParams.get('duplicate') === 'true' && property) {
      setSearchParams({}, { replace: true });
      setAutoDuplicate(true);
    }
  }, [searchParams, property]);

  // Fetch property owners
  const { data: owners = [] } = useQuery({
    queryKey: ["property-owners-detail", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("property_owners")
        .select("*")
        .eq("property_id", id)
        .order("is_primary", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const handleFormSubmit = async (data: PropertyFormData, images: PropertyImage[], ownerData?: any, publishMarketplace?: boolean) => {
    if (!id) return;
    await updateProperty(id, data, images, ownerData);
    if (publishMarketplace) {
      // Fire-and-forget: run in background
      publishToMarketplace(id).catch(() => {});
    }
  };

  const formatPrice = (price: number | null, isRent = false) => {
    if (!price) return null;
    const formatted = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(price);
    return isRent ? `${formatted}/mês` : formatted;
  };

  const getFullAddress = () => {
    if (!property) return "";
    const parts = [
      property.address_street,
      property.address_number,
      property.address_complement,
      property.address_neighborhood,
      property.address_city,
      property.address_state,
    ].filter(Boolean);
    return parts.join(", ");
  };

  const generateLandingPageUrl = () => {
    return buildPublicUrl(id!, property?.property_code);
  };

  const handleCopyLink = async () => {
    if (!id) return;
    const url = await generateShareLink(id);
    if (url) {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({
        title: "Link seguro copiado!",
        description: "O link público (sem dados do proprietário) foi copiado.",
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (!id) return;
    const url = await generateShareLink(id);
    if (!url) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: property?.title,
          text: `Confira este imóvel: ${property?.title}`,
          url,
        });
      } catch {
        await navigator.clipboard.writeText(url);
        toast({ title: "Link copiado!" });
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copiado!" });
    }
  };

  const handleOpenLandingPage = () => {
    window.open(generateLandingPageUrl(), "_blank");
  };

  const handleDuplicate = async () => {
    if (!property || isDuplicating) return;
    setIsDuplicating(true);
    try {
      // Extract only valid table columns, excluding system/identity fields
      const p = property as any;
      const duplicateData: PropertyFormData = {
        title: `${p.title || "Imóvel"} (cópia)`,
        status: "disponivel" as const,
        description: p.description,
        transaction_type: p.transaction_type,
        property_type_id: p.property_type_id,
        sale_price: p.sale_price,
        rent_price: p.rent_price,
        condominium_fee: p.condominium_fee,
        iptu: p.iptu,
        iptu_monthly: p.iptu_monthly,
        bedrooms: p.bedrooms,
        suites: p.suites,
        bathrooms: p.bathrooms,
        parking_spots: p.parking_spots,
        area_total: p.area_total,
        area_built: p.area_built,
        area_useful: p.area_useful,
        floor: p.floor,
        address_street: p.address_street,
        address_number: p.address_number,
        address_complement: p.address_complement,
        address_neighborhood: p.address_neighborhood,
        address_city: p.address_city,
        address_state: p.address_state,
        address_zipcode: p.address_zipcode,
        latitude: p.latitude,
        longitude: p.longitude,
        amenities: p.amenities,
        featured: p.featured,
        commission_value: p.commission_value,
        commission_type: p.commission_type,
        inspection_fee: p.inspection_fee,
        launch_stage: p.launch_stage,
        development_name: p.development_name,
        property_condition: p.property_condition,
        beach_distance_meters: p.beach_distance_meters,
        captador_id: p.captador_id,
        payment_options: p.payment_options,
        sale_price_financed: p.sale_price_financed,
        youtube_url: p.youtube_url,
        description_generated: false,
      };

      // Resolve full URLs and exclude R2/storage keys to prevent cascading deletions
      const images = (property.images || []).map((img: any, i: number) => ({
        url: getImageUrl(img, 'full'),
        is_cover: img.is_cover || i === 0,
        display_order: img.display_order ?? i,
      }));

      const newProperty = await createProperty(duplicateData, images);
      if (newProperty?.id) {
        toast({
          title: "Imóvel duplicado!",
          description: "Redirecionando para edição...",
        });
        navigate(`/imoveis/${newProperty.id}?edit=true`);
      }
    } catch (err: any) {
      toast({
        title: "Erro ao duplicar",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsDuplicating(false);
    }
  };

  // Execute auto-duplicate after handleDuplicate is defined
  useEffect(() => {
    if (autoDuplicate) {
      setAutoDuplicate(false);
      handleDuplicate();
    }
  }, [autoDuplicate]);

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <PageHeader title="Carregando..." />
        <div className="flex-1 p-4 sm:p-6 space-y-6">
          <Skeleton className="h-80 w-full" />
          <div className="grid md:grid-cols-2 gap-6">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="flex flex-col min-h-screen">
        <PageHeader title="Imóvel não encontrado" />
        <div className="flex-1 p-6 flex items-center justify-center">
          <Card className="max-w-md">
            <CardContent className="pt-6 text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Imóvel não encontrado</h2>
              <p className="text-muted-foreground mb-4">
                O imóvel que você está procurando não existe ou foi removido.
              </p>
              <Button onClick={() => navigate("/imoveis")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar para Imóveis
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader
        title={property.title}
        description={getFullAddress()}
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setQrOpen(true)}>
              <QrCode className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">QR Code</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleShare}>
              <Share2 className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Compartilhar</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopyLink}>
              {copied ? (
                <Check className="h-4 w-4 sm:mr-2" />
              ) : (
                <Copy className="h-4 w-4 sm:mr-2" />
              )}
              <span className="hidden sm:inline">Copiar Link</span>
            </Button>
            <Button size="sm" onClick={handleOpenLandingPage}>
              <ExternalLink className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Ver Landing Page</span>
            </Button>
          </div>
        }
      />

      <div className="flex-1 p-4 sm:p-6 space-y-6">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/imoveis")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para lista
        </Button>

        {/* Image gallery */}
        <ImageGallery
          images={property.images?.map((img) => ({
            url: proxyDriveImageUrl(img.url, "w1600"),
            alt: property.title,
            is_cover: img.is_cover || false,
          })) || []}
        />

        {/* YouTube Video */}
        {(property as any).youtube_url && (() => {
          const match = (property as any).youtube_url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([a-zA-Z0-9_-]{11})/);
          const videoId = match ? match[1] : null;
          if (!videoId) return null;
          return (
            <div className="aspect-video rounded-lg overflow-hidden">
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${videoId}`}
                title="Vídeo do imóvel"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ border: 0 }}
              />
            </div>
          );
        })()}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title and price */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge className={statusColors[property.status]}>
                        {statusLabels[property.status]}
                      </Badge>
                      {(property as any).property_code && (
                        <Badge variant="outline" className="font-mono">
                          <Hash className="h-3 w-3 mr-1" />
                          {(property as any).property_code}
                        </Badge>
                      )}
                      {property.property_type && (
                        <Badge variant="outline">{property.property_type.name}</Badge>
                      )}
                      {(property as any).source_provider === 'imobzi' && (
                        <Badge variant="secondary" className="bg-info/15 text-info">
                          <Import className="w-3 h-3 mr-1" />
                          Imobzi
                        </Badge>
                      )}
                      {(property as any).source_provider === 'pdf' && (
                        <>
                          <Badge variant="secondary" className="bg-info/15 text-info">
                            <FileText className="w-3 h-3 mr-1" />
                            PDF
                          </Badge>
                          {(property as any).source_code && (
                            <Badge variant="outline" className="text-xs">
                              {(property as any).source_code}
                            </Badge>
                          )}
                        </>
                      )}
                    </div>
                    <CardTitle className="text-2xl">{property.title}</CardTitle>
                    <div className="flex items-center text-muted-foreground mt-2">
                      <MapPin className="h-4 w-4 mr-1" />
                      {getFullAddress() || "Endereço não informado"}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  {property.sale_price && (
                    <div>
                      <p className="text-sm text-muted-foreground">Venda</p>
                      <p className="text-2xl font-bold text-primary">
                        {formatPrice(property.sale_price)}
                      </p>
                    </div>
                  )}
                  {property.rent_price && (
                    <div>
                      <p className="text-sm text-muted-foreground">Aluguel</p>
                      <p className="text-2xl font-bold text-primary">
                        {formatPrice(property.rent_price, true)}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Features */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Características</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 cursor-help">
                        <Bed className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-semibold">{property.bedrooms || 0}</p>
                          <p className="text-xs text-muted-foreground">Quartos</p>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        {property.bedrooms || 0} quartos
                        {property.suites ? `, ${property.suites} suíte(s)` : ""}
                      </p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 cursor-help">
                        <Bath className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-semibold">{property.bathrooms || 0}</p>
                          <p className="text-xs text-muted-foreground">Banheiros</p>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{property.bathrooms || 0} banheiro(s) completo(s)</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 cursor-help">
                        <Car className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-semibold">{property.parking_spots || 0}</p>
                          <p className="text-xs text-muted-foreground">Vagas</p>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{property.parking_spots || 0} vaga(s) de garagem</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 cursor-help">
                        <Maximize className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-semibold">{property.area_total || "-"}</p>
                          <p className="text-xs text-muted-foreground">m² total</p>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        Área total: {property.area_total || "-"}m²
                        {property.area_built ? ` | Construída: ${property.area_built}m²` : ""}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>

                {/* Additional costs */}
                {(property.condominium_fee || property.iptu) && (
                  <>
                    <Separator className="my-4" />
                    <div className="grid grid-cols-2 gap-4">
                      {property.condominium_fee && (
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">
                              {formatPrice(property.condominium_fee)}/mês
                            </p>
                            <p className="text-xs text-muted-foreground">Condomínio</p>
                          </div>
                        </div>
                      )}
                      {property.iptu && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">
                              {formatPrice(property.iptu)}/ano
                            </p>
                            <p className="text-xs text-muted-foreground">IPTU</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Description */}
            {property.description && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Descrição</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground whitespace-pre-line">
                    {property.description}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Amenities */}
            {property.amenities && property.amenities.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Comodidades</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {property.amenities.map((amenity, index) => (
                      <Badge key={index} variant="secondary">
                        {amenity}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Floor Plans Section */}
            {(() => {
              const floorPlans = property.images?.filter((img: any) => 
                img.image_type === 'floor_plan' || img.image_type === 'floor_plan_secondary'
              ) || [];
              
              if (floorPlans.length === 0) return null;
              
              return (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Layers className="h-5 w-5" />
                      Plantas Baixas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                      {floorPlans.map((plan: any, index: number) => (
                        <div key={plan.id} className="relative group">
                          <div className="absolute top-2 left-2 z-10">
                            <Badge variant="secondary">
                              {plan.image_type === 'floor_plan' ? 'Plano 1' : `Plano ${index + 1}`}
                            </Badge>
                          </div>
                          <div className="aspect-[4/3] rounded-lg overflow-hidden border bg-muted">
                            <img
                              src={plan.url}
                              alt={`Planta ${index + 1}`}
                              className="w-full h-full object-contain group-hover:scale-105 transition-transform cursor-pointer"
                              onClick={() => window.open(plan.url, '_blank')}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })()}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Ações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full" onClick={handleOpenLandingPage}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir Landing Page
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setEditorOpen(true)}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Editar Landing Page
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setFormOpen(true)}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Editar Imóvel
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleDuplicate}
                  disabled={isDuplicating}
                >
                  {isDuplicating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CopyPlus className="h-4 w-4 mr-2" />
                  )}
                  Duplicar Imóvel
                </Button>
              </CardContent>
            </Card>

            {/* Owner Card */}
            {owners.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Proprietário{owners.length > 1 ? "s" : ""}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {owners.map((owner: any) => (
                    <div key={owner.id} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{owner.name}</span>
                        {owner.is_primary && (
                          <Badge variant="secondary" className="text-xs">Principal</Badge>
                        )}
                      </div>
                      {owner.phone && (
                        <a href={`tel:${owner.phone}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                          <Phone className="h-3.5 w-3.5" />
                          {owner.phone}
                        </a>
                      )}
                      {owner.email && (
                        <a href={`mailto:${owner.email}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                          <Mail className="h-3.5 w-3.5" />
                          {owner.email}
                        </a>
                      )}
                      {owner.document && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <FileText className="h-3.5 w-3.5" />
                          {owner.document}
                        </div>
                      )}
                      {owner.notes && (
                        <p className="text-xs text-muted-foreground italic">{owner.notes}</p>
                      )}
                      {owners.indexOf(owner) < owners.length - 1 && <Separator />}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Financial Card */}
            {((property as any).iptu_monthly || (property as any).commission_value || (property as any).inspection_fee || ((property as any).payment_options && (property as any).payment_options.length > 0)) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Dados Financeiros
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(property as any).iptu_monthly && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">IPTU Mensal</span>
                      <span className="text-sm font-medium">{formatPrice((property as any).iptu_monthly)}/mês</span>
                    </div>
                  )}
                  {(property as any).inspection_fee && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Taxa de Vistoria</span>
                      <span className="text-sm font-medium">{formatPrice((property as any).inspection_fee)}</span>
                    </div>
                  )}
                  {(property as any).commission_value && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Comissão</span>
                      <span className="text-sm font-medium">
                        {(property as any).commission_type === "porcentagem"
                          ? `${(property as any).commission_value}%`
                          : formatPrice((property as any).commission_value)}
                      </span>
                    </div>
                  )}
                  {(property as any).payment_options && (property as any).payment_options.length > 0 && (
                    <div>
                      <span className="text-sm text-muted-foreground">Formas de Pagamento</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(property as any).payment_options.map((opt: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">{opt}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}


            {property.address_city && property.address_state && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Localização</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="aspect-video rounded-lg overflow-hidden">
                    <iframe
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      loading="lazy"
                      allowFullScreen
                      referrerPolicy="no-referrer-when-downgrade"
                      src={import.meta.env.VITE_GOOGLE_MAPS_EMBED_KEY
                        ? `https://www.google.com/maps/embed/v1/place?key=${import.meta.env.VITE_GOOGLE_MAPS_EMBED_KEY}&q=${encodeURIComponent(
                            getFullAddress() || `${property.address_city}, ${property.address_state}`
                          )}`
                        : `https://maps.google.com/maps?q=${encodeURIComponent(
                            getFullAddress() || `${property.address_city}, ${property.address_state}`
                          )}&output=embed`}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Inline Edit Form */}
      <PropertyForm
        open={formOpen}
        onOpenChange={setFormOpen}
        property={property}
        onSubmit={handleFormSubmit}
        isSubmitting={isUpdating}
      />

      {/* Landing Page Editor */}
      {id && (
        <LandingPageEditor
          propertyId={id}
          open={editorOpen}
          onOpenChange={setEditorOpen}
        />
      )}
      {id && (
        <PropertyQRCode
          propertyId={id}
          propertyTitle={property?.title}
          open={qrOpen}
          onOpenChange={setQrOpen}
        />
      )}
    </div>
  );
}
